const router = require('express').Router();
const pool = require('../db');
const { auth } = require('../middleware/auth');

// ── RECURRING routes (must come BEFORE /:id) ─────────────────

// Create recurring booking
router.post('/recurring', auth, async (req, res) => {
  try {
    const { court_id, day_of_week, start_hour, duration_min } = req.body;
    if (court_id == null || day_of_week == null || start_hour == null)
      return res.status(400).json({ error: 'court_id, day_of_week, start_hour required' });
    const r = await pool.query(
      `INSERT INTO recurring_bookings (member_id, court_id, day_of_week, start_hour, duration_min)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, court_id, day_of_week, start_hour, duration_min || 60]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get own recurring bookings
router.get('/recurring/mine', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT rb.*, c.name as court_name FROM recurring_bookings rb
       JOIN courts c ON c.id=rb.court_id
       WHERE rb.member_id=$1 AND rb.is_active=true`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cancel recurring booking
router.delete('/recurring/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE recurring_bookings SET is_active=false WHERE id=$1 AND member_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Recurring booking cancelled' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SINGLE reservation routes ─────────────────────────────────

// Create reservation
router.post('/', auth, async (req, res) => {
  try {
    const { court_id, start_time, end_time, notes } = req.body;
    if (!court_id || !start_time || !end_time)
      return res.status(400).json({ error: 'court_id, start_time, end_time required' });

    // Check for conflicts
    const conflict = await pool.query(
      `SELECT id FROM reservations
       WHERE court_id=$1 AND status NOT IN ('cancelled')
       AND NOT (end_time <= $2 OR start_time >= $3)`,
      [court_id, start_time, end_time]
    );
    if (conflict.rows.length)
      return res.status(409).json({ error: 'Court already booked for this time slot' });

    // Get court price
    const court = await pool.query('SELECT price_per_hour FROM courts WHERE id=$1', [court_id]);
    if (!court.rows.length) return res.status(404).json({ error: 'Court not found' });
    const hours = (new Date(end_time) - new Date(start_time)) / 3600000;
    const price = (court.rows[0].price_per_hour * hours).toFixed(2);

    const r = await pool.query(
      `INSERT INTO reservations (member_id, court_id, start_time, end_time, price, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,'confirmed') RETURNING *`,
      [req.user.id, court_id, start_time, end_time, price, notes || null]
    );

    notifyWaitlist(court_id, start_time, end_time);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get single reservation
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT res.*, c.name as court_name, c.surface_type, c.court_number,
              m.name as member_name, m.email as member_email
       FROM reservations res
       JOIN courts c ON c.id=res.court_id
       JOIN members m ON m.id=res.member_id
       WHERE res.id=$1 AND (res.member_id=$2 OR $3='admin')`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cancel reservation
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE reservations SET status='cancelled'
       WHERE id=$1 AND (member_id=$2 OR $3='admin') AND status='confirmed'
       RETURNING *`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or already cancelled' });
    const cancelled = r.rows[0];
    notifyWaitlist(cancelled.court_id, cancelled.start_time, cancelled.end_time);
    res.json({ message: 'Booking cancelled', reservation: cancelled });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Internal helpers ──────────────────────────────────────────
async function notifyWaitlist(court_id, start_time, end_time) {
  try {
    await pool.query(
      `UPDATE waitlist SET status='notified'
       WHERE court_id=$1 AND status='waiting'
       AND requested_date=DATE($2)
       AND requested_start <= $3::time AND requested_end >= $4::time`,
      [court_id, start_time, start_time, end_time]
    );
  } catch (e) { console.error('waitlist notify error', e.message); }
}

module.exports = router;
