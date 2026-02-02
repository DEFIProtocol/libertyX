const ccxt = require('ccxt');

class ExchangeService {
    constructor(configOverrides = {}) {
        this.exchanges = new Map();
        this.defaultExchange = 'binance';
        this.configs = {
            binance: {
                apiKey: process.env.BINANCE_API_KEY,
                secret: process.env.BINANCE_API_SECRET,
                enableRateLimit: true,
                timeout: 30000,
                options: { adjustForTimeDifference: true }
            },
            binanceus: {
                apiKey: process.env.BINANCE_API_KEY,
                secret: process.env.BINANCE_API_SECRET,
                enableRateLimit: true,
                timeout: 30000,
                options: { adjustForTimeDifference: true }
            },
            coinbase: {
                apiKey: process.env.COINBASE_API_KEY,
                secret: process.env.COINBASE_API_SECRET,
                enableRateLimit: true
            },
            kraken: {
                apiKey: process.env.KRAKEN_API_KEY,
                secret: process.env.KRAKEN_API_SECRET,
                enableRateLimit: true
            },
            ...configOverrides
        };
    }

    normalizeExchangeName(name = this.defaultExchange) {
        if (!name) return this.defaultExchange;
        const lowered = String(name).toLowerCase();
        if (lowered === 'binance.us') return 'binanceus';
        return lowered;
    }

    getExchange(name = this.defaultExchange) {
        const exchangeName = this.normalizeExchangeName(name);

        if (!ccxt.exchanges.includes(exchangeName)) {
            throw new Error(`Exchange ${exchangeName} not supported by CCXT`);
        }

        if (!this.exchanges.has(exchangeName)) {
            const config = this.configs[exchangeName] || { enableRateLimit: true };
            this.exchanges.set(exchangeName, new ccxt[exchangeName](config));
        }

        return this.exchanges.get(exchangeName);
    }

    async getBestPrice(symbol, quoteCurrency = 'USDT', exchangeList) {
        const exchanges = Array.isArray(exchangeList) && exchangeList.length
            ? exchangeList
            : ['binance', 'coinbase', 'kraken'];
        const prices = [];

        for (const exchangeName of exchanges) {
            try {
                const exchange = this.getExchange(exchangeName);
                const ticker = await exchange.fetchTicker(`${symbol}/${quoteCurrency}`);
                prices.push({
                    exchange: exchangeName,
                    price: ticker.last,
                    bid: ticker.bid,
                    ask: ticker.ask,
                    volume: ticker.quoteVolume,
                    timestamp: ticker.timestamp
                });
            } catch (error) {
                console.log(`Price not available on ${exchangeName}: ${error.message}`);
            }
        }

        if (prices.length === 0) {
            throw new Error(`No prices available for ${symbol}/${quoteCurrency}`);
        }

        const bestBid = prices
            .filter((item) => Number.isFinite(item.bid))
            .sort((a, b) => b.bid - a.bid)[0] || prices[0];

        return {
            bestPrice: bestBid,
            allPrices: prices,
            timestamp: Date.now()
        };
    }
}

module.exports = ExchangeService;
