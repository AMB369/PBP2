const router = require('express').Router();
const pool = require('../db');
const { auth } = require('../middleware/auth');

// Join waitlist
router.post('/', auth, async (req, res) => {
  try {
    const { court_id, requested_date, requested_start, requested_end } = req.body;
    if (!court_id || !requested_date || !requested_start || !requested_end)
      return res.status(400).json({ error: 'All fields required' });

    // Don't duplicate
    const dup = await pool.query(
      `SELECT id FROM waitlist WHERE member_id=$1 AND court_id=$2 AND requested_date=$3
       AND requested_start=$4 AND status='waiting'`,
      [req.user.id, court_id, requested_date, requested_start]
    );
    if (dup.rows.length) return res.status(409).json({ error: 'Already on waitlist for this slot' });

    const r = await pool.query(
      `INSERT INTO waitlist (member_id, court_id, requested_date, requested_start, requested_end)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, court_id, requested_date, requested_start, requested_end]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Leave waitlist
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM waitlist WHERE id=$1 AND member_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Removed from waitlist' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
