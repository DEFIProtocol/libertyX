const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    
    // GET all tokens
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM tokens ORDER BY symbol');
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching tokens:', error);
            res.status(500).json({ error: 'Failed to fetch tokens' });
        }
    });

    // GET single token by symbol
    router.get('/:symbol', async (req, res) => {
        try {
            const { symbol } = req.params;
            const result = await pool.query(
                'SELECT * FROM tokens WHERE LOWER(symbol) = LOWER($1)',
                [symbol]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token not found' });
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error fetching token:', error);
            res.status(500).json({ error: 'Failed to fetch token' });
        }
    });

    // POST create new token
    router.post('/', async (req, res) => {
        try {
            const { symbol, name, price, market_cap, volume_24h } = req.body;
            
            // Validate required fields
            if (!symbol || !name) {
                return res.status(400).json({ error: 'Symbol and name are required' });
            }

            const result = await pool.query(
                `INSERT INTO tokens (symbol, name, price, market_cap, volume_24h, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
                 RETURNING *`,
                [symbol.toUpperCase(), name, price || 0, market_cap || 0, volume_24h || 0]
            );
            
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creating token:', error);
            
            // Handle duplicate symbol error
            if (error.code === '23505') { // unique_violation
                return res.status(409).json({ error: 'Token with this symbol already exists' });
            }
            
            res.status(500).json({ error: 'Failed to create token' });
        }
    });

    // PUT update token
    router.put('/:symbol', async (req, res) => {
        try {
            const { symbol } = req.params;
            const { name, price, market_cap, volume_24h } = req.body;
            
            const result = await pool.query(
                `UPDATE tokens 
                 SET name = COALESCE($2, name),
                     price = COALESCE($3, price),
                     market_cap = COALESCE($4, market_cap),
                     volume_24h = COALESCE($5, volume_24h),
                     updated_at = NOW()
                 WHERE LOWER(symbol) = LOWER($1)
                 RETURNING *`,
                [symbol, name, price, market_cap, volume_24h]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token not found' });
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error updating token:', error);
            res.status(500).json({ error: 'Failed to update token' });
        }
    });

    // DELETE token
    router.delete('/:symbol', async (req, res) => {
        try {
            const { symbol } = req.params;
            
            const result = await pool.query(
                'DELETE FROM tokens WHERE LOWER(symbol) = LOWER($1) RETURNING *',
                [symbol]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token not found' });
            }
            
            res.json({ message: 'Token deleted successfully', deleted: result.rows[0] });
        } catch (error) {
            console.error('Error deleting token:', error);
            res.status(500).json({ error: 'Failed to delete token' });
        }
    });

    return router;
};