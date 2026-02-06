import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import './order.css';
import { Popover, Radio, message, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useChainContext } from '../../contexts/ChainContext';
import GlobalPriceContext from '../../contexts/GlobalPriceContext';
import { useTokens } from '../../contexts/TokenContext';
import { useOneInchSdk } from '../../hooks';

const EVM_NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const chainKeyMap = {
  '1': ['ethereum'],
  '10': ['optimism'],
  '56': ['binance', 'bsc', 'bnb'],
  '137': ['polygon'],
  '250': ['fantom'],
  '42161': ['arbitrum'],
  '43114': ['avalanche'],
  '8217': ['klaytn'],
  '1313161554': ['aurora'],
  '501': ['solana']
};

const chainNativeSymbolMap = {
  '1': 'ETH',
  '10': 'ETH',
  '42161': 'ETH',
  '1313161554': 'ETH',
  '56': 'BNB',
  '137': 'MATIC',
  '43114': 'AVAX',
  '250': 'FTM',
  '8217': 'KLAY',
  '501': 'SOL'
};

const chainNativeDecimalsMap = {
  '1': 18,
  '10': 18,
  '42161': 18,
  '1313161554': 18,
  '56': 18,
  '137': 18,
  '43114': 18,
  '250': 18,
  '8217': 18,
  '501': 9
};

// Fallback prices in USD (used as last resort)
const nativePriceFallbacks = {
  'ETH': 2500,
  'BNB': 300,
  'MATIC': 0.7,
  'AVAX': 35,
  'FTM': 0.3,
  'KLAY': 0.2,
  'SOL': 100
};

const parseAmountInput = (value) => {
  if (value == null) return NaN;
  const normalized = String(value).replace(/,/g, '').trim();
  return Number(normalized);
};

const toBaseUnits = (value, decimals) => {
  const safeValue = Number(value);
  if (!Number.isFinite(safeValue) || safeValue <= 0) return '0';
  const [whole, fraction = ''] = safeValue.toString().split('.');
  const padded = `${fraction}${'0'.repeat(decimals)}`.slice(0, decimals);
  return `${whole}${padded}`.replace(/^0+(?=\d)/, '') || '0';
};

