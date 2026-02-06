const express = require('express');
const axios = require('axios');
const { FusionSDK, NetworkEnum, PrivateKeyProviderConnector } = require('@1inch/fusion-sdk');
const { ethers } = require('ethers');
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { Sdk, Address, FusionSwapContract } = require('@1inch/solana-fusion-sdk');
const bs58 = require('bs58');

const router = express.Router();

const API_KEY = process.env.ONEINCH_API_KEY || process.env.API_KEY || '';
const INFURA_PRIVATE_KEY = process.env.INFURA_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || '';
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY || '';
const FUSION_BASE_URL = process.env.ONEINCH_FUSION_BASE_URL || 'https://api.1inch.com/fusion';
const DEFAULT_EVM_RPC_URL = process.env.ONEINCH_EVM_RPC_URL || 'https://api.1inch.com/web3/1';
const SOLANA_RPC_URL = process.env.ONEINCH_SOLANA_RPC_URL || 'https://api.1inch.com/web3/501';
const AGGREGATION_ROUTER_V6 = process.env.AGGREGATION_ROUTER_V6 || '0x111111125421ca6dc452d289314280a0f8842a65';

const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

// Enhanced Helper function to build Infura RPC URL based on chain
const getInfuraRpcUrl = (chain) => {
    if (!INFURA_PRIVATE_KEY) {
        console.warn('No INFURA_PRIVATE_KEY found, using default RPC');
        return DEFAULT_EVM_RPC_URL;
    }
    
    // Comprehensive chain mapping that supports multiple formats
    const chainEndpoints = {
        // Your frontend chain keys (from ChainContext)
        'ethereum': 'https://mainnet.infura.io/v3/',
        'bnb': 'https://bsc-mainnet.infura.io/v3/', // Your BNB key maps to BSC
        'polygon': 'https://polygon-mainnet.infura.io/v3/',
        'avalanche': 'https://avalanche-mainnet.infura.io/v3/',
        'arbitrum': 'https://arbitrum-mainnet.infura.io/v3/',
        
        // Common alternative names
        'eth': 'https://mainnet.infura.io/v3/',
        'bsc': 'https://bsc-mainnet.infura.io/v3/',
        'binance': 'https://bsc-mainnet.infura.io/v3/',
        'matic': 'https://polygon-mainnet.infura.io/v3/',
        'avax': 'https://avalanche-mainnet.infura.io/v3/',
        'arbitrum-one': 'https://arbitrum-mainnet.infura.io/v3/',
        
        // Chain IDs (from your ChainContext)
        '1': 'https://mainnet.infura.io/v3/',
        '56': 'https://bsc-mainnet.infura.io/v3/',
        '137': 'https://polygon-mainnet.infura.io/v3/',
        '43114': 'https://avalanche-mainnet.infura.io/v3/',
        '42161': 'https://arbitrum-mainnet.infura.io/v3/',
        
        // Additional supported chains
        'optimism': 'https://optimism-mainnet.infura.io/v3/',
        '10': 'https://optimism-mainnet.infura.io/v3/',
        'base': 'https://base-mainnet.infura.io/v3/',
        '8453': 'https://base-mainnet.infura.io/v3/',
    };
    
    if (!chain) {
        console.warn('No chain specified, using default Ethereum RPC');
        return `${chainEndpoints['ethereum']}${INFURA_PRIVATE_KEY}`;
    }
    
    const chainKey = String(chain).toLowerCase();
    
    if (chainEndpoints[chainKey]) {
        const rpcUrl = `${chainEndpoints[chainKey]}${INFURA_PRIVATE_KEY}`;
        console.log(`Using Infura RPC for chain "${chain}": ${chainEndpoints[chainKey]}...`);
        return rpcUrl;
    }
    
    console.warn(`Chain "${chain}" not found in Infura endpoints, using default`);
    return DEFAULT_EVM_RPC_URL;
};

const getNetworkEnum = (networkId) => {
    switch (String(networkId)) {
        case '1':
            return NetworkEnum.ETHEREUM;
        case '56':
            return NetworkEnum.BINANCE;
        case '137':
            return NetworkEnum.POLYGON;
        case '10':
            return NetworkEnum.OPTIMISM;
        case '42161':
            return NetworkEnum.ARBITRUM;
        case '43114':
            return NetworkEnum.AVALANCHE;
        case '8453':
            return NetworkEnum.BASE;
        default:
            return NetworkEnum.ETHEREUM;
    }
};

