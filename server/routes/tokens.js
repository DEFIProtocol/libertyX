const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const jsonPath = "../tokens_smart_consolidated.json"
module.exports = (pool) => {
    
    // Helper function to read JSON file
    const getJsonTokens = async () => {
    try {
        console.log('📁 Attempting to read JSON file...');
        
        // Try different paths - one of these should work
        const possiblePaths = [
            path.join(__dirname, '../tokens_smart_consolidated.json'),
            path.join(__dirname, './tokens_smart_consolidated.json'),
            path.join(__dirname, '../../tokens_smart_consolidated.json'),
            path.join(process.cwd(), 'data/tokens_smart_consolidated.json'),
            path.join(process.cwd(), 'server/data/tokens_smart_consolidated.json'),
            './tokens_smart_consolidated.json',
            '../tokens_smart_consolidated.json',
            'tokens_smart_consolidated.json'
        ];
        
        let successfulPath = null;
        let fileData = null;
        
        // Try each path
        for (const jsonPath of possiblePaths) {
            try {
                console.log(`  Trying path: ${jsonPath}`);
                fileData = await fs.readFile(jsonPath, 'utf-8');
                successfulPath = jsonPath;
                console.log(`✅ Found file at: ${jsonPath}`);
                break;
            } catch (err) {
                // Continue to next path
                console.log(`  ❌ Not found: ${jsonPath}`);
            }
        }
        
        if (!successfulPath) {
            throw new Error('JSON file not found at any of the expected locations');
        }
        
        const tokens = JSON.parse(fileData);
        console.log(`✅ Successfully parsed ${tokens.length} tokens from JSON file`);
        return tokens;
        
    } catch (error) {
        console.error('❌ Error reading JSON file:', error.message);
        throw error;
    }
};
    // ========== DATABASE ROUTES ==========
    
    // GET all tokens from DATABASE
    router.get('/db', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM tokens ORDER BY symbol');
            res.json({
                source: 'database',
                data: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Error fetching tokens from DB:', error);
            res.status(500).json({ 
                error: 'Failed to fetch tokens from database',
                source: 'database',
                data: [] 
            });
        }
    });

    // GET single token by symbol from DATABASE
    router.get('/db/:symbol', async (req, res) => {
        try {
            const { symbol } = req.params;
            const result = await pool.query(
                'SELECT * FROM tokens WHERE LOWER(symbol) = LOWER($1)',
                [symbol]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token not found in database' });
            }
            
            res.json({
                source: 'database',
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error fetching token from DB:', error);
            res.status(500).json({ error: 'Failed to fetch token from database' });
        }
    });

    // ========== JSON FILE ROUTES ==========
    
    // GET all tokens from JSON FILE
    router.get('/json', async (req, res) => {
        try {
            const tokens = await getJsonTokens();
            res.json({
                source: 'json',
                data: tokens,
                count: tokens.length
            });
        } catch (error) {
            console.error('Error fetching tokens from JSON:', error);
            res.status(500).json({ 
                error: 'Failed to fetch tokens from JSON file',
                source: 'json',
                data: [] 
            });
        }
    });

    // GET single token by symbol from JSON FILE
    router.get('/json/:symbol', async (req, res) => {
        try {
            const { symbol } = req.params;
            const tokens = await getJsonTokens();
            const token = tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
            
            if (!token) {
                return res.status(404).json({ error: 'Token not found in JSON file' });
            }
            
            res.json({
                source: 'json',
                data: token
            });
        } catch (error) {
            console.error('Error fetching token from JSON:', error);
            res.status(500).json({ error: 'Failed to fetch token from JSON file' });
        }
    });

    // ========== COMPARISON ROUTE ==========
    
    // GET comparison data from BOTH sources
    router.get('/compare', async (req, res) => {
        try {
            let dbTokens = [];
            let dbError = null;
            let jsonTokens = [];
            let jsonError = null;

            // Try to get database tokens
            try {
                const dbResult = await pool.query('SELECT * FROM tokens ORDER BY symbol');
                dbTokens = dbResult.rows;
            } catch (dbErr) {
                dbError = dbErr.message;
            }

            // Try to get JSON tokens
            try {
                jsonTokens = await getJsonTokens();
            } catch (jsonErr) {
                jsonError = jsonErr.message;
            }

            res.json({
                database: {
                    success: !dbError,
                    data: dbTokens,
                    count: dbTokens.length,
                    error: dbError
                },
                json: {
                    success: !jsonError,
                    data: jsonTokens,
                    count: jsonTokens.length,
                    error: jsonError
                }
            });
        } catch (error) {
            console.error('Error in compare endpoint:', error);
            res.status(500).json({ error: 'Failed to compare data sources' });
        }
    });

    // ========== LEGACY/COMPATIBILITY ROUTES ==========
    
    // LEGACY: Default route (returns database tokens for backward compatibility)
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM tokens ORDER BY symbol');
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching tokens:', error);
            
            // Fallback to JSON if database fails
            try {
                const tokens = await getJsonTokens();
                console.log('⚠️ Database failed, falling back to JSON');
                res.json(tokens);
            } catch (jsonError) {
                res.status(500).json({ error: 'Failed to fetch tokens from any source' });
            }
        }
    });

    // LEGACY: GET single token (for backward compatibility)
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

    // ========== CRUD OPERATIONS (Always work on database) ==========
    
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