import React, { useEffect, useRef } from 'react';

const SCRIPT_ID = 'tradingview-widget-script';

function TradingViewChart({ symbol, interval = 'D', theme = 'light' }) {
	const containerIdRef = useRef(`tradingview_${Math.random().toString(36).slice(2)}`);

	useEffect(() => {
		if (!symbol || typeof window === 'undefined') return;

		const createWidget = () => {
			if (!window.TradingView || !document.getElementById(containerIdRef.current)) return;

			// eslint-disable-next-line no-new
			new window.TradingView.widget({
				autosize: true,
				symbol,
				interval,
				timezone: 'Etc/UTC',
				theme,
				style: '1',
				locale: 'en',
				toolbar_bg: '#f1f3f6',
				enable_publishing: false,
				allow_symbol_change: true,
				withdateranges: true,
				container_id: containerIdRef.current,
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
			const container = document.getElementById(containerIdRef.current);
			if (container) {
				container.innerHTML = '';
			}
		};
	}, [symbol, interval, theme]);

	return <div className="tradingview-container" id={containerIdRef.current} />;
}

export default TradingViewChart;
