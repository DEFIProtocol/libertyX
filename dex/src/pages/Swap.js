import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTokens } from '../contexts/TokenContext';
import { useSendTransaction, useWaitForTransaction } from 'wagmi';
import './Swap.css';

function Swap({ address, isConnect }) {
  const { displayTokens } = useTokens();
  
  // UI State
  const [slippage, setSlippage] = useState(2.5);
  const [chain, setChain] = useState('Ethereum');
  const [chainId, setChainId] = useState('1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Token and Amount State
  const [tokenOneAmount, setTokenOneAmount] = useState('');
  const [tokenTwoAmount, setTokenTwoAmount] = useState('');
  const [tokenOne, setTokenOne] = useState(null);
  const [tokenTwo, setTokenTwo] = useState(null);
  const [prices, setPrices] = useState(null);
  
  // Initialize tokens
  useEffect(() => {
    if (displayTokens && displayTokens.length > 0) {
      setTokenOne(displayTokens[0]);
      setTokenTwo(displayTokens[1] || displayTokens[0]);
    }
  }, [displayTokens]);
  
  // Transaction State
  const [txDetails, setTxDetails] = useState({
    to: null,
    data: null,
    value: null,
  });
  
  const axiosHeaders = {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${process.env.REACT_APP_1INCH_API_KEY}`,
    },
  };
  
  const { data, sendTransaction } = useSendTransaction({
    request: {
      from: address,
      to: String(txDetails.to),
      data: String(txDetails.data),
      value: String(txDetails.value),
    },
  });
  
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  // Calculate price ratio between two tokens
  const fetchPrices = useCallback(async (tokenOneUuid, tokenTwoUuid) => {
    if (!displayTokens) return;
    
    const firstToken = displayTokens.find((token) => token.uuid === tokenOneUuid);
    const secondToken = displayTokens.find((token) => token.uuid === tokenTwoUuid);
    
    if (firstToken && secondToken) {
      const priceRatio = firstToken.price / secondToken.price;
      setPrices({
        priceRatio: priceRatio,
        firstTokenPrice: firstToken.price,
        secondTokenPrice: secondToken.price,
      });
    }
  }, [displayTokens]);

  // Handle amount change and auto-calculate second token amount
  const handleAmountChange = (e) => {
    const value = e.target.value;
    setTokenOneAmount(value);
    
    if (value && prices) {
      setTokenTwoAmount((parseFloat(value) * prices.priceRatio).toFixed(6));
    } else {
      setTokenTwoAmount('');
    }
  };

  // Switch token positions
  const switchTokens = () => {
    setPrices(null);
    setTokenOneAmount('');
    setTokenTwoAmount('');
    const temp = tokenOne;
    setTokenOne(tokenTwo);
    setTokenTwo(temp);
  };

  // Open token selection modal
  const openModal = (tokenPosition) => {
    setModalMode(tokenPosition);
    setIsModalOpen(true);
  };

  // Select token from modal
  const selectToken = (token) => {
    if (modalMode === 1) {
      setTokenOne(token);
      if (tokenTwo && tokenTwo.uuid !== token.uuid) {
        fetchPrices(token.uuid, tokenTwo.uuid);
      }
    } else {
      setTokenTwo(token);
      if (tokenOne && tokenOne.uuid !== token.uuid) {
        fetchPrices(tokenOne.uuid, token.uuid);
      }
    }
    setIsModalOpen(false);
    setPrices(null);
    setTokenOneAmount('');
    setTokenTwoAmount('');
  };

  // Fetch swap quote from 1inch API
  const fetchDexSwap = async () => {
    if (!tokenOneAmount || !tokenOne || !tokenTwo) {
      showMessage('Please enter an amount', 'error');
      return;
    }

    setLoading(true);
    try {
      const tokenAmount = tokenOneAmount * Math.pow(10, tokenOne.decimals || 18);
      const quoteResponse = await fetchQuote(tokenOne, tokenTwo, tokenAmount);
      showConfirmationModal(tokenOne, tokenTwo, quoteResponse, tokenAmount);
    } catch (error) {
      showMessage('Failed to fetch swap quote', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch quote from 1inch
  const fetchQuote = async (srcToken, dstToken, amount) => {
    const response = await axios.get(
      `${process.env.REACT_APP_BACKEND}/api/1inch/swap/v5.2/${chainId}/quote?src=${srcToken.address}&dst=${dstToken.address}&amount=${amount}&fee=1&includeTokensInfo=true&includeGas=true`,
      axiosHeaders
    );
    return response.data;
  };

  // Show confirmation modal
  const showConfirmationModal = (src, dst, quoteResponse, amount) => {
    const fromAmount = amount / Math.pow(10, src.decimals || 18);
    const toAmount = quoteResponse.toAmount / Math.pow(10, dst.decimals || 18);
    const fromUSD = fromAmount * prices.firstTokenPrice;
    const toUSD = toAmount * prices.secondTokenPrice;

    const confirmSwap = window.confirm(
      `Swap ${fromAmount.toFixed(6)} ${src.symbol} ($${fromUSD.toFixed(2)}) for ${toAmount.toFixed(6)} ${dst.symbol} ($${toUSD.toFixed(2)})?`
    );

    if (confirmSwap) {
      handleSwapConfirmation(src, dst, quoteResponse, amount);
    }
  };

  // Handle swap confirmation
  const handleSwapConfirmation = async (src, dst, quoteResponse, amount) => {
    try {
      setLoading(true);
      const allowanceResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND}/api/1inch/swap/v5.2/${chainId}/approve/allowance?tokenAddress=${src.address}&walletAddress=${address}`,
        axiosHeaders
      );

      if (allowanceResponse.data.allowance === '0') {
        const approveResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND}/api/1inch/swap/v5.2/${chainId}/approve/transaction?tokenAddress=${src.address}&amount=${amount}`,
          axiosHeaders
        );
        setTxDetails(approveResponse.data);
        showMessage('Approval required - confirm in wallet', 'info');
        return;
      }

      const txResponse = await executeTransaction(src, dst, quoteResponse, amount);
      setTxDetails(txResponse.data.tx);
      showMessage('Swap initiated - confirm in wallet', 'info');
    } catch (error) {
      showMessage('Swap failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Execute swap transaction
  const executeTransaction = async (src, dst, quoteResponse, amount) => {
    return await axios.get(
      `${process.env.REACT_APP_BACKEND}/api/1inch/swap/v5.2/${chainId}/swap?src=${src.address}&dst=${dst.address}&amount=${amount}&from=${address}&slippage=${slippage}&fee=1&referrer=${process.env.REACT_APP_ADMIN_ADDRESS}&receiver=${address}`,
      axiosHeaders
    );
  };

  // Handle transaction submission
  useEffect(() => {
    if (txDetails.to && address) {
      sendTransaction();
    }
  }, [txDetails, address, sendTransaction]);

  // Handle transaction loading
  useEffect(() => {
    if (txLoading) {
      showMessage('Transaction pending...', 'info');
    }
  }, [txLoading]);

  // Handle transaction success
  useEffect(() => {
    if (txSuccess) {
      showMessage('Swap successful!', 'success');
      setTokenOneAmount('');
      setTokenTwoAmount('');
    }
  }, [txSuccess]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  if (!tokenOne || !tokenTwo) {
    return <div className="swap-page">Loading tokens...</div>;
  }

  return (
    <div className="swap-page">
      {message && <div className={`message message-${message.type}`}>{message.text}</div>}

      {/* Chain Selector */}
      <div className="chain-selector">
        {['Ethereum', 'Binance', 'Polygon'].map((c) => (
          <button
            key={c}
            className={`chain-btn ${chain === c ? 'active' : ''}`}
            onClick={() => {
              setChain(c);
              setChainId(c === 'Ethereum' ? '1' : c === 'Binance' ? '56' : '137');
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Main Swap Card */}
      <div className="swap-card">
        <div className="swap-header">
          <h2>Swap Tokens</h2>
          <div className="slippage-control">
            <label>Slippage: {slippage}%</label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value))}
              className="slippage-slider"
            />
          </div>
        </div>

        {/* Token Input */}
        <div className="swap-input-group">
          <div className="input-label">From</div>
          <div className="input-container">
            <input
              type="number"
              placeholder="0.00"
              value={tokenOneAmount}
              onChange={handleAmountChange}
              disabled={!isConnect}
              className="token-input"
            />
            <button
              className="token-selector"
              onClick={() => openModal(1)}
            >
              {tokenOne?.icon && <img src={tokenOne.icon} alt={tokenOne.symbol} />}
              <span>{tokenOne?.symbol}</span>
            </button>
          </div>
        </div>

        {/* Switch Button */}
        <div className="switch-container">
          <button className="switch-btn" onClick={switchTokens} title="Switch tokens">
            ↓
          </button>
        </div>

        {/* Token Output */}
        <div className="swap-input-group">
          <div className="input-label">To</div>
          <div className="input-container">
            <input
              type="number"
              placeholder="0.00"
              value={tokenTwoAmount}
              disabled
              className="token-input disabled"
            />
            <button
              className="token-selector"
              onClick={() => openModal(2)}
            >
              {tokenTwo?.icon && <img src={tokenTwo.icon} alt={tokenTwo.symbol} />}
              <span>{tokenTwo?.symbol}</span>
            </button>
          </div>
        </div>

        {/* Price Info */}
        {prices && (
          <div className="price-info">
            <p>1 {tokenOne.symbol} = {prices.priceRatio.toFixed(6)} {tokenTwo.symbol}</p>
          </div>
        )}

        {/* Swap Button */}
        <button
          className="swap-btn"
          onClick={fetchDexSwap}
          disabled={!isConnect || !tokenOneAmount || loading || txLoading}
        >
          {!isConnect ? 'Connect Wallet' : loading || txLoading ? 'Processing...' : 'Swap'}
        </button>
      </div>

      {/* Token Selection Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Token</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <div className="token-list">
              {displayTokens?.map((token) => (
                <button
                  key={token.uuid}
                  className="token-item"
                  onClick={() => selectToken(token)}
                >
                  {token.icon && <img src={token.icon} alt={token.symbol} />}
                  <div className="token-info">
                    <div className="token-name">{token.name}</div>
                    <div className="token-symbol">{token.symbol}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Swap;
