import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import { Card } from "antd";
import { CheckOutlined, PlusCircleOutlined } from '@ant-design/icons';
import millify from "millify";
import { useRapidApi } from '../contexts/RapidApiContext';
import { useGlobalPrices } from '../contexts/GlobalPriceContext';
import { useTokens } from '../contexts/TokenContext';
import { useChainContext } from '../contexts/ChainContext';
// import { Loader } from "./elements";
// import { useEthereum } from "./elements";



function Account(props) {
  const {address} = props
  const [ uuid, setUuid] =useState();
  const [balance, setBalance] = useState();
  const [nativeBalance, setNativeBalance] = useState(null);
  const [ watchlist, setWatchlist] = useState();
  const [totalHoldingsValue, setTotalHoldingsValue] = useState(''); 
  const navigate = useNavigate();
  const chain = "Ethereum";
  const { coins: rapidCoins, isLoading: rapidLoading } = useRapidApi();
  const { prices: globalPrices } = useGlobalPrices();
  const { dbTokens } = useTokens();
  const { selectedChain, availableChains } = useChainContext();
  // const { cryptoDetails } = useEthereum();
  const cryptos = useMemo(() => rapidCoins || [], [rapidCoins]);
  const [ holdings, setHoldings ] = useState({
    tokenAddress: [],
    amount: []
  })

  const chainLabel = availableChains.find((item) => item.id === String(selectedChain))?.label || 'Chain';

const addToWatchlist = async (uuid) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/addToWatchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address,
        uuid: uuid,
      }),
    });
    const data = await response.json();
    console.log(data.message); // Optional: Log the response message
    // Update the watchlist state here
    setWatchlist([...watchlist, uuid]);
  } catch (error) {
    console.error('Error adding token to watchlist:', error);
  }
};

const removeFromWatchlist = async (uuid) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/removeFromWatchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address,
        uuid: uuid,
      }),
    });
    const data = await response.json();
    console.log(data.message); // Optional: Log the response message
    // Update the watchlist state here
    setWatchlist(watchlist.filter((item) => item !== uuid));
  } catch (error) {
    console.error('Error removing token from watchlist:', error);
  }
};

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

const getUUID = useCallback(async (e) => {
  const targetSet = new Set((e?.tokenAddress || []).map(normalizeAddress));
  const matches = (dbTokens || []).filter((token) => {
    const address = normalizeAddress(getTokenAddressForChain(token));
    return address && targetSet.has(address);
  });
  return matches.map((token) => token?.uuid).filter(Boolean);
}, [dbTokens, getTokenAddressForChain]);

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

useEffect(() => {
  const tokenHoldings = async () => {
    if (!address) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/infura/holdings?address=${address}&chainId=${selectedChain}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch holdings');
      }

      const holdingsList = data?.holdings || [];
      const holdingsAddresses = holdingsList.map((item) => item.address);
      const holdingsAmount = holdingsList.map((item) => item.balance);

      const newHoldings = { tokenAddress: holdingsAddresses, amount: holdingsAmount };
      setHoldings(newHoldings);
      setNativeBalance(data?.nativeBalance?.balance || null);
      getUUID(newHoldings).then((data) => {
        setUuid(data);
      });
    } catch (error) {
      console.error('Error fetching token holdings:', error);
      setHoldings({ tokenAddress: [], amount: [] });
      setNativeBalance(null);
    }
  };

  tokenHoldings();
}, [address, selectedChain, getUUID]);


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

  useEffect(() => {
    const calculatedTotalValue = calculateTotalValue(holdingsRows);
    setTotalHoldingsValue(calculatedTotalValue);
  }, [holdingsRows, calculateTotalValue]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/data?user=${address}`);
        const data = await response.json();
        console.log(data);
        const watchlistUuids = data.map((item) => item.uuid);
          setWatchlist(watchlistUuids[0]);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
  
    fetchData();
  }, [address]);


return (
  <div className="accountsPage">
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
      <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chain}`)}>
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
      <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chain}`)} className="type">
        {token.marketCap == null ? "--" : millify(token.marketCap)}
      </div>
      <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chain}`)} className="lastPrice">
        {token.price == null ? "--" : millify(token.price)}
      </div>
      <div className="lastPrice">
        {token.amount == null ? "--" : token.amount}
      </div>
      {watchlist && watchlist.includes(token?.uuid) ? (
        <CheckOutlined
          style={{ color: "lime", fontSize: "1.5em", cursor: "pointer" }}
          onClick={() => removeFromWatchlist(token?.uuid)}
        />
      ) : (
        <PlusCircleOutlined
          style={{ color: "lime", fontSize: "1.5em", cursor: "pointer" }}
          onClick={() => addToWatchlist(token?.uuid)}
        />
      )}
    </div>
  </Card>
</div>

          ))
      ) : (
        <div>
        <p>No token holdings!</p>
       {// {rapidLoading ? <Loader /> : null}
  }
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
      {(cryptos && watchlist && watchlist.length > 0) ? (
        cryptos
          .filter((token) => watchlist.includes(token.uuid))
          .map((token, index) => (
            <div key={index}>
              <Card className="daoCard">
                <div className="cardContainer">
                <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chain}`)}>
                          <img className="logo" src={token.iconUrl} alt="noLogo" />
                          <div style={{ float: "right" }}>
                            <h4 className="name">{token.name}</h4>
                            <span className="symbol">{token.symbol}</span>
                          </div>
                        </div>
                        <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chain}`)} className="type">
                            {token.marketCap == null ? "--" : millify(token.marketCap)}
                        </div>
                        <div onClick={() => navigate(`/${token?.name}/${token?.uuid}?chain=${chain}`)} className="lastPrice">
                            {token.price == null ? "--" : millify(token.price)}
                        </div>
                        {watchlist && watchlist.includes(token?.uuid) ? (
                        <CheckOutlined
                          style={{ color: "lime", fontSize: "1.5em", cursor: "pointer" }}
                          onClick={() => removeFromWatchlist(token?.uuid)}
                        />
                      ) : (
                        <PlusCircleOutlined
                          style={{ color: "lime", fontSize: "1.5em", cursor: "pointer" }}
                          onClick={() => addToWatchlist(token?.uuid)}
                        />
                      )}
                      </div>
                  </Card>
            </div>
          ))
      ) : (
        <div>
        <p>You are not watching any tokens!</p>
        {//{rapidLoading || !uuid ? <Loader /> : null}
}
        </div>
      )}
    </div>
  </div>
);
}

export default Account