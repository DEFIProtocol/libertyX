export * from './useRapidApi';


// Re-export commonly used hooks with clearer names
export { useGetCryptos as useCryptoMarket } from './useRapidApi';
export { useGetCryptoDetails as useCryptoPrice } from './useRapidApi';
export { useGetCryptoHistory as useCryptoChartData } from './useRapidApi';
export { useGetCryptoFullData as useCryptoComplete } from './useRapidApi';
export { useGetMultipleCryptoDetails as useCryptoBatchPrices } from './useRapidApi';