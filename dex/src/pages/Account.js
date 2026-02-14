import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import { Card } from "antd";
import { UserOutlined } from "@ant-design/icons";
import millify from "millify";
import "./Account.css";
import { useRapidApi } from '../contexts/RapidApiContext';
import { useGlobalPrices } from '../contexts/GlobalPriceContext';
import { useTokens } from '../contexts/TokenContext';
import { useChainContext } from '../contexts/ChainContext';
import { useUserContext } from '../contexts/UserContext';




function Account(props) {
  const {address} = props
  const [balance, setBalance] = useState();
  const [nativeBalance, setNativeBalance] = useState(null);
  const [totalHoldingsValue, setTotalHoldingsValue] = useState(''); 
  const navigate = useNavigate();
  const { coins: rapidCoins } = useRapidApi();
  const { prices: globalPrices } = useGlobalPrices();
  const { dbTokens } = useTokens();
  const { selectedChain, availableChains } = useChainContext();
  const { watchlist } = useUserContext();
  // const { cryptoDetails } = useEthereum();
  const cryptos = useMemo(() => rapidCoins || [], [rapidCoins]);
  const [ holdings, setHoldings ] = useState({
    tokenAddress: [],
    amount: []
  })

  const chainLabel = availableChains.find((item) => item.id === String(selectedChain))?.label || 'Chain';
  const lastLoggedAddressRef = useRef(null);

// Get Holidings amounts and then runs getUUID() and calculateTotalValue()

const normalizeAddress = (value) => {
  if (!value) return '';
  return value.toString().trim().toLowerCase();
};

const normalizeAddresses = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }
  return raw || {};
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

const chainKeyMap = {
  '1': ['ethereum'],
  '56': ['bnb', 'bsc'],
  '137': ['polygon'],
  '43114': ['avalanche'],
  '42161': ['arbitrum'],
  '501': ['solana']
};

const getTokenKey = (token) => {
  if (!token) return '';
  return token.uuid || token.id || token.symbol || '';
};

const getTokenAddressForChain = useCallback((token) => {
  const chainId = String(selectedChain || '');
  const chainKey = availableChains.find((chain) => chain.id === chainId)?.key;
  const addresses = normalizeAddresses(token?.addresses);

  return (
    addresses?.[chainId] ||
    addresses?.[chainKey] ||
    token?.address ||
    token?.contract_address ||
    null
  );
}, [selectedChain, availableChains]);

const calculateTotalValue = useCallback((rows) => {
  let totalValue = 0;
  rows.forEach((row) => {
    const amount = parseFloat(row?.amount || 0);
    const price = parseFloat(row?.price || 0);
    if (!Number.isNaN(amount) && !Number.isNaN(price)) {
      totalValue += amount * price;
    }
  });
  return totalValue.toFixed(2);
}, []);

const isValidEthAddress = (value) => /^0x[a-f0-9]{40}$/i.test(value || "");

useEffect(() => {
  const tokenHoldings = async () => {
    if (address && address !== lastLoggedAddressRef.current) {
      console.log('[account] wallet address', address, 'chain', selectedChain);
      lastLoggedAddressRef.current = address;
    }
    if (!address || !isValidEthAddress(address)) {
      if (address) {
        console.warn("Invalid wallet address for holdings:", address);
      }
      setHoldings({ tokenAddress: [], amount: [] });
      setNativeBalance(null);
      return;
    }
    try {
      const response = await fetch(`/api/infura/holdings?address=${address}&chainId=${selectedChain}`);
      const data = await response.json();

      console.log('[account] infura holdings response', data);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch holdings');
      }

      const holdingsList = data?.holdings || [];
      const holdingsAddresses = holdingsList.map((item) => item.address);
      const holdingsAmount = holdingsList.map((item) => item.balance);

      const newHoldings = { tokenAddress: holdingsAddresses, amount: holdingsAmount };
      setHoldings(newHoldings);
      setNativeBalance(data?.nativeBalance?.balance || null);
    } catch (error) {
      console.error('Error fetching token holdings:', error);
      setHoldings({ tokenAddress: [], amount: [] });
      setNativeBalance(null);
    }
  };

  tokenHoldings();
}, [address, selectedChain]);


