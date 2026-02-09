// BigInt JSON serialization for ethers round data
if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
    // eslint-disable-next-line no-extend-native
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
}

const axios = require('axios');
const { ethers } = require('ethers');

const INFURA_PRIVATE_KEY = process.env.INFURA_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || '';
const DEFAULT_EVM_RPC_URL = 'https://eth.llamarpc.com';
const PUBLIC_RPC_ENDPOINTS = {
    ethereum: 'https://eth.llamarpc.com',
    eth: 'https://eth.llamarpc.com',
    bsc: 'https://bsc.llamarpc.com',
    bnb: 'https://bsc.llamarpc.com',
    binance: 'https://bsc.llamarpc.com',
    polygon: 'https://polygon.llamarpc.com',
    matic: 'https://polygon.llamarpc.com',
    avalanche: 'https://avalanche.llamarpc.com',
    avax: 'https://avalanche.llamarpc.com',
    arbitrum: 'https://arbitrum.llamarpc.com',
    'arbitrum-one': 'https://arbitrum.llamarpc.com',
    optimism: 'https://optimism.llamarpc.com',
    op: 'https://optimism.llamarpc.com',
    base: 'https://base.llamarpc.com'
};

const getInfuraRpcUrl = (chain) => {
    const chainKey = String(chain || '').toLowerCase();

    if (!INFURA_PRIVATE_KEY) {
        const fallbackRpc = PUBLIC_RPC_ENDPOINTS[chainKey] || DEFAULT_EVM_RPC_URL;
        console.warn('No INFURA_PRIVATE_KEY found, using public RPC');
        return fallbackRpc;
    }

    const chainEndpoints = {
        ethereum: 'https://mainnet.infura.io/v3/',
        bnb: 'https://bsc-mainnet.infura.io/v3/',
        polygon: 'https://polygon-mainnet.infura.io/v3/',
        avalanche: 'https://avalanche-mainnet.infura.io/v3/',
        arbitrum: 'https://arbitrum-mainnet.infura.io/v3/',
        eth: 'https://mainnet.infura.io/v3/',
        bsc: 'https://bsc-mainnet.infura.io/v3/',
        binance: 'https://bsc-mainnet.infura.io/v3/',
        matic: 'https://polygon-mainnet.infura.io/v3/',
        avax: 'https://avalanche-mainnet.infura.io/v3/',
        'arbitrum-one': 'https://arbitrum-mainnet.infura.io/v3/',
        '1': 'https://mainnet.infura.io/v3/',
        '56': 'https://bsc-mainnet.infura.io/v3/',
        '137': 'https://polygon-mainnet.infura.io/v3/',
        '43114': 'https://avalanche-mainnet.infura.io/v3/',
        '42161': 'https://arbitrum-mainnet.infura.io/v3/',
        optimism: 'https://optimism-mainnet.infura.io/v3/',
        '10': 'https://optimism-mainnet.infura.io/v3/',
        base: 'https://base-mainnet.infura.io/v3/',
        '8453': 'https://base-mainnet.infura.io/v3/'
    };

    if (!chain) {
        console.warn('No chain specified, using default Ethereum RPC');
        return `${chainEndpoints.ethereum}${INFURA_PRIVATE_KEY}`;
    }

    if (chainEndpoints[chainKey]) {
        const rpcUrl = `${chainEndpoints[chainKey]}${INFURA_PRIVATE_KEY}`;
        console.log(`Using Infura RPC for chain "${chain}": ${chainEndpoints[chainKey]}...`);
        return rpcUrl;
    }

    console.warn(`Chain "${chain}" not found in Infura endpoints, using default`);
    return DEFAULT_EVM_RPC_URL;
};

class OracleService {
    constructor() {
        this.feedsDirectory = {
            ethereum: 'https://reference-data-directory.vercel.app/feeds.json?network=ethereum',
            bsc: 'https://reference-data-directory.vercel.app/feeds.json?network=bsc',
            polygon: 'https://reference-data-directory.vercel.app/feeds.json?network=polygon',
            avalanche: 'https://reference-data-directory.vercel.app/feeds.json?network=avalanche',
            arbitrum: 'https://reference-data-directory.vercel.app/feeds.json?network=arbitrum',
            optimism: 'https://reference-data-directory.vercel.app/feeds.json?network=optimism',
            base: 'https://reference-data-directory.vercel.app/feeds.json?network=base'
        };

        this.feedsCache = new Map();
        this.priceCache = new Map();
        this.cacheTTL = 60000;
    }

