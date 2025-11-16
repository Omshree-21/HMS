const express = require('express');
const { forceResetIndianDoctors } = require('../db');

const router = express.Router();

// Simple protected reset endpoint. Use a query token to avoid accidental calls.
router.post('/reset', async (req, res) => {
  const token = req.query.token;
  if (token !== 'reset123') return res.status(403).send('Forbidden');
  await forceResetIndianDoctors();
  req.flash('success', 'Database reset. Seeded Indian doctors.');
  res.redirect('/doctors');
});

module.exports = router;
