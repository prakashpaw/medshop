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
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_number VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        expiry_date DATE NOT NULL,
        supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add supplier_id safely if table already existed without dropping it
    const checkSupplierCol = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='medicines' AND column_name='supplier_id'");
    if (checkSupplierCol.rows.length === 0) {
      await pool.query('ALTER TABLE medicines ADD COLUMN supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        total_amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
        medicine_id INT REFERENCES medicines(id) ON DELETE SET NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL
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

// Create a new admin (no UI - use curl with the secret key)
// Usage: curl -X POST http://YOUR_SERVER:3000/admins/create \
//   -H "Content-Type: application/json" \
//   -H "x-admin-secret: medshop_create_admin_2024" \
//   -d '{"username":"newadmin","password":"yourpassword"}'
const ADMIN_CREATE_SECRET = process.env.ADMIN_CREATE_SECRET || 'medshop_create_admin_2024';

app.post('/admins/create', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== ADMIN_CREATE_SECRET) {
    return res.status(403).json({ error: 'Unauthorized: invalid admin secret' });
  }
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  try {
    const hashedPassword = hashPassword(password);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [username, hashedPassword]);
    res.json({ success: true, message: `Admin '${username}' created successfully.` });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
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
  const { name, category, quantity, price, expiry_date, supplier_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO medicines (name, category, quantity, price, expiry_date, supplier_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, category || 'General', quantity, price || 0, expiry_date, supplier_id || null]
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
  const { name, category, quantity, price, expiry_date, supplier_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE medicines SET name = $1, category = $2, quantity = $3, price = $4, expiry_date = $5, supplier_id = $6 WHERE id = $7 RETURNING *',
      [name, category, quantity, price, expiry_date, supplier_id || null, id]
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

// Suppliers Endpoints
app.get('/suppliers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/suppliers', async (req, res) => {
  const { name, contact_number, email, address } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO suppliers (name, contact_number, email, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, contact_number, email, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Sales Endpoints
app.post('/sales', async (req, res) => {
  const { items, total_amount } = req.body;
  // items: [{ medicine_id, quantity, price }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create the sale record
    const saleResult = await client.query(
      'INSERT INTO sales (total_amount) VALUES ($1) RETURNING *',
      [total_amount]
    );
    const saleId = saleResult.rows[0].id;

    // Process each item
    for (const item of items) {
      await client.query(
        'INSERT INTO sale_items (sale_id, medicine_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [saleId, item.medicine_id, item.quantity, item.price]
      );

      // Deduct inventory
      await client.query(
        'UPDATE medicines SET quantity = quantity - $1 WHERE id = $2',
        [item.quantity, item.medicine_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, sale_id: saleId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to complete sale' });
  } finally {
    client.release();
  }
});

app.get('/sales', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sales ORDER BY id DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