    resolveChain(chain) {
        const chainKey = String(chain || '').toLowerCase();
        const aliases = {
            eth: 'ethereum',
            ethereum: 'ethereum',
            bsc: 'bsc',
            bnb: 'bsc',
            binance: 'bsc',
            polygon: 'polygon',
            matic: 'polygon',
            avalanche: 'avalanche',
            avax: 'avalanche',
            arbitrum: 'arbitrum',
            'arbitrum-one': 'arbitrum',
            optimism: 'optimism',
            op: 'optimism',
            base: 'base'
        };

        return aliases[chainKey] || chainKey || 'ethereum';
    }

    normalizeFeeds(data) {
        let feeds = [];

        if (Array.isArray(data)) {
            feeds = data;
        } else if (data?.feeds && Array.isArray(data.feeds)) {
            feeds = data.feeds;
        } else if (data?.data && Array.isArray(data.data)) {
            feeds = data.data;
        } else if (data?.priceFeeds && Array.isArray(data.priceFeeds)) {
            feeds = data.priceFeeds;
        } else if (data && typeof data === 'object') {
            feeds = Object.values(data).flat().filter(Array.isArray);
            if (feeds.length === 1) {
                feeds = feeds[0];
            }
        }

        const normalized = feeds.map((feed) => {
            const proxyAddress = feed.proxyAddress || feed.proxy_address || feed.contractAddress || feed.contract_address || feed.address || feed.proxy;
            const rawPair = feed.pair || feed.name || '';
            const pair = typeof rawPair === 'string' ? rawPair : '';
            const asset = feed.asset || feed.base || feed.symbol || (pair.includes('/') ? pair.split('/')[0].trim() : null);

            return {
                ...feed,
                proxyAddress: feed.proxyAddress || proxyAddress,
                name: typeof feed.name === 'string' ? feed.name : (pair || feed.feedName || ''),
                asset: feed.asset || asset
            };
        }).filter((feed) => feed.proxyAddress);

        const usdFeeds = normalized.filter((feed) => String(feed.name || '').toUpperCase().includes('/ USD'));
        const uniqueFeeds = new Map();
        usdFeeds.forEach((feed) => {
            uniqueFeeds.set(feed.proxyAddress.toLowerCase(), feed);
        });

        return Array.from(uniqueFeeds.values());
    }

    async getFeedsByChain(chain) {
        const resolvedChain = this.resolveChain(chain);
        const cacheKey = `feeds_${resolvedChain}`;

        if (this.feedsCache.has(cacheKey)) {
            const cached = this.feedsCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) {
                return cached.data;
            }
        }

