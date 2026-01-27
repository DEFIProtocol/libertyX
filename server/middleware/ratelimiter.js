const rateLimit = require('express-rate-limit');

// Create rate limiter for RapidAPI endpoints
const rapidApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More restrictive limiter for heavy endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Rate limit exceeded. Please wait a minute.'
  }
});

// Per-IP caching to prevent duplicate RapidAPI calls
const requestCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

const cacheMiddleware = (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') return next();
  
  const cacheKey = `${req.originalUrl}:${JSON.stringify(req.query)}`;
  const cached = requestCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache hit for: ${cacheKey}`);
    return res.json(cached.data);
  }
  
  // Store original res.json method
  const originalJson = res.json;
  
  // Override res.json to cache the response
  res.json = function(data) {
    if (res.statusCode === 200) {
      requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      // Clean old cache entries
      cleanupCache();
    }
    return originalJson.call(this, data);
  };
  
  next();
};

// Clean up old cache entries
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      requestCache.delete(key);
    }
  }
}

// Set cleanup interval
setInterval(cleanupCache, 60 * 1000);

module.exports = {
  rapidApiLimiter,
  strictLimiter,
  cacheMiddleware
};