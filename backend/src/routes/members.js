const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { auth } = require('../middleware/auth');

// Get own profile
router.get('/me', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id,name,email,phone,skill_level,photo_url,role,created_at FROM members WHERE id=$1',
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update own profile
router.put('/me', auth, async (req, res) => {
  try {
    const { name, phone, skill_level, photo_url } = req.body;
    const r = await pool.query(
      `UPDATE members SET name=COALESCE($1,name), phone=COALESCE($2,phone),
       skill_level=COALESCE($3,skill_level), photo_url=COALESCE($4,photo_url)
       WHERE id=$5 RETURNING id,name,email,phone,skill_level,photo_url,role`,
      [name, phone, skill_level, photo_url, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Change password
router.put('/me/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const r = await pool.query('SELECT password_hash FROM members WHERE id=$1', [req.user.id]);
    const ok = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE members SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get own bookings
router.get('/me/bookings', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.id, r.start_time, r.end_time, r.status, r.price, r.notes, r.created_at,
              c.name as court_name, c.surface_type, c.court_number
       FROM reservations r JOIN courts c ON c.id=r.court_id
       WHERE r.member_id=$1 ORDER BY r.start_time DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get own waitlist entries
router.get('/me/waitlist', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT w.*, c.name as court_name FROM waitlist w
       JOIN courts c ON c.id=w.court_id
       WHERE w.member_id=$1 AND w.status='waiting' ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
