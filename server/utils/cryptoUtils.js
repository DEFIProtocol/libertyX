// This utility helps integrate RapidAPI data with your token_smart_consolidated.json data
export const mapTokenToCoinId = (token, cryptoData) => {
    if (!token || !cryptoData) return null;
    
    // Try to find matching coin by symbol or name
    const coin = cryptoData?.coins?.find(coin => 
        coin.symbol.toLowerCase() === token.symbol?.toLowerCase() ||
        coin.name.toLowerCase() === token.name?.toLowerCase() ||
        coin.uuid === token.coinId
    );
    
    return coin?.uuid || null;
};

export const enrichTokenWithCryptoData = (token, cryptoData) => {
    if (!token || !cryptoData) return token;
    
    const coinId = mapTokenToCoinId(token, cryptoData);
    const coin = cryptoData?.coins?.find(c => c.uuid === coinId);
    
    if (coin) {
        return {
            ...token,
            coinId,
            cryptoData: {
                price: coin.price,
                marketCap: coin.marketCap,
                change: coin.change,
                rank: coin.rank,
                sparkline: coin.sparkline,
                iconUrl: coin.iconUrl
            }
        };
    }
    
    return token;
};