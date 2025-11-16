const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function ensureAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

router.get('/', ensureAuth, async (req, res) => {
  const user = req.session.user;
  const db = await getDb();
  if (user.role === 'patient') {
    const stmt = db.prepare(`
      SELECT 
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
      FROM appointments WHERE patient_id=?
    `);
    stmt.bind([user.id]);
    let stats = { pending: 0, confirmed: 0, completed: 0 };
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stats = { pending: row.pending || 0, confirmed: row.confirmed || 0, completed: row.completed || 0 };
    }
    stmt.free();
    return res.render('dashboard/patient', { stats });
  }
  if (user.role === 'doctor') {
    // Fetch current doctor's name/spec
    const me = db.prepare('SELECT name, COALESCE(specialization, "") as spec FROM users WHERE id=? LIMIT 1');
    me.bind([user.id]);
    let myName = '', mySpec = '';
    if (me.step()) { const r = me.getAsObject(); myName = r.name || ''; mySpec = r.spec || ''; }
    me.free();

    const stmt = db.prepare(`
      SELECT 
        SUM(CASE WHEN a.status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN a.status='confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END) as completed
      FROM appointments a
      JOIN users d ON d.id = a.doctor_id
      WHERE a.doctor_id = ?
         OR (lower(trim(d.name)) = lower(trim(?)) AND ifnull(lower(trim(d.specialization)), '') = ifnull(lower(trim(?)), ''))
    `);
    stmt.bind([user.id, myName, mySpec]);
    let stats = { pending: 0, confirmed: 0, completed: 0 };
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stats = { pending: row.pending || 0, confirmed: row.confirmed || 0, completed: row.completed || 0 };
    }
    stmt.free();
    return res.render('dashboard/doctor', { stats });
  }
  res.status(403).render('404');
});

module.exports = router;