// Enhanced createEvmSdk to handle chain mapping properly
const createEvmSdk = (networkId, chain = null) => {
    if (!API_KEY) throw new Error('Missing ONEINCH_API_KEY');
    if (!INFURA_PRIVATE_KEY) throw new Error('Missing INFURA_PRIVATE_KEY');

    // Determine which chain identifier to use for RPC
    const chainForRpc = chain || String(networkId);
    const rpcUrl = getInfuraRpcUrl(chainForRpc);
    
    console.log(`Creating EVM SDK for networkId: ${networkId}, chain: ${chain}, using RPC: ${rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]')}`);
    
    const fetchReq = new ethers.FetchRequest(rpcUrl);
    fetchReq.setHeader('Authorization', `Bearer ${API_KEY}`);
    const provider = new ethers.JsonRpcProvider(fetchReq, Number(networkId || 1), { staticNetwork: true });
    const wallet = new ethers.Wallet(INFURA_PRIVATE_KEY, provider);

    const sdk = new FusionSDK({
        url: FUSION_BASE_URL,
        network: getNetworkEnum(networkId || '1'),
        blockchainProvider: new PrivateKeyProviderConnector(INFURA_PRIVATE_KEY, {
            eth: { call: (tx) => provider.call(tx) },
            extend() {}
        }),
        authKey: API_KEY
    });

    return { sdk, wallet, provider, rpcUrl };
};

const decodeSolanaKey = (secret) => {
    let secretKey;
    try {
        secretKey = bs58.decode(secret);
    } catch (error) {
        secretKey = Buffer.from(secret, 'base64');
    }

    if (secretKey.length === 32) return Keypair.fromSeed(secretKey);
    if (secretKey.length === 64) return Keypair.fromSecretKey(secretKey);
    throw new Error(`Invalid SOLANA_PRIVATE_KEY length: ${secretKey.length}`);
};

const createSolanaSdk = () => {
    if (!API_KEY) throw new Error('Missing ONEINCH_API_KEY');
    if (!SOLANA_PRIVATE_KEY) throw new Error('Missing SOLANA_PRIVATE_KEY');

    const connection = new Connection(SOLANA_RPC_URL, {
        commitment: 'confirmed',
        httpHeaders: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : undefined
    });

    const wallet = decodeSolanaKey(SOLANA_PRIVATE_KEY);

    const sdk = new Sdk(
        {
            async get(url, headers) {
                return (await axios.get(url, { headers })).data;
            },
            async post(url, data, headers) {
                return (await axios.post(url, data, { headers })).data;
            }
        },
        { baseUrl: FUSION_BASE_URL, authKey: API_KEY, version: 'v1.0' }
    );

    return { sdk, connection, wallet };
};

// Enhanced routes with better chain handling
router.post('/evm/quote', async (req, res) => {
    try {
        const { fromTokenAddress, toTokenAddress, amount, networkId = '1', chain = null } = req.body || {};
        
        console.log('[fusion][evm][quote][request]', {
            fromTokenAddress,
            toTokenAddress,
            amount,
            networkId,
            chain,
            timestamp: new Date().toISOString()
        });
        
        if (!fromTokenAddress || !toTokenAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'fromTokenAddress, toTokenAddress, and amount are required'
            });
        }

        // Use the chain parameter if provided, otherwise use networkId
        const chainKey = chain || networkId;
        const { sdk, wallet, rpcUrl } = createEvmSdk(networkId, chainKey);
        
        const quote = await sdk.getQuote({
            fromTokenAddress,
            toTokenAddress,
            amount: String(amount),
            walletAddress: wallet.address
        });

        console.log('[fusion][evm][quote][response]', {
            success: true,
            networkId,
            chain: chainKey,
            walletAddress: wallet.address,
            rpcUrl: rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]'),
            timestamp: new Date().toISOString()
        });

        return res.json({
            success: true,
            data: quote,
            walletAddress: wallet.address,
            chain: chainKey,
            networkId,
            rpcUrl: rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]') // Redacted for security
        });
    } catch (error) {
        console.error('[fusion] evm quote error', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.stack
        });
    }
});