useEffect(() => {
  if (!nativeBalance) {
    setBalance('—');
    return;
  }

  const balanceValue = parseFloat(nativeBalance);
  // const price = cryptoDetails?.price ? parseFloat(cryptoDetails.price) : null;
  const price = 500; // Placeholder price, replace with actual price from context or API
  const label = chainLabel || 'Chain';

  if (Number.isNaN(balanceValue)) {
    setBalance('—');
    return;
  }

  if (price) {
    const balanceInUsd = balanceValue * price;
    setBalance(`${balanceValue.toFixed(5)} ${label} ($${balanceInUsd.toFixed(2)})`);
  } else {
    setBalance(`${balanceValue.toFixed(5)} ${label}`);
  }
}, [nativeBalance,//cryptoDetails,
  chainLabel]);

  const rapidBySymbol = useMemo(() => {
    const map = {};
    (cryptos || []).forEach((coin) => {
      if (coin?.symbol) {
        map[coin.symbol.toUpperCase()] = coin;
      }
    });
    return map;
  }, [cryptos]);

  const amountByAddress = useMemo(() => {
    const map = new Map();
    (holdings?.tokenAddress || []).forEach((addr, index) => {
      const amount = holdings?.amount?.[index];
      if (addr && amount !== undefined) {
        map.set(normalizeAddress(addr), amount);
      }
    });
    return map;
  }, [holdings]);

  const holdingsRows = useMemo(() => {
    const rows = [];
    (dbTokens || []).forEach((token) => {
      const address = normalizeAddress(getTokenAddressForChain(token));
      if (!address || !amountByAddress.has(address)) return;

      const amount = amountByAddress.get(address);
      const symbolKey = token?.symbol?.toUpperCase();
      const rapidCoin = symbolKey ? rapidBySymbol[symbolKey] : null;
      const priceEntry = symbolKey ? globalPrices?.[symbolKey] : null;

      const binancePrice = priceEntry?.binancePrice ?? null;
      const coinbasePrice = priceEntry?.coinbasePrice ?? null;
      const rapidPrice = priceEntry?.rapidPrice ?? (rapidCoin?.price ? parseFloat(rapidCoin.price) : null);
      const resolvedPrice = binancePrice ?? coinbasePrice ?? rapidPrice ?? null;

      const resolvedMarketCap =
        priceEntry?.marketCap ??
        priceEntry?.coinData?.marketCap ??
        rapidCoin?.marketCap ??
        null;

      const resolvedChange =
        priceEntry?.change ??
        priceEntry?.coinData?.change ??
        rapidCoin?.change ??
        null;

      rows.push({
        ...token,
        amount,
        price: resolvedPrice,
        marketCap: resolvedMarketCap,
        change: resolvedChange,
        rapidCoin
      });
    });
    return rows;
  }, [dbTokens, amountByAddress, rapidBySymbol, globalPrices, getTokenAddressForChain]);

  const watchlistTokens = useMemo(() => {
    if (!Array.isArray(watchlist) || watchlist.length === 0) return [];
    const chainKey = String(selectedChain || '');
    const aliasKeys = chainKeyMap[chainKey] || [];

    return (dbTokens || [])
      .filter((token) => {
        const tokenKey = getTokenKey(token);
        if (!tokenKey || !watchlist.includes(tokenKey)) return false;
        const chains = normalizeChains(token?.chains);
        return !!(chains?.[chainKey] || aliasKeys.some((key) => chains?.[key]));
      })
      .map((token) => {
        const symbolKey = token?.symbol?.toUpperCase();
        const rapidCoin = symbolKey ? rapidBySymbol[symbolKey] : null;
        const priceEntry = symbolKey ? globalPrices?.[symbolKey] : null;
        const binancePrice = priceEntry?.binancePrice ?? null;
        const coinbasePrice = priceEntry?.coinbasePrice ?? null;
        const rapidPrice = priceEntry?.rapidPrice ?? (rapidCoin?.price ? parseFloat(rapidCoin.price) : null);
        const resolvedPrice = binancePrice ?? coinbasePrice ?? rapidPrice ?? null;

        const resolvedMarketCap =
          priceEntry?.marketCap ??
          priceEntry?.coinData?.marketCap ??
          rapidCoin?.marketCap ??
          null;

        return {
          ...token,
          price: resolvedPrice,
          marketCap: resolvedMarketCap,
          rapidCoin
        };
      });
  }, [watchlist, dbTokens, selectedChain, rapidBySymbol, globalPrices]);

  useEffect(() => {
    const calculatedTotalValue = calculateTotalValue(holdingsRows);
    setTotalHoldingsValue(calculatedTotalValue);
  }, [holdingsRows, calculateTotalValue]);

