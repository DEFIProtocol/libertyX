const express = require('express');

const normalizeAddress = (value) => {
	if (!value) return '';
	return value.toString().trim().toLowerCase();
};

const isValidEthAddress = (value) => /^0x[a-f0-9]{40}$/i.test(value || '');

const normalizeJsonb = (value) => {
	if (value === undefined || value === null) return null;
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return JSON.stringify(parsed);
		} catch (error) {
			return null;
		}
	}
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value);
		} catch (error) {
			return null;
		}
	}
	return null;
};

module.exports = (pool) => {
	const router = express.Router();
	let tableReady = false;

	const ensureUsersTable = async () => {
		if (tableReady) return;

		await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

		await pool.query(`
			CREATE TABLE IF NOT EXISTS users (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				wallet_address VARCHAR(66) UNIQUE NOT NULL,
				email VARCHAR(255),
				username VARCHAR(50),
				chain_addresses JSONB,
				watchlist JSONB,
				is_verified_by_coinbase BOOLEAN DEFAULT FALSE,
				created_at TIMESTAMP DEFAULT NOW(),
				updated_at TIMESTAMP DEFAULT NOW()
			)
		`);

		await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS watchlist JSONB');

		tableReady = true;
	};

	const mapUserRow = (row) => {
		if (!row) return null;
		return {
			id: row.id,
			wallet_address: row.wallet_address,
			email: row.email,
			username: row.username,
			chain_addresses: row.chain_addresses,
			watchlist: row.watchlist,
			is_verified_by_coinbase: row.is_verified_by_coinbase,
			created_at: row.created_at,
			updated_at: row.updated_at
		};
	};

	router.get('/', async (req, res) => {
		try {
			await ensureUsersTable();
			const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
			res.json({
				success: true,
				data: result.rows.map(mapUserRow)
			});
		} catch (error) {
			console.error('users list error:', error.message);
			res.status(500).json({ error: 'Failed to fetch users' });
		}
	});

	router.get('/:id', async (req, res) => {
		try {
			await ensureUsersTable();
			const { id } = req.params;
			const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
			if (result.rows.length === 0) {
				return res.status(404).json({ error: 'User not found' });
			}
			res.json({ success: true, data: mapUserRow(result.rows[0]) });
		} catch (error) {
			console.error('users get error:', error.message);
			res.status(500).json({ error: 'Failed to fetch user' });
		}
	});

	router.get('/wallet/:address', async (req, res) => {
		try {
			await ensureUsersTable();
			const walletAddress = normalizeAddress(req.params.address);
			const result = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
			if (result.rows.length === 0) {
				return res.status(404).json({ error: 'User not found' });
			}
			res.json({ success: true, data: mapUserRow(result.rows[0]) });
		} catch (error) {
			console.error('users wallet lookup error:', error.message);
			res.status(500).json({ error: 'Failed to fetch user' });
		}
	});

	router.post('/', async (req, res) => {
		try {
			await ensureUsersTable();
			const { wallet_address, email, username, is_verified_by_coinbase, chain_addresses, watchlist } = req.body || {};
			const normalizedWallet = normalizeAddress(wallet_address);

			if (!normalizedWallet || !isValidEthAddress(normalizedWallet)) {
				return res.status(400).json({ error: 'Valid wallet_address is required' });
			}

			const payload = {
				wallet_address: normalizedWallet,
				email: email || null,
				username: username || null,
				is_verified_by_coinbase: is_verified_by_coinbase === true,
				chain_addresses: normalizeJsonb(chain_addresses),
				watchlist: normalizeJsonb(watchlist)
			};

			const result = await pool.query(
				`INSERT INTO users (wallet_address, email, username, chain_addresses, watchlist, is_verified_by_coinbase)
				 VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
				 RETURNING *`,
				[
					payload.wallet_address,
					payload.email,
					payload.username,
					payload.chain_addresses,
					payload.watchlist,
					payload.is_verified_by_coinbase
				]
			);

			res.status(201).json({ success: true, data: mapUserRow(result.rows[0]) });
		} catch (error) {
			if (error.code === '23505') {
				return res.status(409).json({ error: 'User already exists' });
			}
			console.error('users create error:', error.message);
			res.status(500).json({ error: 'Failed to create user' });
		}
	});

	router.put('/:id', async (req, res) => {
		try {
			await ensureUsersTable();
			const { id } = req.params;
			const { email, username, is_verified_by_coinbase, chain_addresses, watchlist } = req.body || {};

			const result = await pool.query(
				`UPDATE users
				 SET email = COALESCE($2, email),
					 username = COALESCE($3, username),
					 chain_addresses = COALESCE($4::jsonb, chain_addresses),
					 watchlist = COALESCE($5::jsonb, watchlist),
					 is_verified_by_coinbase = COALESCE($6, is_verified_by_coinbase),
					 updated_at = NOW()
				 WHERE id = $1
				 RETURNING *`,
				[
					id,
					email ?? null,
					username ?? null,
					normalizeJsonb(chain_addresses),
					normalizeJsonb(watchlist),
					is_verified_by_coinbase
				]
			);

			if (result.rows.length === 0) {
				return res.status(404).json({ error: 'User not found' });
			}

			res.json({ success: true, data: mapUserRow(result.rows[0]) });
		} catch (error) {
			console.error('users update error:', error.message);
			res.status(500).json({ error: 'Failed to update user' });
		}
	});

	router.put('/wallet/:address', async (req, res) => {
		try {
			await ensureUsersTable();
			const walletAddress = normalizeAddress(req.params.address);
			const { email, username, is_verified_by_coinbase, chain_addresses, watchlist } = req.body || {};

			if (!walletAddress || !isValidEthAddress(walletAddress)) {
				return res.status(400).json({ error: 'Valid wallet_address is required' });
			}

			const result = await pool.query(
				`UPDATE users
				 SET email = COALESCE($2, email),
					 username = COALESCE($3, username),
					 chain_addresses = COALESCE($4::jsonb, chain_addresses),
					 watchlist = COALESCE($5::jsonb, watchlist),
					 is_verified_by_coinbase = COALESCE($6, is_verified_by_coinbase),
					 updated_at = NOW()
				 WHERE wallet_address = $1
				 RETURNING *`,
				[
					walletAddress,
					email ?? null,
					username ?? null,
					normalizeJsonb(chain_addresses),
					normalizeJsonb(watchlist),
					is_verified_by_coinbase
				]
			);

			if (result.rows.length === 0) {
				return res.status(404).json({ error: 'User not found' });
			}

			res.json({ success: true, data: mapUserRow(result.rows[0]) });
		} catch (error) {
			console.error('users wallet update error:', error.message);
			res.status(500).json({ error: 'Failed to update user' });
		}
	});

	router.delete('/:id', async (req, res) => {
		try {
			await ensureUsersTable();
			const { id } = req.params;
			const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
			if (result.rows.length === 0) {
				return res.status(404).json({ error: 'User not found' });
			}
			res.json({ success: true, data: mapUserRow(result.rows[0]) });
		} catch (error) {
			console.error('users delete error:', error.message);
			res.status(500).json({ error: 'Failed to delete user' });
		}
	});

	return router;
};
