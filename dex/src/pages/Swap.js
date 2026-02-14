import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { useChainContext } from '../contexts/ChainContext';
import { useOneInchSdk } from '../hooks';
import './Swap.css';

const toBaseUnits = (value, decimals) => {
  const safeValue = Number(value);
  if (!Number.isFinite(safeValue) || safeValue <= 0) return '0';
  const [whole, fraction = ''] = safeValue.toString().split('.');
  const padded = `${fraction}${'0'.repeat(decimals)}`.slice(0, decimals);
  return `${whole}${padded}`.replace(/^0+(?=\d)/, '') || '0';
};

function Swap({ address, isConnect }) {
  const { displayTokens } = useTokens();
  const { selectedChain, setSelectedChain } = useChainContext();
  
  // UI State
  const [slippage, setSlippage] = useState(2.5);
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
  
  const chainTokens = useMemo(() => {
    const chainKeyMap = {
      '1': ['ethereum'],
      '56': ['bnb', 'bsc', 'binance'],
      '137': ['polygon'],
      '43114': ['avalanche'],
      '42161': ['arbitrum'],
      '501': ['solana']
    };

    const normalizeChains = (rawChains) => {
      if (!rawChains) return {};
      if (typeof rawChains === 'string') {
        try {
          return JSON.parse(rawChains);
        } catch (e) {
          return {};
        }
      }
      return rawChains || {};
    };

    return (displayTokens || [])
      .map((token) => {
        if (!token) return null;
        const chains = normalizeChains(token.chains || token.addresses);
        const chainKey = String(selectedChain || '');
        const aliasKeys = chainKeyMap[chainKey] || [];
        const resolvedAddress =
          chains?.[chainKey] ||
          aliasKeys.map((key) => chains?.[key]).find(Boolean) ||
          token.address;

        if (!resolvedAddress) return null;

        return {
          ...token,
          address: resolvedAddress,
          symbol: token.symbol || token.ticker,
          name: token.name || token.symbol || token.ticker,
          icon: token.icon || token.image || token.img
        };
      })
      .filter(Boolean);
  }, [displayTokens, selectedChain]);

  // Initialize tokens for selected chain
  useEffect(() => {
    if (chainTokens && chainTokens.length > 0) {
      setTokenOne(chainTokens[0]);
      setTokenTwo(chainTokens[1] || chainTokens[0]);
    } else {
      setTokenOne(null);
      setTokenTwo(null);
    }
    setPrices(null);
    setTokenOneAmount('');
    setTokenTwoAmount('');
  }, [chainTokens]);
  
  const {
    loading: sdkLoading,
    error: sdkError,
    getEvmQuote,
    submitEvmOrder,
    getEvmStatus,
    getSolanaQuote,
    submitSolanaOrder,
    getSolanaStatus,
    isEVMChain
  } = useOneInchSdk();

  const [activeOrder, setActiveOrder] = useState(null);

  // Calculate price ratio between two tokens
  const fetchPrices = useCallback(async (tokenOneUuid, tokenTwoUuid) => {
    if (!chainTokens) return;
    
    const firstToken = chainTokens.find((token) => token.uuid === tokenOneUuid || token.symbol === tokenOneUuid);
    const secondToken = chainTokens.find((token) => token.uuid === tokenTwoUuid || token.symbol === tokenTwoUuid);
    
    if (firstToken && secondToken) {
      const priceRatio = parseFloat(firstToken.price) / parseFloat(secondToken.price);
      setPrices({
        priceRatio: priceRatio,
        firstTokenPrice: parseFloat(firstToken.price),
        secondTokenPrice: parseFloat(secondToken.price),
      });
    }
  }, [chainTokens]);

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
      if (tokenTwo && (tokenTwo.uuid || tokenTwo.symbol) !== (token.uuid || token.symbol)) {
        fetchPrices(token.uuid || token.symbol, tokenTwo.uuid || tokenTwo.symbol);
      }
    } else {
      setTokenTwo(token);
      if (tokenOne && (tokenOne.uuid || tokenOne.symbol) !== (token.uuid || token.symbol)) {
        fetchPrices(tokenOne.uuid || tokenOne.symbol, token.uuid || token.symbol);
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
      const tokenAmount = toBaseUnits(tokenOneAmount, tokenOne.decimals || 18);

      if (isEVMChain()) {
        const quoteResponse = await getEvmQuote({
          fromTokenAddress: tokenOne.address,
          toTokenAddress: tokenTwo.address,
          amount: tokenAmount,
          networkId: selectedChain
        });

        if (!quoteResponse?.success) {
          showMessage(quoteResponse?.error || 'Failed to fetch swap quote', 'error');
          return;
        }

        showConfirmationModal(tokenOne, tokenTwo, quoteResponse.data, tokenAmount, false);
        return;
      }

      const quoteResponse = await getSolanaQuote({
        srcToken: tokenOne.address,
        dstToken: tokenTwo.address,
        amount: tokenAmount
      });

      if (!quoteResponse?.success) {
        showMessage(quoteResponse?.error || 'Failed to fetch swap quote', 'error');
        return;
      }

      showConfirmationModal(tokenOne, tokenTwo, quoteResponse.data, tokenAmount, true);
    } catch (error) {
      showMessage('Failed to fetch swap quote', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show confirmation modal
  const showConfirmationModal = (src, dst, quoteResponse, amount, isSolanaFlow) => {
    const fromAmount = Number(amount) / Math.pow(10, src.decimals || 18);
    const toAmount = Number(quoteResponse?.toAmount || 0) / Math.pow(10, dst.decimals || 18);
    const fromUSD = fromAmount * prices.firstTokenPrice;
    const toUSD = toAmount * prices.secondTokenPrice;

    const confirmSwap = window.confirm(
      `Swap ${fromAmount.toFixed(6)} ${src.symbol} ($${fromUSD.toFixed(2)}) for ${toAmount.toFixed(6)} ${dst.symbol} ($${toUSD.toFixed(2)})?`
    );

    if (confirmSwap) {
      handleSwapConfirmation(src, dst, quoteResponse, amount, isSolanaFlow);
    }
  };

  // Handle swap confirmation
  const handleSwapConfirmation = async (src, dst, quoteResponse, amount, isSolanaFlow) => {
    try {
      setLoading(true);

      if (isSolanaFlow) {
        const response = await submitSolanaOrder({
          srcToken: src.address,
          dstToken: dst.address,
          amount
        });

        if (!response?.success) {
          showMessage(response?.error || 'Swap failed', 'error');
          return;
        }

        setActiveOrder({
          type: 'solana',
          orderHash: response.data?.orderHash,
          signature: response.data?.signature
        });
        showMessage('Swap submitted - tracking status', 'info');
        return;
      }

      const response = await submitEvmOrder({
        fromTokenAddress: src.address,
        toTokenAddress: dst.address,
        amount,
        networkId: selectedChain,
        slippage
      });

      if (!response?.success) {
        showMessage(response?.error || 'Swap failed', 'error');
        return;
      }

      setActiveOrder({
        type: 'evm',
        orderHash: response.data?.orderHash,
        chainId: selectedChain
      });
      showMessage('Swap submitted - tracking status', 'info');
    } catch (error) {
      showMessage('Swap failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeOrder) return;

    const interval = setInterval(async () => {
      try {
        if (activeOrder.type === 'evm') {
          const statusResponse = await getEvmStatus({
            orderHash: activeOrder.orderHash,
            networkId: activeOrder.chainId
          });

          const status = statusResponse?.data?.status || statusResponse?.data?.state;
          if (status === 'Filled' || status === 'filled') {
            showMessage('Swap successful!', 'success');
            setTokenOneAmount('');
            setTokenTwoAmount('');
            setActiveOrder(null);
          } else if (status === 'Expired' || status === 'Cancelled' || status === 'Canceled') {
            showMessage(`Swap ${status}`, 'error');
            setActiveOrder(null);
          }
          return;
        }

        const statusResponse = await getSolanaStatus({
          orderHash: activeOrder.orderHash,
          signature: activeOrder.signature
        });

        const isActive = statusResponse?.data?.isActive;
        const confirmation = statusResponse?.data?.confirmationStatus;
        if (isActive === false || confirmation === 'confirmed' || confirmation === 'finalized') {
          showMessage('Swap successful!', 'success');
          setTokenOneAmount('');
          setTokenTwoAmount('');
          setActiveOrder(null);
        }
      } catch (err) {
        console.error('Swap status polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeOrder, getEvmStatus, getSolanaStatus]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    if (sdkError) {
      showMessage(sdkError, 'error');
    }
  }, [sdkError]);

  if (!chainTokens?.length) {
    return <div className="swap-page">No tokens available for this chain.</div>;
  }

  if (!tokenOne || !tokenTwo) {
    return <div className="swap-page">Loading tokens...</div>;
  }

  return (
    <div className="swap-page">
      {message && <div className={`message message-${message.type}`}>{message.text}</div>}

      {/* Chain Selector */}
      <div className="chain-selector">
        <div className="chain-row primary">
          {[
            { id: '1', label: 'Ethereum' },
            { id: '56', label: 'BNB' },
            { id: '137', label: 'Polygon' }
          ].map((c) => (
            <button
              key={c.id}
              className={`chain-btn ${selectedChain === c.id ? 'active' : ''}`}
              onClick={() => setSelectedChain(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="chain-row secondary">
          <button
            className={`chain-btn solana ${selectedChain === '501' ? 'active' : ''}`}
            onClick={() => setSelectedChain('501')}
          >
            Solana
          </button>
        </div>
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
          disabled={!isConnect || !tokenOneAmount || loading || sdkLoading}
        >
          {!isConnect ? 'Connect Wallet' : loading || sdkLoading ? 'Processing...' : 'Swap'}
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
              {chainTokens?.length ? (
                chainTokens.map((token) => (
                  <button
                    key={token.uuid || token.symbol || token.address}
                    className="token-item"
                    onClick={() => selectToken(token)}
                  >
                    {token.icon && <img src={token.icon} alt={token.symbol} />}
                    <div className="token-info">
                      <div className="token-name">{token.name}</div>
                      <div className="token-symbol">{token.symbol}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="no-data">No tokens for this chain</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Swap;
