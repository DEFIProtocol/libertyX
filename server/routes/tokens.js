const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

module.exports = (pool) => {
    
    // Helper function to read JSON file
    const getJsonTokens = async () => {
        try {
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
                    fileData = await fs.readFile(jsonPath, 'utf-8');
                    successfulPath = jsonPath;
                    break;
                } catch (err) {
                    // Continue to next path
                }
            }
            
            if (!successfulPath) {
                throw new Error('JSON file not found at any of the expected locations');
            }
            
            const tokens = JSON.parse(fileData);
            return tokens;
            
        } catch (error) {
            console.error('❌ Error reading JSON file:', error.message);
            throw error;
        }
    };

    
    // ======== TOKEN ADDRESS HELPERS ========
    let tokenAddressMetaCache = null;

    const getTokenAddressMeta = async () => {
        if (tokenAddressMetaCache) return tokenAddressMetaCache;
        try {
            const result = await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'token_address'"
            );
            const columns = new Set(result.rows.map(row => row.column_name));

            const meta = {
                columns,
                tokenIdCol: columns.has('token_id') ? 'token_id' : null,
                tokenSymbolCol: columns.has('token_symbol')
                    ? 'token_symbol'
                    : columns.has('symbol')
                    ? 'symbol'
                    : null,
                chainCol: columns.has('chain')
                    ? 'chain'
                    : columns.has('network')
                    ? 'network'
                    : null,
                addressCol: columns.has('address')
                    ? 'address'
                    : columns.has('contract_address')
                    ? 'contract_address'
                    : null
            };

            tokenAddressMetaCache = meta;
            return meta;
        } catch (error) {
            const meta = {
                columns: new Set(),
                tokenIdCol: null,
                tokenSymbolCol: null,
                chainCol: null,
                addressCol: null
            };
            tokenAddressMetaCache = meta;
            return meta;
        }
    };

    const getTokenBySymbol = async (symbol) => {
        const result = await pool.query(
            'SELECT * FROM tokens WHERE LOWER(symbol) = LOWER($1)',
            [symbol]
        );
        return result.rows[0] || null;
    };

    // ======== TOKEN TABLE META ========
    let tokenTableColumnsCache = null;

    const getTokenTableColumns = async () => {
        if (tokenTableColumnsCache) return tokenTableColumnsCache;
        try {
            const result = await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'tokens'"
            );
            const columns = new Set(result.rows.map(row => row.column_name));
            tokenTableColumnsCache = columns;
            return columns;
        } catch (error) {
            tokenTableColumnsCache = new Set();
            return tokenTableColumnsCache;
        }
    };

    const ensureChainsColumn = async () => {
        const columns = await getTokenTableColumns();
        if (columns.has('chains')) return;
        try {
            await pool.query('ALTER TABLE tokens ADD COLUMN IF NOT EXISTS chains JSONB');
            tokenTableColumnsCache = null;
            await getTokenTableColumns();
            console.log('[tokens] added chains JSONB column');
        } catch (error) {
            console.error('[tokens] failed to add chains column:', error.message);
        }
    };

    const getTokenAddressesMap = async () => {
        const meta = await getTokenAddressMeta();
        const byTokenId = new Map();
        const bySymbol = new Map();

        if (!meta.chainCol || !meta.addressCol) {
            return { byTokenId, bySymbol, meta };
        }

        if (meta.tokenIdCol) {
            const query = `SELECT ${meta.tokenIdCol} AS token_id, ${meta.chainCol} AS chain, ${meta.addressCol} AS address FROM token_address`;
            const result = await pool.query(query);

            for (const row of result.rows) {
                if (row.token_id === null || row.token_id === undefined) continue;
                if (!byTokenId.has(row.token_id)) byTokenId.set(row.token_id, {});
                byTokenId.get(row.token_id)[row.chain] = row.address;
            }

            return { byTokenId, bySymbol, meta };
        }

        if (meta.tokenSymbolCol) {
            const query = `SELECT ${meta.tokenSymbolCol} AS symbol, ${meta.chainCol} AS chain, ${meta.addressCol} AS address FROM token_address`;
            const result = await pool.query(query);

            for (const row of result.rows) {
                const symbolKey = row.symbol ? row.symbol.toLowerCase() : null;
                if (!symbolKey) continue;
                if (!bySymbol.has(symbolKey)) bySymbol.set(symbolKey, {});
                bySymbol.get(symbolKey)[row.chain] = row.address;
            }

            return { byTokenId, bySymbol, meta };
        }

        return { byTokenId, bySymbol, meta };
    };

    const getTokenAddressesForToken = async ({ tokenId, symbol }) => {
        const meta = await getTokenAddressMeta();
        if (!meta.chainCol || !meta.addressCol) return {};

        let result = { rows: [] };

        if (meta.tokenIdCol && tokenId !== null && tokenId !== undefined) {
            const query = `SELECT ${meta.chainCol} AS chain, ${meta.addressCol} AS address FROM token_address WHERE ${meta.tokenIdCol} = $1`;
            result = await pool.query(query, [tokenId]);
        } else if (meta.tokenSymbolCol && symbol) {
            const query = `SELECT ${meta.chainCol} AS chain, ${meta.addressCol} AS address FROM token_address WHERE LOWER(${meta.tokenSymbolCol}) = LOWER($1)`;
            result = await pool.query(query, [symbol]);
        }

        const addresses = {};
        for (const row of result.rows) {
            if (row.chain) addresses[row.chain] = row.address;
        }
        return addresses;
    };

    // ======== JSON FILE GENERATION FUNCTION ========
    const generateAndWriteJsonFile = async () => {
        try {
            console.log('🔄 Generating JSON file from database...');
            
            // First, check if we can connect to the database
            try {
                await pool.query('SELECT 1');
            } catch (dbError) {
                console.error('❌ Database connection failed during JSON generation:', dbError.message);
                throw new Error('Database connection failed');
            }

            // Get all tokens from database with addresses
            const result = await pool.query('SELECT * FROM tokens ORDER BY symbol');
            const tokens = result.rows;
            const addressMap = await getTokenAddressesMap();

            // Enrich tokens with addresses
            const enrichedTokens = tokens.map(token => {
                let addresses = {};

                if (addressMap.byTokenId.size && token.id !== undefined && token.id !== null) {
                    addresses = addressMap.byTokenId.get(token.id) || {};
                } else if (addressMap.bySymbol.size && token.symbol) {
                    addresses = addressMap.bySymbol.get(token.symbol.toLowerCase()) || {};
                }

                return {
                    ...token,
                    addresses
                };
            });

            // Find the JSON file path
            let jsonFilePath;
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

            // Try to find existing file
            for (const possiblePath of possiblePaths) {
                try {
                    await fs.access(possiblePath);
                    jsonFilePath = possiblePath;
                    break;
                } catch (err) {
                    // Continue to next path
                }
            }

            // If file doesn't exist, create it at the first location
            if (!jsonFilePath) {
                jsonFilePath = path.join(__dirname, '../tokens_smart_consolidated.json');
                console.log(`📁 Creating new JSON file at: ${jsonFilePath}`);
            } else {
                console.log(`📁 Found existing JSON file at: ${jsonFilePath}`);
            }

            // Create backup before writing (only if file exists)
            try {
                if (await fs.access(jsonFilePath).then(() => true).catch(() => false)) {
                    const backupPath = `${jsonFilePath}.backup`;
                    await fs.copyFile(jsonFilePath, backupPath);
                    console.log(`💾 Created backup at: ${backupPath}`);
                }
            } catch (backupError) {
                console.warn('⚠️ Could not create backup:', backupError.message);
            }

            // Write to file
            await fs.writeFile(jsonFilePath, JSON.stringify(enrichedTokens, null, 2));
            
            console.log(`✅ JSON file updated successfully. Tokens: ${enrichedTokens.length}`);
            return { 
                success: true, 
                path: jsonFilePath, 
                count: enrichedTokens.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Error updating JSON file:', error.message);
            // Don't throw the error, just return failure info
            return { 
                success: false, 
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // ======== DEBOUNCED JSON UPDATE ========
    let jsonUpdateTimeout = null;
    let isUpdating = false;
    
    const debouncedJsonUpdate = async () => {
        // Clear any pending timeout
        if (jsonUpdateTimeout) {
            clearTimeout(jsonUpdateTimeout);
        }
        
        // Set a new timeout to update after 2 seconds of inactivity
        jsonUpdateTimeout = setTimeout(async () => {
            if (isUpdating) {
                console.log('⚠️ JSON update already in progress, skipping...');
                return;
            }
            
            try {
                isUpdating = true;
                await generateAndWriteJsonFile();
            } catch (error) {
                console.error('Failed to update JSON in debounced update:', error);
            } finally {
                isUpdating = false;
            }
        }, 2000); // Wait 2 seconds before updating
    };

    // ======== DATABASE CHANGE LISTENER (SAFE VERSION) ========
    // This is OPTIONAL and will only run if database supports LISTEN/NOTIFY
    const setupDatabaseChangeListeners = async () => {
        try {
            console.log('🔍 Attempting to set up database change listeners...');
            
            // Test database connection first
            await pool.query('SELECT 1');
            console.log('✅ Database connection test passed');
            
            // Check if LISTEN/NOTIFY is supported
            try {
                // Try to create a test trigger/function to see if LISTEN works
                await pool.query(`
                    DO $$
                    BEGIN
                        -- Test if we can listen
                        PERFORM pg_listening_channels();
                    EXCEPTION WHEN OTHERS THEN
                        -- If we get here, LISTEN might not work
                        RAISE NOTICE 'LISTEN/NOTIFY might not be available';
                    END $$;
                `);
                
                // Listen for changes (these channels need to be triggered by PostgreSQL triggers)
                await pool.query('LISTEN tokens_changed');
                await pool.query('LISTEN token_address_changed');
                
                pool.on('notification', (notification) => {
                    console.log(`📢 Database change detected on channel: ${notification.channel}`);
                    // Use debounced update to avoid too frequent writes
                    debouncedJsonUpdate();
                });
                
                console.log('✅ Database change listeners activated successfully');
                console.log('📢 Listening for changes on: tokens_changed, token_address_changed');
                
                // Note: For this to work, you need PostgreSQL triggers that send NOTIFY
                // Example trigger setup (run this in your database):
                /*
                -- For tokens table
                CREATE OR REPLACE FUNCTION notify_tokens_changed() RETURNS TRIGGER AS $$
                BEGIN
                    PERFORM pg_notify('tokens_changed', 'change');
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER tokens_change_trigger
                AFTER INSERT OR UPDATE OR DELETE ON tokens
                FOR EACH ROW EXECUTE FUNCTION notify_tokens_changed();

                -- For token_address table
                CREATE OR REPLACE FUNCTION notify_token_address_changed() RETURNS TRIGGER AS $$
                BEGIN
                    PERFORM pg_notify('token_address_changed', 'change');
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER token_address_change_trigger
                AFTER INSERT OR UPDATE OR DELETE ON token_address
                FOR EACH ROW EXECUTE FUNCTION notify_token_address_changed();
                */
                
            } catch (listenError) {
                console.warn('⚠️ Database LISTEN/NOTIFY not available or failed:', listenError.message);
                console.log('ℹ️ Database changes will still be tracked via API endpoints');
            }
            
        } catch (error) {
            console.warn('⚠️ Could not set up database change listeners:', error.message);
            console.log('ℹ️ JSON file will only update when changes happen through the API');
        }
    };

    // Initialize listeners (but don't crash if they fail)
    setupDatabaseChangeListeners().catch(error => {
        console.warn('⚠️ Database listener setup failed:', error.message);
        console.log('ℹ️ JSON file updates will work via API endpoints only');
    });

    // ========== DATABASE ROUTES ==========
    
    // GET all tokens from DATABASE
    router.get('/db', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM tokens ORDER BY symbol');
            const tokens = result.rows;
            const addressMap = await getTokenAddressesMap();

            const enrichedTokens = tokens.map(token => {
                let addresses = {};

                if (addressMap.byTokenId.size && token.id !== undefined && token.id !== null) {
                    addresses = addressMap.byTokenId.get(token.id) || {};
                } else if (addressMap.bySymbol.size && token.symbol) {
                    addresses = addressMap.bySymbol.get(token.symbol.toLowerCase()) || {};
                }

                return {
                    ...token,
                    addresses
                };
            });

            res.json({
                source: 'database',
                data: enrichedTokens,
                count: enrichedTokens.length
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
            const token = result.rows[0];
            const addresses = await getTokenAddressesForToken({ tokenId: token.id, symbol: token.symbol });

            res.json({
                source: 'database',
                data: {
                    ...token,
                    addresses
                }
            });
        } catch (error) {
            console.error('Error fetching token from DB:', error);
            res.status(500).json({ error: 'Failed to fetch token from database' });
        }
    });

    // ======== TOKEN ADDRESS ROUTES (DATABASE) ========

    // GET addresses for a token (by symbol)
    router.get('/db/:symbol/addresses', async (req, res) => {
        try {
            const { symbol } = req.params;
            const token = await getTokenBySymbol(symbol);

            if (!token) {
                return res.status(404).json({ error: 'Token not found in database' });
            }

            const addresses = await getTokenAddressesForToken({ tokenId: token.id, symbol: token.symbol });

            res.json({
                source: 'database',
                data: addresses,
                count: Object.keys(addresses).length
            });
        } catch (error) {
            console.error('Error fetching token addresses:', error);
            res.status(500).json({ error: 'Failed to fetch token addresses' });
        }
    });

    // POST create token address
    router.post('/db/:symbol/addresses', async (req, res) => {
        try {
            const { symbol } = req.params;
            const { chain, address } = req.body;

            if (!chain || !address) {
                return res.status(400).json({ error: 'Chain and address are required' });
            }

            const token = await getTokenBySymbol(symbol);
            if (!token) {
                return res.status(404).json({ error: 'Token not found in database' });
            }

            const meta = await getTokenAddressMeta();
            if (!meta.chainCol || !meta.addressCol) {
                return res.status(500).json({ error: 'token_address table schema is missing required columns' });
            }

            const columns = [];
            const values = [];

            if (meta.tokenIdCol && token.id !== undefined && token.id !== null) {
                columns.push(meta.tokenIdCol);
                values.push(token.id);
            }

            if (meta.tokenSymbolCol) {
                columns.push(meta.tokenSymbolCol);
                values.push(token.symbol);
            }

            columns.push(meta.chainCol);
            values.push(chain);

            columns.push(meta.addressCol);
            values.push(address);

            if (columns.length < 3) {
                return res.status(500).json({ error: 'token_address table schema is missing required link columns' });
            }

            const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
            const query = `INSERT INTO token_address (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
            const result = await pool.query(query, values);

            // Update JSON file after adding address
            await debouncedJsonUpdate();

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creating token address:', error);
            res.status(500).json({ error: 'Failed to create token address' });
        }
    });

    // PUT update token address
    router.put('/db/:symbol/addresses/:chain', async (req, res) => {
        try {
            const { symbol, chain } = req.params;
            const { address } = req.body;

            if (!address) {
                return res.status(400).json({ error: 'Address is required' });
            }

            const token = await getTokenBySymbol(symbol);
            if (!token) {
                return res.status(404).json({ error: 'Token not found in database' });
            }

            const meta = await getTokenAddressMeta();
            if (!meta.chainCol || !meta.addressCol) {
                return res.status(500).json({ error: 'token_address table schema is missing required columns' });
            }

            const where = [];
            const values = [];
            let paramCount = 1;

            if (meta.tokenIdCol && token.id !== undefined && token.id !== null) {
                where.push(`${meta.tokenIdCol} = $${paramCount}`);
                values.push(token.id);
                paramCount++;
            } else if (meta.tokenSymbolCol) {
                where.push(`LOWER(${meta.tokenSymbolCol}) = LOWER($${paramCount})`);
                values.push(token.symbol);
                paramCount++;
            } else {
                return res.status(500).json({ error: 'token_address table schema is missing token link column' });
            }

            where.push(`${meta.chainCol} = $${paramCount}`);
            values.push(chain);
            paramCount++;

            values.push(address);
            const query = `UPDATE token_address SET ${meta.addressCol} = $${paramCount} WHERE ${where.join(' AND ')} RETURNING *`;
            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token address not found' });
            }

            // Update JSON file after updating address
            await debouncedJsonUpdate();

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error updating token address:', error);
            res.status(500).json({ error: 'Failed to update token address' });
        }
    });

    // DELETE token address
    router.delete('/db/:symbol/addresses/:chain', async (req, res) => {
        try {
            const { symbol, chain } = req.params;

            const token = await getTokenBySymbol(symbol);
            if (!token) {
                return res.status(404).json({ error: 'Token not found in database' });
            }

            const meta = await getTokenAddressMeta();
            if (!meta.chainCol || !meta.addressCol) {
                return res.status(500).json({ error: 'token_address table schema is missing required columns' });
            }

            const where = [];
            const values = [];
            let paramCount = 1;

            if (meta.tokenIdCol && token.id !== undefined && token.id !== null) {
                where.push(`${meta.tokenIdCol} = $${paramCount}`);
                values.push(token.id);
                paramCount++;
            } else if (meta.tokenSymbolCol) {
                where.push(`LOWER(${meta.tokenSymbolCol}) = LOWER($${paramCount})`);
                values.push(token.symbol);
                paramCount++;
            } else {
                return res.status(500).json({ error: 'token_address table schema is missing token link column' });
            }

            where.push(`${meta.chainCol} = $${paramCount}`);
            values.push(chain);

            const query = `DELETE FROM token_address WHERE ${where.join(' AND ')} RETURNING *`;
            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token address not found' });
            }

            // Update JSON file after deleting address
            await debouncedJsonUpdate();

            res.json({ message: 'Token address deleted successfully', deleted: result.rows[0] });
        } catch (error) {
            console.error('Error deleting token address:', error);
            res.status(500).json({ error: 'Failed to delete token address' });
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

    // ========== CRUD OPERATIONS (Always work on database) ==========
    
    // POST create new token
    router.post('/', async (req, res) => {
        try {
            await ensureChainsColumn();
            const {
                symbol,
                name,
                price,
                market_cap,
                volume_24h,
                decimals,
                type,
                image,
                uuid,
                rapidapi_data,
                oneinch_data,
                chains
            } = req.body;

            console.log('[tokens] create request', {
                symbol,
                fields: Object.keys(req.body || {})
            });
            
            // Validate required fields
            if (!symbol || !name) {
                return res.status(400).json({ error: 'Symbol and name are required' });
            }

            const columns = await getTokenTableColumns();
            const insertColumns = [];
            const values = [];

            const addField = (col, value) => {
                if (!columns.has(col)) return;
                if (value === undefined) return;
                insertColumns.push(col);
                values.push(value);
            };

            addField('symbol', symbol.toUpperCase());
            addField('name', name);
            addField('price', price || 0);
            addField('market_cap', market_cap || 0);
            addField('volume_24h', volume_24h || 0);
            addField('decimals', decimals || 18);
            addField('type', type || 'ERC-20');
            addField('image', image);
            addField('uuid', uuid);
            addField('rapidapi_data', rapidapi_data);
            addField('oneinch_data', oneinch_data);
            addField('chains', chains);
            addField('created_at', new Date());
            addField('updated_at', new Date());

            if (!insertColumns.includes('symbol') || !insertColumns.includes('name')) {
                return res.status(500).json({ error: 'Tokens table schema missing required columns' });
            }

            const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
            const query = `INSERT INTO tokens (${insertColumns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
            const result = await pool.query(query, values);

            console.log('[tokens] create response', { symbol: result.rows[0]?.symbol });
            
            // Update JSON file after creating token
            await debouncedJsonUpdate();
            
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
            const updateData = req.body;

            await ensureChainsColumn();

            console.log('[tokens] update request', {
                symbol,
                fields: Object.keys(updateData || {})
            });
            
            // Build dynamic SET clause - exclude symbol as it's immutable
            const allowedFields = [
                'symbol', 'name', 'price', 'market_cap', 'volume_24h', 'type', 'decimals',
                'address', 'image', 'ticker', 'rank', 'change',
                'uuid', 'rapidapi_data', 'oneinch_data', 'chains'
            ];
            
            const existingToken = await getTokenBySymbol(symbol);
            if (!existingToken) {
                return res.status(404).json({ error: 'Token not found' });
            }

            const mergedData = { ...existingToken, ...updateData };

            const setClause = [];
            const values = [symbol];
            let paramCount = 2;
            
            const columns = await getTokenTableColumns();

            for (const [key, value] of Object.entries(mergedData)) {
                if (
                    allowedFields.includes(key) &&
                    columns.has(key) &&
                    value !== undefined &&
                    value !== null
                ) {
                    setClause.push(`${key} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            }
            
            if (setClause.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }

            if (columns.has('updated_at')) {
                setClause.push(`updated_at = NOW()`);
            }
            
            const query = `UPDATE tokens 
                          SET ${setClause.join(', ')}
                          WHERE LOWER(symbol) = LOWER($1)
                          RETURNING *`;
            
            const result = await pool.query(query, values);

            console.log('[tokens] update response', { symbol: result.rows[0]?.symbol });
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token not found' });
            }
            
            // Update JSON file after updating token
            await debouncedJsonUpdate();
            
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

            console.log('[tokens] delete request', { symbol });
            
            const result = await pool.query(
                'DELETE FROM tokens WHERE LOWER(symbol) = LOWER($1) RETURNING *',
                [symbol]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Token not found' });
            }
            
            // Update JSON file after deleting token
            await debouncedJsonUpdate();
            
            res.json({ message: 'Token deleted successfully', deleted: result.rows[0] });
        } catch (error) {
            console.error('Error deleting token:', error);
            res.status(500).json({ error: 'Failed to delete token' });
        }
    });

    // ========== MANUAL SYNC ENDPOINTS ==========
    
    // POST manually trigger JSON update
    router.post('/sync-to-json', async (req, res) => {
        try {
            console.log('🔄 Manual JSON sync requested...');
            const result = await generateAndWriteJsonFile();
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'JSON file updated successfully',
                    details: result
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to sync to JSON file',
                    details: result
                });
            }
        } catch (error) {
            console.error('Error syncing to JSON:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to sync to JSON file',
                message: error.message
            });
        }
    });

    // GET JSON sync status
    router.get('/sync-status', async (req, res) => {
        try {
            // Try to get file stats
            let fileInfo = null;
            try {
                const tokens = await getJsonTokens();
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
                
                for (const filePath of possiblePaths) {
                    try {
                        const stats = await fs.stat(filePath);
                        fileInfo = {
                            path: filePath,
                            size: stats.size,
                            modified: stats.mtime,
                            tokens: tokens.length
                        };
                        break;
                    } catch (err) {
                        // Continue
                    }
                }
            } catch (error) {
                // File doesn't exist or can't be read
            }

            // Get database info
            let dbInfo = null;
            try {
                const result = await pool.query('SELECT COUNT(*) as count FROM tokens');
                dbInfo = {
                    tokenCount: parseInt(result.rows[0].count)
                };
            } catch (dbError) {
                // Database error
            }

            res.json({
                file: fileInfo,
                database: dbInfo,
                listenersActive: true // Change this based on your listener status
            });
        } catch (error) {
            console.error('Error getting sync status:', error);
            res.status(500).json({ error: 'Failed to get sync status' });
        }
    });

    // ========== LEGACY/COMPATIBILITY ROUTES ==========
    
    // LEGACY: Default route (returns database tokens for backward compatibility)
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM tokens ORDER BY symbol');
            const tokens = result.rows;
            const addressMap = await getTokenAddressesMap();
            const enrichedTokens = tokens.map(token => {
                let addresses = {};

                if (addressMap.byTokenId.size && token.id !== undefined && token.id !== null) {
                    addresses = addressMap.byTokenId.get(token.id) || {};
                } else if (addressMap.bySymbol.size && token.symbol) {
                    addresses = addressMap.bySymbol.get(token.symbol.toLowerCase()) || {};
                }

                return {
                    ...token,
                    addresses
                };
            });

            res.json(enrichedTokens);
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

            const token = result.rows[0];
            const addresses = await getTokenAddressesForToken({ tokenId: token.id, symbol: token.symbol });

            res.json({
                ...token,
                addresses
            });
        } catch (error) {
            console.error('Error fetching token:', error);
            res.status(500).json({ error: 'Failed to fetch token' });
        }
    });

    return router;
};