router.post('/evm/submit', async (req, res) => {
    try {
        const { fromTokenAddress, toTokenAddress, amount, networkId = '1', chain = null } = req.body || {};
        
        console.log('[fusion][evm][submit][request]', {
            fromTokenAddress,
            toTokenAddress,
            amount,
            networkId,
            chain,
            timestamp: new Date().toISOString()
        });
        
        if (!fromTokenAddress || !toTokenAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'fromTokenAddress, toTokenAddress, and amount are required'
            });
        }

        const chainKey = chain || networkId;
        const { sdk, wallet, provider, rpcUrl } = createEvmSdk(networkId, chainKey);

        // Check and set allowance if needed
        const token = new ethers.Contract(fromTokenAddress, ERC20_ABI, wallet);
        const allowance = await token.allowance(wallet.address, AGGREGATION_ROUTER_V6);
        if (allowance < BigInt(amount)) {
            console.log(`Insufficient allowance: ${allowance.toString()}, approving ${amount}`);
            const approveTx = await token.approve(AGGREGATION_ROUTER_V6, String(amount));
            await approveTx.wait();
            console.log('Approval transaction confirmed');
        }

        const params = {
            fromTokenAddress,
            toTokenAddress,
            amount: String(amount),
            walletAddress: wallet.address
        };

        const order = await sdk.createOrder(params);
        const result = await sdk.submitOrder(order.order, order.quoteId);

        console.log('[fusion][evm][submit][response]', {
            success: true,
            orderHash: result.orderHash,
            networkId,
            chain: chainKey,
            walletAddress: wallet.address,
            rpcUrl: rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]'),
            timestamp: new Date().toISOString()
        });

        return res.json({
            success: true,
            data: {
                orderHash: result.orderHash,
                walletAddress: wallet.address
            },
            chain: chainKey,
            networkId,
            rpcUrl: rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]')
        });
    } catch (error) {
        console.error('[fusion] evm submit error', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.stack
        });
    }
});

router.post('/evm/status', async (req, res) => {
    try {
        const { orderHash, networkId = '1', chain = null } = req.body || {};
        
        console.log('[fusion][evm][status][request]', { 
            orderHash, 
            networkId, 
            chain,
            timestamp: new Date().toISOString()
        });
        
        if (!orderHash) {
            return res.status(400).json({
                success: false,
                error: 'orderHash is required'
            });
        }

        const chainKey = chain || networkId;
        const { sdk, rpcUrl } = createEvmSdk(networkId, chainKey);
        const status = await sdk.getOrderStatus(orderHash);

        console.log('[fusion][evm][status][response]', {
            status,
            networkId,
            chain: chainKey,
            rpcUrl: rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]'),
            timestamp: new Date().toISOString()
        });

        return res.json({
            success: true,
            data: status,
            chain: chainKey,
            networkId,
            rpcUrl: rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]')
        });
    } catch (error) {
        console.error('[fusion] evm status error', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.stack
        });
    }
});

// Enhanced RPC info endpoint
router.get('/evm/rpc-info/:chain', async (req, res) => {
    try {
        const { chain } = req.params;
        const rpcUrl = getInfuraRpcUrl(chain);
        
        const supportedChains = [
            // Your frontend chain keys
            'ethereum', 'bnb', 'polygon', 'avalanche', 'arbitrum',
            // Common alternatives
            'eth', 'bsc', 'binance', 'matic', 'avax',
            // Chain IDs
            '1', '56', '137', '43114', '42161',
            // Additional chains
            'optimism', '10', 'base', '8453'
        ];
        
        return res.json({
            success: true,
            chain,
            rpcUrl: rpcUrl.replace(INFURA_PRIVATE_KEY, '[REDACTED]'),
            supportedChains,
            hasInfuraKey: !!INFURA_PRIVATE_KEY,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[fusion] rpc info error', error.message);
        return res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.stack
        });
    }
});

// Debug endpoint to test chain mapping
router.get('/debug/chain-mapping', async (req, res) => {
    const testChains = [
        'ethereum', 'bnb', 'polygon', 'avalanche', 'arbitrum',
        '1', '56', '137', '43114', '42161'
    ];
    
    const results = testChains.map(chain => ({
        chain,
        rpcUrl: getInfuraRpcUrl(chain).replace(INFURA_PRIVATE_KEY, '[REDACTED]'),
        networkId: chain, // For display
        supported: true
    }));
    
    return res.json({
        success: true,
        chainMapping: results,
        hasInfuraKey: !!INFURA_PRIVATE_KEY,
        infuraKeyLength: INFURA_PRIVATE_KEY ? INFURA_PRIVATE_KEY.length : 0
    });
});

