const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb, persistDb } = require('../db');

const router = express.Router();

function ensureAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

router.get('/', ensureAuth, async (req, res) => {
  const db = await getDb();
  const userStmt = db.prepare('SELECT id, role, name, email, specialization, bio, photo FROM users WHERE id=? LIMIT 1');
  userStmt.bind([req.session.user.id]);
  let user = null;
  if (userStmt.step()) user = userStmt.getAsObject();
  userStmt.free();
  if (!user) {
    req.flash('error', 'Profile not found. Please log in again.');
    return res.redirect('/dashboard');
  }
  res.render('profile/index', { profile: user });
});

router.post('/',
  ensureAuth,
  body('name').trim().isLength({ min: 2 }).withMessage('Name required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e=>e.msg));
      return res.redirect('/profile');
    }
    const db = await getDb();
    const { name, specialization, bio, photo } = req.body;
    const meStmt = db.prepare('SELECT role FROM users WHERE id=? LIMIT 1');
    meStmt.bind([req.session.user.id]);
    let myRole = null;
    if (meStmt.step()) myRole = meStmt.getAsObject().role;
    meStmt.free();
    if (!myRole) return res.status(404).render('404');

    if (myRole === 'doctor') {
      db.run('UPDATE users SET name=?, specialization=?, bio=?, photo=? WHERE id=?', [name, specialization || null, bio || null, photo || null, req.session.user.id]);
    } else {
      db.run('UPDATE users SET name=?, photo=? WHERE id=?', [name, photo || null, req.session.user.id]);
    }
    await persistDb();
    // Keep session display name in sync
    req.session.user.name = name;
    req.flash('success', 'Profile updated');
    res.redirect('/profile');
  }
);

module.exports = router;
