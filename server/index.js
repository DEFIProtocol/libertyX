require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { rapidApiLimiter, cacheMiddleware } = require('./middleware/ratelimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gridlockdb',
    password: process.env.DB_PASSWORD || 'asdas',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
    } else {
        console.log('Connected to PostgreSQL database');
        release();
    }
});

// Store pool in app for use in routes
app.set('pool', pool);

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const tokensRoutes = require('./routes/tokens')(pool);

// API Routes
app.use('/api/tokens', tokensRoutes);

// Add RapidAPI routes with rate limiting and caching
const rapidapiRoutes = require('./routes/rapidapi');
app.use('/api/rapidapi', cacheMiddleware, rapidApiLimiter, rapidapiRoutes);

// Simple test route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected',
            api: 'running',
            rapidapi: process.env.RAPID_API_KEY ? 'configured' : 'not configured'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Something went wrong!',
        message: err.message 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log(`  http://localhost:${PORT}/api/tokens`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/coins`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/coin/:coinId`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/coin/:coinId/history`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/stats`);
    console.log(`  http://localhost:${PORT}/api/health`);
});