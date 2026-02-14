import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext'; // Add this import
import './token-chart.css';

const SCRIPT_ID = 'tradingview-widget-script';

function TradingViewChart({ symbol, interval = 'D' }) { // Remove theme prop
	const { tradingViewTheme } = useTheme(); // Get theme directly from context
	const containerIdRef = useRef(`tradingview_${Math.random().toString(36).slice(2)}`);
	const widgetRef = useRef(null);

	useEffect(() => {
		if (!symbol || typeof window === 'undefined') return;

		// Clean up existing widget before creating a new one
		if (widgetRef.current) {
			try {
				widgetRef.current.remove();
			} catch (e) {
				console.log('Widget cleanup:', e);
			}
			widgetRef.current = null;
		}

		const createWidget = () => {
			if (!window.TradingView || !document.getElementById(containerIdRef.current)) return;

			// Clear container first
			const container = document.getElementById(containerIdRef.current);
			if (container) {
				container.innerHTML = '';
			}

			// Create new widget with theme from context
			widgetRef.current = new window.TradingView.widget({
				autosize: true,
				symbol,
				interval,
				timezone: 'Etc/UTC',
				theme: tradingViewTheme, // Use theme from context
				style: '1',
				locale: 'en',
				toolbar_bg: tradingViewTheme === 'dark' ? '#151a23' : '#f1f3f6',
				enable_publishing: false,
				allow_symbol_change: true,
				withdateranges: true,
				hide_side_toolbar: false,
				details: true,
				hotlist: true,
				calendar: true,
				container_id: containerIdRef.current,
				studies: [
					"RSI@tv-basicstudies",
					"MACD@tv-basicstudies"
				],
				loading_screen: {
					backgroundColor: tradingViewTheme === 'dark' ? '#151a23' : '#ffffff',
					foregroundColor: tradingViewTheme === 'dark' ? '#9aa4b2' : '#64748b'
				},
				overrides: {
					// Make chart colors match theme
					"paneProperties.background": tradingViewTheme === 'dark' ? '#151a23' : '#ffffff',
					"paneProperties.vertGridProperties.color": tradingViewTheme === 'dark' ? '#2a3242' : '#e2e8f0',
					"paneProperties.horzGridProperties.color": tradingViewTheme === 'dark' ? '#2a3242' : '#e2e8f0',
					"scalesProperties.textColor": tradingViewTheme === 'dark' ? '#9aa4b2' : '#64748b',
				}
			});
		};

		if (document.getElementById(SCRIPT_ID)) {
			createWidget();
			return undefined;
		}

		const script = document.createElement('script');
		script.id = SCRIPT_ID;
		script.src = 'https://s3.tradingview.com/tv.js';
		script.type = 'text/javascript';
		script.async = true;
		script.onload = createWidget;
		document.head.appendChild(script);

		return () => {
			if (widgetRef.current) {
				try {
					widgetRef.current.remove();
				} catch (e) {
					console.log('Widget cleanup on unmount:', e);
				}
				widgetRef.current = null;
			}
			
			const container = document.getElementById(containerIdRef.current);
			if (container) {
				container.innerHTML = '';
			}
		};
	}, [symbol, interval, tradingViewTheme]); // Add tradingViewTheme to dependency array

	return (
		<div 
			className={`tradingview-container ${tradingViewTheme === 'dark' ? 'theme-dark' : 'theme-light'}`} 
			id={containerIdRef.current} 
			style={{ width: '100%', height: '100%', minHeight: '400px' }}
		/>
	);
}

export default TradingViewChart;