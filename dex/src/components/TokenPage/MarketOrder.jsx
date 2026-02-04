import React, { useCallback, useEffect, useMemo, useState, useContext } from 'react';
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

const toBaseUnits = (value, decimals) => {
	const safeValue = Number(value);
	if (!Number.isFinite(safeValue) || safeValue <= 0) return '0';
	const [whole, fraction = ''] = safeValue.toString().split('.');
	const padded = `${fraction}${'0'.repeat(decimals)}`.slice(0, decimals);
	return `${whole}${padded}`.replace(/^0+(?=\d)/, '') || '0';
};

const getChainTokenAddress = (token, chainId, chainKey) => {
	if (!token) return null;
	const raw = token.addresses || token.chains || {};
	const chains = typeof raw === 'string' ? (() => {
		try {
			return JSON.parse(raw);
		} catch (e) {
			return {};
		}
	})() : raw;

	if (chainKey && chains?.[chainKey]) return chains[chainKey];

	const keys = chainKeyMap[String(chainId)] || [];
	for (const key of keys) {
		if (chains?.[key]) return chains[key];
	}
	return null;
};

function MarketOrder(props) {
	const { address, usdPrice, tokenName, symbol, decimals } = props;
	const { selectedChain, setSelectedChain, getChainLabel, availableChains } = useChainContext();
	const globalPrices = useContext(GlobalPriceContext);
	const getPrice = globalPrices?.getPrice;
	const { dbTokens, jsonTokens } = useTokens();
	const [messageApi, contextHolder] = message.useMessage();
	const [amount, setAmount] = useState('');
	const [slippage, setSlippage] = useState(2.5);
	const [checked, setChecked] = useState('usd');
	const [activeOrder, setActiveOrder] = useState(null);

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

	const chainId = String(selectedChain || '1');
	const selectedChainKey = (availableChains || []).find((chain) => chain.id === chainId)?.key || null;
	const isSolana = chainId === '501';
	const tokenAddress = getChainTokenAddress(tokenObject, chainId, selectedChainKey);
	const nativeSymbol = chainNativeSymbolMap[chainId] || 'ETH';
	const nativeDecimals = chainNativeDecimalsMap[chainId] || 18;
	const nativePrice = getPrice ? getPrice(nativeSymbol)?.price : null;
	const tokenUsdPrice = Number(usdPrice) || null;

	const handleSlippageChange = (e) => {
		setSlippage(e.target.value);
	};

	const resolveAmount = useCallback((isBuy) => {
		const numericAmount = Number(amount);
		if (!Number.isFinite(numericAmount) || numericAmount <= 0) return '0';

		if (isBuy) {
			if (checked === 'native') {
				return toBaseUnits(numericAmount, nativeDecimals);
			}
			if (checked === 'usd') {
				if (!nativePrice) return '0';
				return toBaseUnits(numericAmount / nativePrice, nativeDecimals);
			}
			if (!nativePrice || !tokenUsdPrice) return '0';
			return toBaseUnits((numericAmount * tokenUsdPrice) / nativePrice, nativeDecimals);
		}

		if (checked === tokenName) {
			return toBaseUnits(numericAmount, decimals);
		}
		if (checked === 'usd') {
			if (!tokenUsdPrice) return '0';
			return toBaseUnits(numericAmount / tokenUsdPrice, decimals);
		}
		if (!nativePrice || !tokenUsdPrice) return '0';
		return toBaseUnits((numericAmount * nativePrice) / tokenUsdPrice, decimals);
	}, [amount, checked, decimals, nativeDecimals, nativePrice, tokenUsdPrice, tokenName]);

	const showError = useCallback((msg) => {
		messageApi.open({ type: 'error', content: msg });
	}, [messageApi]);

	const pollEvmStatus = useCallback((orderHash) => {
		setActiveOrder({ type: 'evm', orderHash, chainId });
	}, [chainId]);

	const pollSolanaStatus = useCallback((orderHash, signature) => {
		setActiveOrder({ type: 'solana', orderHash, signature });
	}, []);

	const fetchDexBuy = async () => {
		if (!tokenAddress) {
			showError('Token not available on the selected chain.');
			return;
		}

		const amountValue = resolveAmount(true);
		if (amountValue === '0') {
			showError('Enter a valid amount and ensure prices are available.');
			return;
		}

		if (isSolana) {
			const solQuote = await getSolanaQuote({
				srcToken: 'NATIVE',
				dstToken: tokenAddress,
				amount: amountValue
			});

			if (!solQuote?.success) {
				showError(solQuote?.error || 'Failed to fetch Solana quote.');
				return;
			}

			return showConfirmationModal(solQuote.data, amountValue, true, true);
		}

		const quoteResponse = await getEvmQuote({
			fromTokenAddress: EVM_NATIVE_ADDRESS,
			toTokenAddress: tokenAddress,
			amount: amountValue,
			networkId: chainId
		});

		if (!quoteResponse?.success) {
			showError(quoteResponse?.error || 'Failed to fetch quote.');
			return;
		}

		showConfirmationModal(quoteResponse.data, amountValue, true, false);
	};

	const fetchDexSell = async () => {
		if (!tokenAddress) {
			showError('Token not available on the selected chain.');
			return;
		}

		const amountValue = resolveAmount(false);
		if (amountValue === '0') {
			showError('Enter a valid amount and ensure prices are available.');
			return;
		}

		if (isSolana) {
			const solQuote = await getSolanaQuote({
				srcToken: tokenAddress,
				dstToken: 'NATIVE',
				amount: amountValue
			});

			if (!solQuote?.success) {
				showError(solQuote?.error || 'Failed to fetch Solana quote.');
				return;
			}

			return showConfirmationModal(solQuote.data, amountValue, false, true);
		}

		const quoteResponse = await getEvmQuote({
			fromTokenAddress: tokenAddress,
			toTokenAddress: EVM_NATIVE_ADDRESS,
			amount: amountValue,
			networkId: chainId
		});

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
					{quoteResponse && (
						<>
							<div style={{ margin: '10%' }}>
								<img className="logo" src={quoteResponse.fromToken?.logoURI} alt={quoteResponse.fromToken?.name} />
								<span>
									{quoteResponse.fromToken?.name} ({quoteResponse.fromToken?.symbol})
								</span>
								<div>Exchange from: {Number(amountValue) / 10 ** quoteResponse.fromToken?.decimals}</div>
							</div>
							<div style={{ margin: '10%' }}>
								<img className="logo" src={quoteResponse.toToken?.logoURI} alt={quoteResponse.toToken?.name} />
								<span>
									{quoteResponse.toToken?.name} ({quoteResponse.toToken?.symbol})
								</span>
								<div>Exchange to: {Number(quoteResponse.toAmount) / 10 ** quoteResponse.toToken?.decimals}</div>
							</div>
						</>
					)}
					{isSolanaFlow && (
						<div>
							<div>Amount: {amountValue}</div>
							<div>Native Token: {nativeSymbol}</div>
							{quoteResponse?.orderHash && (
								<div>Order Hash: {quoteResponse.orderHash}</div>
							)}
						</div>
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
							srcTokenProgram: 'TOKEN'
						});

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
						slippage
					});

					if (!response?.success) {
						showError(response?.error || 'Order failed.');
						return;
					}

					pollEvmStatus(response.data?.orderHash);
					messageApi.open({ type: 'loading', content: 'Order submitted...', duration: 1.5 });
				} catch (error) {
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

					const isActive = statusResponse?.data?.isActive;
					const confirmation = statusResponse?.data?.confirmationStatus;
					if (isActive === false || confirmation === 'confirmed' || confirmation === 'finalized') {
						messageApi.open({ type: 'success', content: 'Solana order completed!', duration: 2 });
						setActiveOrder(null);
					}
				}
			} catch (err) {
				// ignore polling errors
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
		<>
			<div>Slippage Tolerance</div>
			<div>
				<Radio.Group value={slippage} onChange={handleSlippageChange}>
					<Radio.Button value={0.5}>0.5%</Radio.Button>
					<Radio.Button value={2.5}>2.5%</Radio.Button>
					<Radio.Button value={5}>5.0%</Radio.Button>
				</Radio.Group>
			</div>
		</>
	);

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
						{(availableChains || []).map((chain) => (
							<option key={chain.id} value={chain.id}>
								{chain.label}
							</option>
						))}
					</select>
					<div className="check-row">
						<input
							type="checkbox"
							name="Priced in Native"
							value="native"
							checked={checked === 'native' ? checked : null}
							onChange={(e) => setChecked(e.target.value)}
						/>
						<span>Order Priced in {nativeSymbol}</span>
					</div>
					<div className="check-row">
						<input
							type="checkbox"
							name="Priced in USD"
							value="usd"
							checked={checked === 'usd' ? checked : !checked}
							onChange={(e) => setChecked(e.target.value)}
						/>
						<span>Order Priced in USD</span>
					</div>
					<div className="check-row">
						<input
							type="checkbox"
							name="Priced in Token"
							value={`${tokenName}`}
							checked={checked === tokenName ? checked : null}
							onChange={(e) => setChecked(e.target.value)}
						/>
						<span>Order Priced in {tokenName}</span>
					</div>
				</div>
				<Popover content={settings} title="settings" trigger="click" placement="bottomLeft">
					<SettingOutlined className="cog" />
				</Popover>
			</div>
			<div style={{ color: 'white', margin: '0px auto' }}>
				{getChainLabel?.(selectedChain) || 'Ethereum'} / {tokenName}
			</div>
			<input
				type="text"
				placeholder="Amount"
				className="input"
				value={amount}
				onChange={(e) => setAmount(e.target.value)}
			/>
			<div className="buttonContainer">
				<button className="buyButton" type="button" disabled={!amount || !address || loading} onClick={fetchDexBuy}>
					Buy
				</button>
				<button className="sellButton" type="button" disabled={!amount || !address || loading} onClick={fetchDexSell}>
					Sell
				</button>
			</div>
			<div style={{ color: 'lime', fontWeight: '700', margin: '0px auto', padding: '4%' }}>
				{nativeSymbol} Price per Token = {nativePrice && tokenUsdPrice ? (tokenUsdPrice / nativePrice).toFixed(6) : '--'}
			</div>
		</>
	);
}

export default MarketOrder;
