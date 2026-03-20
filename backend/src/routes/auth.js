const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const SECRET = process.env.JWT_SECRET || 'pbp-secret-key';

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, skill_level } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password required' });
    const exists = await pool.query('SELECT id FROM members WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO members (name,email,password_hash,phone,skill_level)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,skill_level,created_at`,
      [name, email, hash, phone || null, skill_level || 'beginner']
    );
    const user = r.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const r = await pool.query('SELECT * FROM members WHERE email=$1 AND is_active=true', [email]);
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '30d' });
    const { password_hash, ...safe } = user;
    res.json({ token, user: safe });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
