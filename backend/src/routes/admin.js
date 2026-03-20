const router = require('express').Router();
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// Stats overview
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const [members, bookings, revenue, courts] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM members WHERE role=\'player\''),
      pool.query('SELECT COUNT(*) FROM reservations WHERE status=\'confirmed\''),
      pool.query('SELECT COALESCE(SUM(price),0) as total FROM reservations WHERE status=\'confirmed\''),
      pool.query('SELECT COUNT(*) FROM courts WHERE is_active=true')
    ]);
    const todayBookings = await pool.query(
      'SELECT COUNT(*) FROM reservations WHERE DATE(start_time)=CURRENT_DATE AND status=\'confirmed\''
    );
    res.json({
      total_members:  parseInt(members.rows[0].count),
      active_bookings: parseInt(bookings.rows[0].count),
      total_revenue:  parseFloat(revenue.rows[0].total),
      active_courts:  parseInt(courts.rows[0].count),
      today_bookings: parseInt(todayBookings.rows[0].count)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All bookings (paginated)
router.get('/bookings', auth, adminOnly, async (req, res) => {
  try {
    const { date, status, page = 1, limit = 50 } = req.query;
    let where = [];
    let params = [];
    if (date) { params.push(date); where.push(`DATE(r.start_time)=$${params.length}`); }
    if (status) { params.push(status); where.push(`r.status=$${params.length}`); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;
    const r = await pool.query(
      `SELECT r.id, r.start_time, r.end_time, r.status, r.price, r.created_at,
              c.name as court_name, c.court_number,
              m.name as member_name, m.email as member_email
       FROM reservations r
       JOIN courts c ON c.id=r.court_id
       JOIN members m ON m.id=r.member_id
       ${whereStr}
       ORDER BY r.start_time DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cancel any booking
router.delete('/bookings/:id', auth, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE reservations SET status=\'cancelled\' WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Cancelled', reservation: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All members
router.get('/members', auth, adminOnly, async (req, res) => {
  try {
    const { search } = req.query;
    let q = 'SELECT id,name,email,phone,skill_level,role,is_active,created_at FROM members';
    const params = [];
    if (search) { params.push(`%${search}%`); q += ` WHERE name ILIKE $1 OR email ILIKE $1`; }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle member active
router.patch('/members/:id/toggle', auth, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE members SET is_active=NOT is_active WHERE id=$1 RETURNING id,name,email,is_active',
      [req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All courts (including inactive)
router.get('/courts', auth, adminOnly, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM courts ORDER BY court_number');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update court
router.put('/courts/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, surface_type, is_active, price_per_hour, description } = req.body;
    const r = await pool.query(
      `UPDATE courts SET
         name=COALESCE($1,name), surface_type=COALESCE($2,surface_type),
         is_active=COALESCE($3,is_active), price_per_hour=COALESCE($4,price_per_hour),
         description=COALESCE($5,description)
       WHERE id=$6 RETURNING *`,
      [name, surface_type, is_active, price_per_hour, description, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Court not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Waitlist overview
router.get('/waitlist', auth, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT w.*, c.name as court_name, m.name as member_name, m.email
       FROM waitlist w
       JOIN courts c ON c.id=w.court_id
       JOIN members m ON m.id=w.member_id
       WHERE w.status IN ('waiting','notified')
       ORDER BY w.created_at DESC`
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
