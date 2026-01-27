require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios'); // Add this - needed by exchange routes

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

// API Routes - ORDER MATTERS!
app.use('/api/tokens', tokensRoutes);

// Import exchange routes - FIXED to pass dependencies
const createPricingRoutes = require('./routes/pricing');
const binanceRoutes = require('./routes/binance');
const coinbaseRoutes = require('./routes/coinbase');

// Add exchange routes
app.use('/api/pricing', createPricingRoutes);
app.use('/api/binance', binanceRoutes);
app.use('/api/coinbase', coinbaseRoutes);

// Simple test route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected',
            api: 'running'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log(`  http://localhost:${PORT}/api/tokens`);
    console.log(`  http://localhost:${PORT}/api/pricing`);
    console.log(`  http://localhost:${PORT}/api/binance`);
    console.log(`  http://localhost:${PORT}/api/coinbase`);
});