return (
  <div className="accountsPage">
    <div className="account-top-bar">
      <h1 className="account-title">Account</h1>
      <button
        className="account-settings-button"
        onClick={() => navigate("/account/settings")}
        aria-label="Account settings"
        title="Account settings"
      >
        <UserOutlined style={{ fontSize: '24px' }} />
      </button>
    </div>
    <h1 className="heading">Total Holdings: ${totalHoldingsValue}</h1>
    <h1 className="heading">Buying Power: {balance}</h1>
    <h1 className="heading">Holdings</h1>
    <div className="column-title">
      <span className="column-title-heading">Tokens</span>
      <span className="column-title-heading">Market Cap</span>
      <span className="column-title-heading">Price</span>
      <span className="column-title-heading">Amount</span>
      <span className="column-title-heading"></span>
    </div>
    <div>
      {holdingsRows.length > 0 ? (
        holdingsRows
          .filter((token) => token.uuid !== "Mtfb0obXVh59u")
          .map((token, index) => (
            <div key={index}>
  <Card className="daoCard">
    <div className="cardContainer">
      <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chainLabel}`)}>
        <img
          className="logo"
          src={token.iconUrl || token.image || token.logo_url || token?.rapidCoin?.iconUrl}
          alt="noLogo"
        />
        <div style={{ float: "right" }}>
          <h4 className="name">{token.name}</h4>
          <span className="symbol">{token.symbol}</span>
        </div>
      </div>
      <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chainLabel}`)} className="type">
        {token.marketCap == null ? "--" : millify(token.marketCap)}
      </div>
      <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chainLabel}`)} className="lastPrice">
        {token.price == null ? "--" : millify(token.price)}
      </div>
      <div className="lastPrice">
        {token.amount == null ? "--" : token.amount}
      </div>
      <div className="watchlist-placeholder" />
    </div>
  </Card>
</div>

          ))
      ) : (
        <div>
        <p>No token holdings!</p>
      {/* Watchlist loader placeholder */}
        </div>
      )}
    </div>
    <h1 className="heading">Watchlist</h1>
    <div className="column-title">
      <span className="column-title-heading">Tokens</span>
      <span className="column-title-heading">Market Cap</span>
      <span className="column-title-heading">Price</span>
      <span className="column-title-heading"></span>
    </div>
    <div>
      {watchlistTokens.length > 0 ? (
        watchlistTokens.map((token, index) => (
          <div key={token.uuid || token.symbol || index}>
            <Card className="daoCard">
              <div className="cardContainer">
                <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chainLabel}`)}>
                  <img
                    className="logo"
                    src={token.iconUrl || token.image || token.logo_url || token?.rapidCoin?.iconUrl}
                    alt="noLogo"
                  />
                  <div style={{ float: "right" }}>
                    <h4 className="name">{token.name}</h4>
                    <span className="symbol">{token.symbol}</span>
                  </div>
                </div>
                <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chainLabel}`)} className="type">
                  {token.marketCap == null ? "--" : millify(token.marketCap)}
                </div>
                <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chainLabel}`)} className="lastPrice">
                  {token.price == null ? "--" : millify(token.price)}
                </div>
              </div>
            </Card>
          </div>
        ))
      ) : (
        <div>
          <p>No watchlist tokens yet.</p>
        </div>
      )}
    </div>
  </div>
);
}

export default Account