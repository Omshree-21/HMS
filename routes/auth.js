const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { getDb, persistDb } = require('../db');

const DOCTOR_EMAIL_DOMAIN = process.env.HOSPITAL_DOMAIN || 'hospital.test';

const router = express.Router();

function ensureGuest(req, res, next) {
  if (req.session.user) return res.redirect('/dashboard');
  next();
}

router.get('/login', ensureGuest, (req, res) => {
  const role = req.query.role || null;
  const domain = DOCTOR_EMAIL_DOMAIN;
  res.render('auth/login', { role, domain });
});

router.post('/login',
  ensureGuest,
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e=>e.msg));
      return res.redirect('/auth/login');
    }
    const { email, password } = req.body;
    const db = await getDb();
    let userObj = null;
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    stmt.bind([email]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      userObj = row;
    }
    stmt.free();
    if (!userObj || !bcrypt.compareSync(password, userObj.password_hash)) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/auth/login');
    }
    req.session.user = { id: userObj.id, role: userObj.role, name: userObj.name };
    req.flash('success', `Welcome ${userObj.name}`);
    res.redirect('/dashboard');
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

router.get('/register/patient', ensureGuest, (req, res) => {
  res.render('auth/register_patient');
});

router.post('/register/patient',
  ensureGuest,
  body('name').trim().isLength({ min: 2 }).withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Minimum 6 chars password'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e=>e.msg));
      return res.redirect('/auth/register/patient');
    }
    const { name, email, password } = req.body;
    const db = await getDb();
    const check = db.prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
    check.bind([email]);
    const exists = check.step();
    check.free();
    if (exists) {
      req.flash('error', 'Email already registered');
      return res.redirect('/auth/register/patient');
    }
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (role,name,email,password_hash) VALUES (?,?,?,?)', ['patient', name, email, hash]);
    await persistDb();
    req.flash('success', 'Registration successful. Please log in.');
    res.redirect('/auth/login');
  }
);

router.get('/register/doctor', ensureGuest, (req, res) => {
  res.render('auth/register_doctor');
});

router.post('/register/doctor',
  ensureGuest,
  body('name').trim().isLength({ min: 2 }).withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Minimum 6 chars password'),
  body('specialization').trim().isLength({ min: 2 }).withMessage('Specialization required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e=>e.msg));
      return res.redirect('/auth/register/doctor');
    }
    const { name, email, password, specialization, bio } = req.body;
    const db = await getDb();
    // Enforce doctor email domain
    const local = String(email).split('@')[0];
    const enforcedEmail = `${local}@${DOCTOR_EMAIL_DOMAIN}`;
    const check = db.prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
    check.bind([enforcedEmail]);
    const exists = check.step();
    check.free();
    if (exists) {
      req.flash('error', 'Email already registered');
      return res.redirect('/auth/register/doctor');
    }
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (role,name,email,password_hash,specialization,bio) VALUES (?,?,?,?,?,?)', ['doctor', name, enforcedEmail, hash, specialization, bio || null]);
    await persistDb();
    req.flash('success', 'Doctor registered. Please log in.');
    res.redirect('/auth/login');
  }
);

module.exports = router;
