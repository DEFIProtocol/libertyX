const express = require('express');
const axios = require('axios');
const { FusionSDK, NetworkEnum, PrivateKeyProviderConnector } = require('@1inch/fusion-sdk');
const { ethers } = require('ethers');
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { Sdk, Address, FusionSwapContract } = require('@1inch/solana-fusion-sdk');
const bs58 = require('bs58');

const router = express.Router();

const API_KEY = process.env.ONEINCH_API_KEY || process.env.API_KEY || '';
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || '';
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY || '';
const FUSION_BASE_URL = process.env.ONEINCH_FUSION_BASE_URL || 'https://api.1inch.com/fusion';
const EVM_RPC_URL = process.env.ONEINCH_EVM_RPC_URL || 'https://api.1inch.com/web3/1';
const SOLANA_RPC_URL = process.env.ONEINCH_SOLANA_RPC_URL || 'https://api.1inch.com/web3/501';
const AGGREGATION_ROUTER_V6 = process.env.AGGREGATION_ROUTER_V6 || '0x111111125421ca6dc452d289314280a0f8842a65';

const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

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
        default:
            return NetworkEnum.ETHEREUM;
    }
};

const createEvmSdk = (networkId) => {
    if (!API_KEY) throw new Error('Missing ONEINCH_API_KEY');
    if (!EVM_PRIVATE_KEY) throw new Error('Missing EVM_PRIVATE_KEY');

    const rpcUrl = process.env.ONEINCH_EVM_RPC_URL || `https://api.1inch.com/web3/${networkId || '1'}`;
    const fetchReq = new ethers.FetchRequest(rpcUrl);
    fetchReq.setHeader('Authorization', `Bearer ${API_KEY}`);
    const provider = new ethers.JsonRpcProvider(fetchReq, Number(networkId || 1), { staticNetwork: true });
    const wallet = new ethers.Wallet(EVM_PRIVATE_KEY, provider);

    const sdk = new FusionSDK({
        url: FUSION_BASE_URL,
        network: getNetworkEnum(networkId || '1'),
        blockchainProvider: new PrivateKeyProviderConnector(EVM_PRIVATE_KEY, {
            eth: { call: (tx) => provider.call(tx) },
            extend() {}
        }),
        authKey: API_KEY
    });

    return { sdk, wallet, provider };
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

router.post('/evm/quote', async (req, res) => {
    try {
        const { fromTokenAddress, toTokenAddress, amount, networkId = '1' } = req.body || {};
        if (!fromTokenAddress || !toTokenAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'fromTokenAddress, toTokenAddress, and amount are required'
            });
        }

        const { sdk, wallet } = createEvmSdk(networkId);
        const quote = await sdk.getQuote({
            fromTokenAddress,
            toTokenAddress,
            amount: String(amount),
            walletAddress: wallet.address
        });

        return res.json({
            success: true,
            data: quote,
            walletAddress: wallet.address
        });
    } catch (error) {
        console.error('[fusion] evm quote error', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/evm/submit', async (req, res) => {
    try {
        const { fromTokenAddress, toTokenAddress, amount, networkId = '1' } = req.body || {};
        if (!fromTokenAddress || !toTokenAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'fromTokenAddress, toTokenAddress, and amount are required'
            });
        }

        const { sdk, wallet } = createEvmSdk(networkId);

        const token = new ethers.Contract(fromTokenAddress, ERC20_ABI, wallet);
        const allowance = await token.allowance(wallet.address, AGGREGATION_ROUTER_V6);
        if (allowance < BigInt(amount)) {
            const approveTx = await token.approve(AGGREGATION_ROUTER_V6, String(amount));
            await approveTx.wait();
        }

        const params = {
            fromTokenAddress,
            toTokenAddress,
            amount: String(amount),
            walletAddress: wallet.address
        };

        const order = await sdk.createOrder(params);
        const result = await sdk.submitOrder(order.order, order.quoteId);

        return res.json({
            success: true,
            data: {
                orderHash: result.orderHash,
                walletAddress: wallet.address
            }
        });
    } catch (error) {
        console.error('[fusion] evm submit error', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/evm/status', async (req, res) => {
    try {
        const { orderHash, networkId = '1' } = req.body || {};
        if (!orderHash) {
            return res.status(400).json({
                success: false,
                error: 'orderHash is required'
            });
        }

        const { sdk } = createEvmSdk(networkId);
        const status = await sdk.getOrderStatus(orderHash);

        return res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('[fusion] evm status error', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/solana/quote', async (req, res) => {
    try {
        const { srcToken, dstToken, amount } = req.body || {};
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
        if (!orderHash && !signature) {
            return res.status(400).json({
                success: false,
                error: 'orderHash or signature is required'
            });
        }

        const { sdk, connection } = createSolanaSdk();

        if (orderHash) {
            const status = await sdk.getOrderStatus(orderHash);
            return res.json({
                success: true,
                data: status
            });
        }

        const { value } = await connection.getSignatureStatuses([signature]);
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