const normalizeChainAddress = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const cleaned = text.replace(/^[\{"']+|[\}"']+$/g, '');
  return cleaned || null;
};

const getChainTokenAddress = (token, chainId, chainKey) => {
  if (!token) return null;
  const raw = token.chains || token.addresses || {};
  const chains = typeof raw === 'string' ? (() => {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  })() : raw;

  if (chainKey && chains?.[chainKey]) return normalizeChainAddress(chains[chainKey]);
  if (chains?.[String(chainId)]) return normalizeChainAddress(chains[String(chainId)]);
  return null;
};

function MarketOrder(props) {
  const { address, usdPrice, tokenName, symbol, decimals } = props;
  const { selectedChain, setSelectedChain, getChainLabel, availableChains } = useChainContext();
  const globalPrices = useContext(GlobalPriceContext);
  const getPrice = globalPrices?.getPrice;
  const refreshGlobalPrices = globalPrices?.refreshRapidApi || globalPrices?.refreshPrices;
  const { dbTokens, jsonTokens } = useTokens();
  const [messageApi, contextHolder] = message.useMessage();
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(2.5);
  const [checked, setChecked] = useState('usd');
  const [activeOrder, setActiveOrder] = useState(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  const {
    loading,
    error,
    getEvmQuote,
    submitEvmOrder,
    getEvmStatus,
    getSolanaQuote,
    submitSolanaOrder,
    getSolanaStatus
  } = useOneInchSdk();

  const tokenObject = useMemo(() => {
    const symbolLower = symbol?.toLowerCase();
    return (
      dbTokens?.find((token) => token.symbol?.toLowerCase() === symbolLower) ||
      jsonTokens?.find((token) => token.symbol?.toLowerCase() === symbolLower) ||
      null
    );
  }, [dbTokens, jsonTokens, symbol]);

  const chainId = useMemo(() => {
    const raw = selectedChain || '1';
    const entries = availableChains || [];
    const byId = entries.find((chain) => chain.id === String(raw));
    if (byId) return byId.id;
    const byKey = entries.find((chain) => chain.key === raw);
    return byKey?.id || '1';
  }, [availableChains, selectedChain]);

  const selectedChainKey = (availableChains || []).find((chain) => chain.id === chainId)?.key || null;
  const isSolana = chainId === '501';
  const tokenChainsMap = useMemo(() => {
    const raw = tokenObject?.chains || tokenObject?.addresses || {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return {};
      }
    }
    return raw;
  }, [tokenObject]);

  const isTokenChainSupported = useCallback((targetChainId) => {
    const targetKey = (availableChains || []).find((chain) => chain.id === String(targetChainId))?.key;
    if (targetKey && tokenChainsMap?.[targetKey]) return true;
    const keys = chainKeyMap[String(targetChainId)] || [];
    return keys.some((key) => tokenChainsMap?.[key]);
  }, [availableChains, tokenChainsMap]);

  const supportedChains = useMemo(() => {
    if (!tokenObject) return [];
    const entries = availableChains || [];
    return entries.filter((chain) => isTokenChainSupported(chain.id));
  }, [availableChains, isTokenChainSupported, tokenObject]);

  const tokenAddress = getChainTokenAddress(tokenObject, chainId, selectedChainKey);
  const nativeSymbol = chainNativeSymbolMap[chainId] || 'ETH';
  const nativeDecimals = chainNativeDecimalsMap[chainId] || 18;

  // Enhanced native price fetching with fallbacks
  const getNativePriceWithFallbacks = useCallback(() => {
    // Try to get from global prices context first
    const priceEntry = getPrice?.(nativeSymbol);
    if (priceEntry?.price) {
      return typeof priceEntry.price === 'string' 
        ? parseFloat(priceEntry.price) 
        : Number(priceEntry.price);
    }

    // Try wrapped versions (WETH, WBNB, etc.)
    const wrappedSymbol = `W${nativeSymbol}`;
    const wrappedPriceEntry = getPrice?.(wrappedSymbol);
    if (wrappedPriceEntry?.price) {
      return typeof wrappedPriceEntry.price === 'string'
        ? parseFloat(wrappedPriceEntry.price)
        : Number(wrappedPriceEntry.price);
    }

    // Use fallback prices as last resort
    return nativePriceFallbacks[nativeSymbol] || 0;
  }, [getPrice, nativeSymbol]);

  const nativePrice = useMemo(() => getNativePriceWithFallbacks(), [getNativePriceWithFallbacks]);
  const tokenUsdPrice = useMemo(() => Number(usdPrice) || 0, [usdPrice]);

  const logSdkResponse = useCallback((label, payload) => {
    try {
      console.log(`[1inch SDK] ${label}`, payload);
    } catch (err) {
      // ignore logging errors
    }
  }, []);

  const hasChainMappings = tokenObject && Object.keys(tokenChainsMap || {}).length > 0;
  const shouldHide = hasChainMappings && !isTokenChainSupported(chainId);

  const refreshNativePrice = useCallback(async () => {
    if (!refreshGlobalPrices || isRefreshingPrices) return;
    
    setIsRefreshingPrices(true);
    try {
      await refreshGlobalPrices();
      messageApi.success('Prices refreshed');
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setIsRefreshingPrices(false);
    }
  }, [refreshGlobalPrices, isRefreshingPrices, messageApi]);

  // Refresh prices on mount if native price is missing
  useEffect(() => {
    if (!nativePrice && refreshGlobalPrices && nativePrice !== 0) {
      refreshNativePrice();
    }
  }, []);

  const handleSlippageChange = (e) => {
    setSlippage(e.target.value);
  };

  const resolveAmount = useCallback((isBuy) => {
    const numericAmount = parseAmountInput(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return '0';

    if (isBuy) {
      if (checked === 'native') {
        return toBaseUnits(numericAmount, nativeDecimals);
      }
      if (checked === 'usd') {
        if (!nativePrice) {
          logSdkResponse('Missing native price for USD calculation', { amount: numericAmount });
          return '0';
        }
        const nativeAmount = numericAmount / nativePrice;
        return toBaseUnits(nativeAmount, nativeDecimals);
      }
      if (!nativePrice || !tokenUsdPrice) {
        logSdkResponse('Missing prices for token calculation', { 
          nativePrice, 
          tokenUsdPrice,
          amount: numericAmount 
        });
        return '0';
      }
      const nativeAmount = (numericAmount * tokenUsdPrice) / nativePrice;
      return toBaseUnits(nativeAmount, nativeDecimals);
    }

    // Sell calculations
    if (checked === tokenName) {
      return toBaseUnits(numericAmount, decimals);
    }
    if (checked === 'usd') {
      if (!tokenUsdPrice) {
        logSdkResponse('Missing token price for USD calculation', { amount: numericAmount });
        return '0';
      }
      const tokenAmount = numericAmount / tokenUsdPrice;
      return toBaseUnits(tokenAmount, decimals);
    }
    if (!nativePrice || !tokenUsdPrice) {
      logSdkResponse('Missing prices for native calculation', {
        nativePrice,
        tokenUsdPrice,
        amount: numericAmount
      });
      return '0';
    }
    const tokenAmount = (numericAmount * nativePrice) / tokenUsdPrice;
    return toBaseUnits(tokenAmount, decimals);
  }, [amount, checked, decimals, nativeDecimals, nativePrice, tokenUsdPrice, tokenName, logSdkResponse]);

  const showError = useCallback((msg) => {
    messageApi.open({ type: 'error', content: msg });
  }, [messageApi]);

  const pollEvmStatus = useCallback((orderHash) => {
    setActiveOrder({ type: 'evm', orderHash, chainId });
  }, [chainId]);

  const pollSolanaStatus = useCallback((orderHash, signature) => {
    setActiveOrder({ type: 'solana', orderHash, signature });
  }, []);

  const validateAndExecuteSwap = useCallback(async (isBuy) => {
    // Validation
    if (!address) {
      showError('Please connect your wallet');
      return;
    }

    if (!tokenAddress) {
      showError(`Token not available on ${getChainLabel?.(chainId) || 'selected chain'}`);
      return;
    }

    const numericAmount = parseAmountInput(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    if (!nativePrice) {
      showError(`${nativeSymbol} price not available. Refreshing prices...`);
      await refreshNativePrice();
      return;
    }

    const amountValue = resolveAmount(isBuy);
    if (amountValue === '0') {
      showError('Unable to calculate amount. Please check prices and try again.');
      return;
    }

    return { amountValue, numericAmount };
  }, [address, amount, chainId, getChainLabel, nativePrice, nativeSymbol, refreshNativePrice, 
      resolveAmount, showError, tokenAddress]);

  const fetchDexBuy = async () => {
    const validation = await validateAndExecuteSwap(true);
    if (!validation) return;

    const { amountValue, numericAmount } = validation;

    if (isSolana) {
      const solQuote = await getSolanaQuote({
        srcToken: 'NATIVE',
        dstToken: tokenAddress,
        amount: amountValue,
        nativePrice: nativePrice.toString()
      });
      logSdkResponse('getSolanaQuote (buy)', solQuote);

      if (!solQuote?.success) {
        showError(solQuote?.error || 'Failed to fetch Solana quote.');
        return;
      }

      return showConfirmationModal(solQuote.data, amountValue, true, true);
    }

    const evmQuotePayload = {
      fromTokenAddress: EVM_NATIVE_ADDRESS,
      toTokenAddress: tokenAddress,
      amount: amountValue,
      networkId: chainId,
      nativePrice: nativePrice.toString()
    };
    
    logSdkResponse('getEvmQuote payload (buy)', evmQuotePayload);
    const quoteResponse = await getEvmQuote(evmQuotePayload);
    logSdkResponse('getEvmQuote (buy)', quoteResponse);

    if (!quoteResponse?.success) {
      showError(quoteResponse?.error || 'Failed to fetch quote.');
      return;
    }

    showConfirmationModal(quoteResponse.data, amountValue, true, false);
  };

  const fetchDexSell = async () => {
    const validation = await validateAndExecuteSwap(false);
    if (!validation) return;

    const { amountValue, numericAmount } = validation;

    if (isSolana) {
      const solQuote = await getSolanaQuote({
        srcToken: tokenAddress,
        dstToken: 'NATIVE',
        amount: amountValue,
        nativePrice: nativePrice.toString()
      });
      logSdkResponse('getSolanaQuote (sell)', solQuote);

      if (!solQuote?.success) {
        showError(solQuote?.error || 'Failed to fetch Solana quote.');
        return;
      }

      return showConfirmationModal(solQuote.data, amountValue, false, true);
    }

    const evmQuotePayload = {
      fromTokenAddress: tokenAddress,
      toTokenAddress: EVM_NATIVE_ADDRESS,
      amount: amountValue,
      networkId: chainId,
      nativePrice: nativePrice.toString()
    };
    
    logSdkResponse('getEvmQuote payload (sell)', evmQuotePayload);
    const quoteResponse = await getEvmQuote(evmQuotePayload);
    logSdkResponse('getEvmQuote (sell)', quoteResponse);

    if (!quoteResponse?.success) {
      showError(quoteResponse?.error || 'Failed to fetch quote.');
      return;
    }

    showConfirmationModal(quoteResponse.data, amountValue, false, false);
  };

  const showConfirmationModal = (quoteResponse, amountValue, isBuy, isSolanaFlow) => {
    Modal.confirm({
      title: <div style={{ color: 'white' }}>{isBuy ? 'Confirm Buy' : 'Confirm Sell'}</div>,
      content: (
        <div style={{ color: 'white' }}>
          <p>
            Are you sure you want to {isBuy ? 'buy' : 'sell'} {tokenName} on {getChainLabel?.(chainId) || 'Ethereum'}?
          </p>
          <p>Native Price: ${nativePrice?.toFixed(2)}</p>
          {quoteResponse && (
            <>
              <div style={{ margin: '10px 0' }}>
                <img 
                  className="logo" 
                  src={quoteResponse.fromToken?.logoURI} 
                  alt={quoteResponse.fromToken?.name} 
                  style={{ width: 24, height: 24, marginRight: 8 }}
                />
                <span>
                  {quoteResponse.fromToken?.name} ({quoteResponse.fromToken?.symbol})
                </span>
                <div>Amount: {Number(amountValue) / 10 ** (quoteResponse.fromToken?.decimals || 18)}</div>
              </div>
              <div style={{ margin: '10px 0' }}>
                <img 
                  className="logo" 
                  src={quoteResponse.toToken?.logoURI} 
                  alt={quoteResponse.toToken?.name} 
                  style={{ width: 24, height: 24, marginRight: 8 }}
                />
                <span>
                  {quoteResponse.toToken?.name} ({quoteResponse.toToken?.symbol})
                </span>
                <div>Amount: {Number(quoteResponse.toAmount) / 10 ** (quoteResponse.toToken?.decimals || 18)}</div>
              </div>
              {quoteResponse.estimatedGas && (
                <div style={{ margin: '10px 0' }}>
                  Estimated Gas: {quoteResponse.estimatedGas}
                </div>
              )}
            </>
          )}
        </div>
      ),
      onOk: async () => {
        try {
          if (isSolanaFlow) {
            const srcToken = isBuy ? 'NATIVE' : tokenAddress;
            const dstToken = isBuy ? tokenAddress : 'NATIVE';
            const response = await submitSolanaOrder({
              srcToken,
              dstToken,
              amount: amountValue,
              srcTokenProgram: 'TOKEN',
              nativePrice: nativePrice.toString()
            });
            logSdkResponse('submitSolanaOrder', response);

            if (!response?.success) {
              showError(response?.error || 'Solana order failed.');
              return;
            }

            pollSolanaStatus(response.data?.orderHash, response.data?.signature);
            messageApi.open({ type: 'loading', content: 'Solana order submitted...', duration: 1.5 });
            return;
          }

          const response = await submitEvmOrder({
            fromTokenAddress: isBuy ? EVM_NATIVE_ADDRESS : tokenAddress,
            toTokenAddress: isBuy ? tokenAddress : EVM_NATIVE_ADDRESS,
            amount: amountValue,
            networkId: chainId,
            slippage,
            nativePrice: nativePrice.toString()
          });
          logSdkResponse('submitEvmOrder', response);

          if (!response?.success) {
            showError(response?.error || 'Order failed.');
            return;
          }

          pollEvmStatus(response.data?.orderHash);
          messageApi.open({ type: 'loading', content: 'Order submitted...', duration: 1.5 });
        } catch (error) {
          console.error('Order submission error:', error);
          showError(error?.message || 'Sorry, something went wrong.');
        }
      }
    });
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
          logSdkResponse('getEvmStatus', statusResponse);

          const status = statusResponse?.data?.status || statusResponse?.data?.state;
          if (status === 'Filled' || status === 'filled') {
            messageApi.open({ type: 'success', content: 'Order filled!', duration: 2 });
            setActiveOrder(null);
          } else if (status === 'Expired' || status === 'Cancelled' || status === 'Canceled') {
            messageApi.open({ type: 'error', content: `Order ${status}`, duration: 2 });
            setActiveOrder(null);
          }
        } else {
          const statusResponse = await getSolanaStatus({
            orderHash: activeOrder.orderHash,
            signature: activeOrder.signature
          });
          logSdkResponse('getSolanaStatus', statusResponse);

          const isActive = statusResponse?.data?.isActive;
          const confirmation = statusResponse?.data?.confirmationStatus;
          if (isActive === false || confirmation === 'confirmed' || confirmation === 'finalized') {
            messageApi.open({ type: 'success', content: 'Solana order completed!', duration: 2 });
            setActiveOrder(null);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeOrder, getEvmStatus, getSolanaStatus, messageApi]);

  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  const settings = (
    <div style={{ padding: '10px' }}>
      <div style={{ marginBottom: '10px' }}>Slippage Tolerance</div>
      <div>
        <Radio.Group value={slippage} onChange={handleSlippageChange}>
          <Radio.Button value={0.5}>0.5%</Radio.Button>
          <Radio.Button value={2.5}>2.5%</Radio.Button>
          <Radio.Button value={5}>5.0%</Radio.Button>
        </Radio.Group>
      </div>
      <div style={{ marginTop: '15px' }}>
        <button 
          onClick={refreshNativePrice}
          disabled={isRefreshingPrices}
          style={{ 
            padding: '5px 10px', 
            background: '#1890ff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isRefreshingPrices ? 'not-allowed' : 'pointer'
          }}
        >
          {isRefreshingPrices ? 'Refreshing...' : 'Refresh Prices'}
        </button>
      </div>
    </div>
  );

  if (shouldHide) {
    return null;
  }

  const pricePerToken = nativePrice && tokenUsdPrice 
    ? (tokenUsdPrice / nativePrice).toFixed(6)
    : '--';

  return (
    <>
      {contextHolder}
      <div className="checkboxContainer">
        <div className="checkboxes">
          <label htmlFor="SelectChain" style={{ color: 'white' }}>
            Select Chain for Transaction
          </label>
          <select
            onChange={(e) => setSelectedChain(e.target.value)}
            value={selectedChain}
            className="selectChainOrder"
            id="SelectChain"
          >
            {supportedChains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.label}
              </option>
            ))}
          </select>
          
          <div className="check-row">
            <input
              type="radio"
              name="priceUnit"
              value="native"
              checked={checked === 'native'}
              onChange={(e) => setChecked(e.target.value)}
            />
            <span>Order Priced in {nativeSymbol}</span>
          </div>
          
          <div className="check-row">
            <input
              type="radio"
              name="priceUnit"
              value="usd"
              checked={checked === 'usd'}
              onChange={(e) => setChecked(e.target.value)}
            />
            <span>Order Priced in USD</span>
          </div>
          
          <div className="check-row">
            <input
              type="radio"
              name="priceUnit"
              value={tokenName}
              checked={checked === tokenName}
              onChange={(e) => setChecked(e.target.value)}
            />
            <span>Order Priced in {tokenName}</span>
          </div>
        </div>
        
        <Popover content={settings} title="Settings" trigger="click" placement="bottomLeft">
          <SettingOutlined className="cog" style={{ color: 'white', fontSize: '20px', cursor: 'pointer' }} />
        </Popover>
      </div>
      
      <div style={{ color: 'white', margin: '10px auto', textAlign: 'center' }}>
        {getChainLabel?.(selectedChain) || 'Ethereum'} / {tokenName}
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          {nativeSymbol}: ${nativePrice?.toFixed(2) || '--'}
        </div>
      </div>
      
      <input
        type="text"
        placeholder="Amount"
        className="input"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      
      <div className="buttonContainer">
        <button 
          className="buyButton" 
          type="button" 
          disabled={!amount || !address || loading || !nativePrice}
          onClick={fetchDexBuy}
        >
          Buy
        </button>
        <button 
          className="sellButton" 
          type="button" 
          disabled={!amount || !address || loading || !nativePrice}
          onClick={fetchDexSell}
        >
          Sell
        </button>
      </div>
      
      <div style={{ color: 'lime', fontWeight: '700', margin: '10px auto', padding: '2%', textAlign: 'center' }}>
        {nativeSymbol} Price per Token = {pricePerToken}
      </div>
    </>
  );
}

export default MarketOrder;