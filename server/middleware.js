// Custom logging middleware
const logger = (req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

// Validate token data middleware
const validateTokenData = (req, res, next) => {
    const { symbol, name, price } = req.body;
    
    if (!symbol || !name) {
        return res.status(400).json({ error: 'Symbol and name are required' });
    }
    
    // Validate price if provided
    if (price && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
        return res.status(400).json({ error: 'Price must be a positive number' });
    }
    
    next();
};

module.exports = {
    logger,
    errorHandler,
    validateTokenData
};