        try {
            const url = this.feedsDirectory[resolvedChain];
            if (!url) {
                console.log(`No URL for chain: ${resolvedChain}, using hardcoded feeds`);
                return this.getHardcodedFeeds(resolvedChain);
            }

            const response = await axios.get(url);
            const feeds = this.normalizeFeeds(response.data);

            console.log(`Found ${feeds.length} feeds for ${resolvedChain}`);

            this.feedsCache.set(cacheKey, {
                data: feeds,
                timestamp: Date.now()
            });

            return feeds;
        } catch (error) {
            console.error(`Error fetching feeds for ${resolvedChain}:`, error.message);
            return this.getHardcodedFeeds(resolvedChain);
        }
    }

    async getPriceByToken(chain, tokenSymbol) {
        const resolvedChain = this.resolveChain(chain);
        const cacheKey = `price_${resolvedChain}_${tokenSymbol.toLowerCase()}`;

        if (this.priceCache.has(cacheKey)) {
            const cached = this.priceCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }

        try {
            const feeds = await this.getFeedsByChain(resolvedChain);
            const feed = this.findTokenFeed(feeds, tokenSymbol);
            if (!feed) {
                console.log(`No Chainlink feed for ${tokenSymbol} on ${resolvedChain}`);
                return null;
            }

            const rpcUrl = getInfuraRpcUrl(resolvedChain);
            console.log(`Fetching Chainlink price for ${tokenSymbol} on ${resolvedChain} via ${rpcUrl.substring(0, 30)}...`);

            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const aggregator = new ethers.Contract(
                feed.proxyAddress,
                [
                    'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
                    'function decimals() view returns (uint8)'
                ],
                provider
            );

            const [roundData, decimals] = await Promise.all([
                aggregator.latestRoundData(),
                aggregator.decimals()
            ]);

            const answerBigInt = BigInt(roundData.answer.toString());
            const decimalsNum = Number(decimals);
            const price = Number(answerBigInt) / Math.pow(10, decimalsNum);

            const result = {
                chain: resolvedChain,
                token: tokenSymbol,
                price,
                feedAddress: feed.proxyAddress,
                decimals: decimalsNum,
                updatedAt: new Date(Number(roundData.updatedAt.toString()) * 1000),
                roundId: roundData.roundId.toString()
            };

            this.priceCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log(`Chainlink price for ${tokenSymbol}: $${price}`);
            return result;
        } catch (error) {
            console.error(`Error getting Chainlink price for ${tokenSymbol} on ${resolvedChain}:`, error.message);
            return null;
        }
    }

    async getBatchPrices(chain, tokenSymbols, options = {}) {
        const resolvedChain = this.resolveChain(chain);
        let symbols = Array.isArray(tokenSymbols) ? tokenSymbols : [];

        if (symbols.length === 0) {
            const feeds = await this.getFeedsByChain(resolvedChain);
            symbols = this.extractSymbolsFromFeeds(feeds, options.limit || 50);
        }

        const promises = symbols.map((symbol) => this.getPriceByToken(resolvedChain, symbol));
        const results = await Promise.all(promises);
        return results.filter((result) => result !== null);
    }

    extractSymbolsFromFeeds(feeds, limit) {
        if (!Array.isArray(feeds)) return [];

        const unique = new Set();
        for (const feed of feeds) {
            if (feed?.asset && typeof feed.asset === 'string') {
                unique.add(feed.asset.toUpperCase());
            } else if (feed?.base && typeof feed.base === 'string') {
                unique.add(feed.base.toUpperCase());
            } else if (feed?.symbol && typeof feed.symbol === 'string') {
                unique.add(feed.symbol.toUpperCase());
            } else if (typeof feed?.pair === 'string' || typeof feed?.name === 'string') {
                const pair = typeof feed?.pair === 'string' ? feed.pair : feed.name;
                const match = String(pair || '').split('/')[0].trim();
                if (match) {
                    unique.add(match.toUpperCase());
                }
            }
            if (unique.size >= limit) break;
        }

        return Array.from(unique);
    }

    findTokenFeed(feeds, tokenSymbol) {
        if (!feeds || !Array.isArray(feeds)) return null;

        const normalizedSymbol = tokenSymbol.toUpperCase();
        const patterns = [
            `${normalizedSymbol}/USD`,
            `${normalizedSymbol} / USD`,
            `${normalizedSymbol}USD`,
            `${normalizedSymbol}-USD`,
            `${normalizedSymbol}_USD`
        ];

        for (const pattern of patterns) {
            const feed = feeds.find((f) => f.name && f.name.toUpperCase().includes(pattern));
            if (feed) return feed;
        }

        return feeds.find((feed) => {
            const feedName = typeof feed.name === 'string' ? feed.name.toUpperCase() : '';
            const pair = typeof feed.pair === 'string' ? feed.pair.toUpperCase() : '';
            const asset = feed.asset?.toUpperCase() || '';
            const base = feed.base?.toUpperCase() || '';
            const symbol = feed.symbol?.toUpperCase() || '';

            return feedName.includes(normalizedSymbol) ||
                pair.includes(normalizedSymbol) ||
                asset.includes(normalizedSymbol) ||
                base.includes(normalizedSymbol) ||
                symbol.includes(normalizedSymbol) ||
                normalizedSymbol.includes(asset);
        });
    }

    getHardcodedFeeds(chain) {
        const feeds = {
            ethereum: [
                {
                    name: 'ETH / USD',
                    proxyAddress: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
                    asset: 'ETH'
                },
                {
                    name: 'BTC / USD',
                    proxyAddress: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
                    asset: 'BTC'
                },
                {
                    name: 'LINK / USD',
                    proxyAddress: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
                    asset: 'LINK'
                },
                {
                    name: 'USDC / USD',
                    proxyAddress: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
                    asset: 'USDC'
                },
                {
                    name: 'DAI / USD',
                    proxyAddress: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
                    asset: 'DAI'
                },
                {
                    name: 'AAVE / USD',
                    proxyAddress: '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9',
                    asset: 'AAVE'
                },
                {
                    name: 'UNI / USD',
                    proxyAddress: '0x553303d460EE6305aF5a3C8a85c4B27eC657E5c4',
                    asset: 'UNI'
                },
                {
                    name: 'MKR / USD',
                    proxyAddress: '0xec1D1B3b0443256cc3860e24a46F108e699484Aa',
                    asset: 'MKR'
                }
            ]
        };

        return feeds[chain] || [];
    }
}

module.exports = OracleService;