// Solana routes remain unchanged
router.post('/solana/quote', async (req, res) => {
    try {
        const { srcToken, dstToken, amount } = req.body || {};
        console.log('[fusion][solana][quote][request]', { srcToken, dstToken, amount });
        if (!srcToken || !dstToken || !amount) {
            return res.status(400).json({
                success: false,
                error: 'srcToken, dstToken, and amount are required'
            });
        }

        const { sdk, wallet } = createSolanaSdk();
        const makerAddress = Address.fromPublicKey(wallet.publicKey);
        const fromToken = srcToken === 'NATIVE' ? Address.NATIVE : new Address(srcToken);
        const toToken = dstToken === 'NATIVE' ? Address.NATIVE : new Address(dstToken);

        const order = await sdk.createOrder(fromToken, toToken, BigInt(amount), makerAddress);

        console.log('[fusion][solana][quote][response]', {
            orderHash: order.getOrderHashBase58(),
            srcToken,
            dstToken,
            amount: String(amount)
        });

        return res.json({
            success: true,
            data: {
                orderHash: order.getOrderHashBase58(),
                srcToken,
                dstToken,
                amount: String(amount)
            }
        });
    } catch (error) {
        console.error('[fusion] solana quote error', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/solana/submit', async (req, res) => {
    try {
        const { srcToken, dstToken, amount, srcTokenProgram } = req.body || {};
        console.log('[fusion][solana][submit][request]', { srcToken, dstToken, amount, srcTokenProgram });
        if (!srcToken || !dstToken || !amount) {
            return res.status(400).json({
                success: false,
                error: 'srcToken, dstToken, and amount are required'
            });
        }

        const { sdk, connection, wallet } = createSolanaSdk();

        const makerAddress = Address.fromPublicKey(wallet.publicKey);
        const fromToken = srcToken === 'NATIVE' ? Address.NATIVE : new Address(srcToken);
        const toToken = dstToken === 'NATIVE' ? Address.NATIVE : new Address(dstToken);

        const order = await sdk.createOrder(fromToken, toToken, BigInt(amount), makerAddress);

        const contract = FusionSwapContract.default();
        const instruction = contract.create(order, {
            maker: makerAddress,
            srcTokenProgram: srcTokenProgram === 'TOKEN_2022'
                ? Address.TOKEN_2022_PROGRAM_ID
                : Address.TOKEN_PROGRAM_ID
        });

        const tx = new Transaction().add({
            programId: new PublicKey(instruction.programId.toBuffer()),
            keys: instruction.accounts.map((account) => ({
                pubkey: new PublicKey(account.pubkey.toBuffer()),
                isSigner: account.isSigner,
                isWritable: account.isWritable
            })),
            data: Buffer.from(instruction.data)
        });

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = wallet.publicKey;
        tx.sign(wallet);

        const signature = await connection.sendRawTransaction(tx.serialize());

        console.log('[fusion][solana][submit][response]', {
            orderHash: order.getOrderHashBase58(),
            signature,
            maker: wallet.publicKey.toBase58()
        });

        return res.json({
            success: true,
            data: {
                orderHash: order.getOrderHashBase58(),
                signature,
                maker: wallet.publicKey.toBase58()
            }
        });
    } catch (error) {
        console.error('[fusion] solana submit error', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/solana/status', async (req, res) => {
    try {
        const { orderHash, signature } = req.body || {};
        console.log('[fusion][solana][status][request]', { orderHash, signature });
        if (!orderHash && !signature) {
            return res.status(400).json({
                success: false,
                error: 'orderHash or signature is required'
            });
        }

        const { sdk, connection } = createSolanaSdk();

        if (orderHash) {
            const status = await sdk.getOrderStatus(orderHash);
            console.log('[fusion][solana][status][response]', status);
            return res.json({
                success: true,
                data: status
            });
        }

        const { value } = await connection.getSignatureStatuses([signature]);
        console.log('[fusion][solana][status][response]', value?.[0] || null);
        return res.json({
            success: true,
            data: value?.[0] || null
        });
    } catch (error) {
        console.error('[fusion] solana status error', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;