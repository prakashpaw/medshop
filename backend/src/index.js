require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection strictly
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client for init:', err.stack);
  }
  console.log('Successfully connected to the database.');
  release();
});

const crypto = require('crypto');

let isDbInitialized = false;

// Auto-initialize DB so the user doesn't get "error saving data" due to missing tables
const initDb = async () => {
  if (isDbInitialized) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        expiry_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully.');
    isDbInitialized = true;
    return true;
  } catch (err) {
    console.error('Failed to initialize database:', err);
    return false;
  }
};
initDb();

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const jwt = require('jsonwebtoken');

// Admin Endpoints
app.get('/admins/check', async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDb();
    }
    const result = await pool.query('SELECT COUNT(*) FROM admins');
    res.json({ hasAdmins: parseInt(result.rows[0].count) > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error connecting to RDS' });
  }
});

app.post('/admins/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Only allow registration if no admins exist (first time setup)
    const countCheck = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(countCheck.rows[0].count) > 0) {
      return res.status(403).json({ error: 'An admin is already registered. Please login.' });
    }
    
    const hashedPassword = hashPassword(password);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [username, hashedPassword]);
    const token = jwt.sign({ username }, 'secret_medshop_key', { expiresIn: '1d' });
    res.json({ success: true, message: 'Admin registered successfully', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error. Your backend cannot reach AWS RDS.' });
  }
});

app.post('/admins/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const admin = result.rows[0];
    if (admin.password_hash === hashPassword(password)) {
      const token = jwt.sign({ username: admin.username, id: admin.id }, 'secret_medshop_key', { expiresIn: '1d' });
      res.json({ success: true, username: admin.username, token });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all medicines
app.get('/medicines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM medicines ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add a new medicine
app.post('/medicines', async (req, res) => {
  const { name, category, quantity, price, expiry_date } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO medicines (name, category, quantity, price, expiry_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, category || 'General', quantity, price || 0, expiry_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update medicine
app.put('/medicines/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, quantity, price, expiry_date } = req.body;
  try {
    const result = await pool.query(
      'UPDATE medicines SET name = $1, category = $2, quantity = $3, price = $4, expiry_date = $5 WHERE id = $6 RETURNING *',
      [name, category, quantity, price, expiry_date, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Sell Medicine (decrease stock by 1)
app.post('/medicines/:id/sell', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE medicines SET quantity = greatest(quantity - 1, 0) WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a medicine
app.delete('/medicines/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM medicines WHERE id = $1', [id]);
    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
