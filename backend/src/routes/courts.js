const router = require('express').Router();
const pool = require('../db');

// List all active courts
router.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM courts WHERE is_active=true ORDER BY court_number');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get court availability for a date
router.get('/:id/availability', async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const r = await pool.query(
      `SELECT start_time, end_time, status FROM reservations
       WHERE court_id=$1 AND DATE(start_time)=$2
       AND status NOT IN ('cancelled') ORDER BY start_time`,
      [req.params.id, date]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
