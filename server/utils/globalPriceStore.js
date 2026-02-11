class GlobalPriceStore {
    constructor() {
        this.prices = new Map();
        this.subscribers = new Set();
        this.lastRapidApiFetch = 0;
        this.RAPID_API_INTERVAL = 15 * 60 * 1000;
    }

    updatePrice(symbol, data) {
        const normalizedSymbol = symbol.toUpperCase();
        const existing = this.prices.get(normalizedSymbol) || {};

        const next = {
            ...existing,
            ...data,
            symbol: normalizedSymbol,
            lastUpdated: Date.now(),
            updatedSource: data.source || existing.source
        };

        if (data.source === 'binance') {
            const livePrice = data.price ?? data.binancePrice ?? existing.binancePrice ?? null;
            next.binancePrice = livePrice;
            next.price = livePrice ?? next.price;
            next.source = 'binance';
            next.isLive = data.isLive ?? true;
        }

        if (data.source === 'coinbase') {
            const coinbasePrice = data.price ?? data.coinbasePrice ?? existing.coinbasePrice ?? null;
            next.coinbasePrice = coinbasePrice;

            const hasBinance = existing.source === 'binance' || existing.binancePrice !== undefined;
            if (!hasBinance) {
                next.price = coinbasePrice ?? next.price;
                next.source = 'coinbase';
                next.isLive = data.isLive ?? false;
            }
        }

        if (data.source === 'rapidapi') {
            const rapidPrice = data.price ?? data.rapidPrice ?? existing.rapidPrice ?? null;
            next.rapidPrice = rapidPrice;
            next.name = next.name || data.name;
            next.rank = next.rank || data.rank;
            next.marketCap = next.marketCap || data.marketCap;
            next.change = next.change || data.change;
            next.coinData = next.coinData || data.coinData;
            const hasPreferred = existing.source === 'binance' || existing.source === 'coinbase' || existing.binancePrice !== undefined;
            if (!existing.isLive && !hasPreferred) {
                next.price = rapidPrice ?? next.price;
                next.source = existing.source || 'rapidapi';
            }
        }

        this.prices.set(normalizedSymbol, next);
        this.notifySubscribers(normalizedSymbol, next);
    }

    updatePrices(pricesObject, source) {
        Object.entries(pricesObject).forEach(([symbol, priceData]) => {
            const isObject = typeof priceData === 'object' && priceData !== null;
            this.updatePrice(symbol, {
                price: isObject ? priceData.price : priceData,
                source,
                ...(isObject ? priceData : {})
            });
        });
    }

    getPrice(symbol) {
        const normalizedSymbol = symbol.toUpperCase();
        return this.prices.get(normalizedSymbol) || null;
    }

    getAllPrices() {
        return Object.fromEntries(this.prices);
    }

    getStats() {
        const all = Array.from(this.prices.values());
        const binancePrices = all.filter((p) => p.source === 'binance').length;
        const rapidApiPrices = all.filter((p) => p.rapidPrice !== undefined && p.rapidPrice !== null).length;

        return {
            total: this.prices.size,
            binancePrices,
            rapidApiPrices,
            lastRapidApiFetch: this.lastRapidApiFetch
        };
    }

    getBatchPrices(symbols) {
        const result = {};
        symbols.forEach((symbol) => {
            const price = this.getPrice(symbol);
            if (price) {
                result[symbol.toUpperCase()] = price;
            }
        });
        return result;
    }

    shouldFetchRapidApi() {
        return Date.now() - this.lastRapidApiFetch > this.RAPID_API_INTERVAL;
    }

    markRapidApiFetched() {
        this.lastRapidApiFetch = Date.now();
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers(symbol, data) {
        this.subscribers.forEach((callback) => callback(symbol, data));
    }

    cleanup(olderThanMs = 60 * 60 * 1000) {
        const cutoff = Date.now() - olderThanMs;
        for (const [symbol, data] of this.prices.entries()) {
            if (data.lastUpdated < cutoff) {
                this.prices.delete(symbol);
            }
        }
    }
}

const globalPriceStore = new GlobalPriceStore();

setInterval(() => {
    globalPriceStore.cleanup();
}, 60 * 60 * 1000);

module.exports = globalPriceStore;
