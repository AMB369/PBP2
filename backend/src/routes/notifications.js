const router = require('express').Router();
const pool = require('../db');
const { auth } = require('../middleware/auth');

// Save push subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth)
      return res.status(400).json({ error: 'Invalid subscription object' });
    await pool.query(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth_key)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (member_id, endpoint) DO UPDATE SET p256dh=$3, auth_key=$4`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ message: 'Subscribed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Unsubscribe
router.delete('/subscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await pool.query(
      'DELETE FROM push_subscriptions WHERE member_id=$1 AND endpoint=$2',
      [req.user.id, endpoint]
    );
    res.json({ message: 'Unsubscribed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
