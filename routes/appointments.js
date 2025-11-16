const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb, persistDb } = require('../db');

const router = express.Router();

function getDoctorPhoto(name, specialization) {
  const spec = String(specialization||'').toLowerCase().replace(/\s+/g, ',');
  const base = `${name||''}-${specialization||''}`;
  let hash = 0; for (let i=0;i<base.length;i++){ hash = ((hash<<5)-hash) + base.charCodeAt(i); hash |= 0; }
  const sig = Math.abs(hash);
  return `https://source.unsplash.com/800x600/?doctor,${encodeURIComponent(spec||'medicine')}&sig=${sig}`;
}

function ensureAuth(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/auth/login');
    if (role && req.session.user.role !== role) return res.status(403).render('404');
    next();
  };
}

router.get('/new/:doctorId', ensureAuth('patient'), async (req, res) => {
  const db = await getDb();
  const stmt = db.prepare("SELECT id,name,specialization,photo FROM users WHERE id=? AND role='doctor' LIMIT 1");
  stmt.bind([req.params.doctorId]);
  let doctor = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    doctor = { id: row.id, name: row.name, specialization: row.specialization, photo: row.photo };
  }
  stmt.free();
  if (doctor) doctor.photo = doctor.photo || getDoctorPhoto(doctor.name, doctor.specialization);
  if (!doctor) return res.status(404).render('404');
  res.render('appointments/new', { doctor });
});

router.post('/create',
  ensureAuth('patient'),
  body('doctor_id').isInt(),
  body('appt_date').isISO8601().withMessage('Valid date required'),
  body('appt_time').matches(/^\d{2}:\d{2}$/).withMessage('Time format HH:MM'),
  body('concern').isLength({ min: 10 }).withMessage('Please describe your concern'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e=>e.msg));
      return res.redirect('back');
    }
    const { doctor_id, appt_date, appt_time, concern } = req.body;
    const db = await getDb();
    const check = db.prepare('SELECT id FROM users WHERE id=? AND role=\'doctor\' LIMIT 1');
    check.bind([doctor_id]);
    const validDoc = check.step();
    check.free();
    if (!validDoc) {
      req.flash('error', 'Invalid doctor');
      return res.redirect('/doctors');
    }
    db.run('INSERT INTO appointments (patient_id, doctor_id, appt_date, appt_time, concern) VALUES (?,?,?,?,?)', [req.session.user.id, doctor_id, appt_date, appt_time, concern]);
    await persistDb();
    req.flash('success', 'Appointment requested');
    res.redirect('/appointments/mine');
  }
);

router.get('/mine', ensureAuth('patient'), async (req, res) => {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT a.id, a.patient_id, a.doctor_id, a.appt_date, a.appt_time, a.concern, a.status, a.diagnosis, a.doctor_comment, a.created_at, d.name as doctor_name, d.specialization
    FROM appointments a
    JOIN users d ON d.id = a.doctor_id
    WHERE a.patient_id = ?
    ORDER BY a.created_at DESC
  `);
  stmt.bind([req.session.user.id]);
  const appts = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    appts.push({
      id: r.id,
      patient_id: r.patient_id,
      doctor_id: r.doctor_id,
      appt_date: r.appt_date,
      appt_time: r.appt_time,
      concern: r.concern,
      status: r.status,
      diagnosis: r.diagnosis,
      doctor_comment: r.doctor_comment,
      created_at: r.created_at,
      doctor_name: r['doctor_name'],
      specialization: r['specialization']
    });
  }
  stmt.free();
  res.render('appointments/mine', { appts });
});

router.get('/doctor', ensureAuth('doctor'), async (req, res) => {
  const db = await getDb();
  // Fetch current doctor's name and specialization to match appointments created against duplicate doctor entries (same name/spec) if any
  const meStmt = db.prepare('SELECT name, specialization FROM users WHERE id=? LIMIT 1');
  meStmt.bind([req.session.user.id]);
  let myName = null, mySpec = null;
  if (meStmt.step()) {
    const r = meStmt.getAsObject();
    myName = r.name;
    mySpec = r.specialization || '';
  }
  meStmt.free();

  const stmt = db.prepare(`
    SELECT a.id, a.patient_id, a.doctor_id, a.appt_date, a.appt_time, a.concern, a.status, a.diagnosis, a.doctor_comment, a.created_at,
           p.name as patient_name, p.email as patient_email
    FROM appointments a
    JOIN users p ON p.id = a.patient_id
    JOIN users d ON d.id = a.doctor_id
    WHERE a.doctor_id = ?
       OR (d.name = ? AND ifnull(d.specialization,'') = ifnull(?,''))
    ORDER BY a.created_at DESC
  `);
  stmt.bind([req.session.user.id, myName || '', mySpec || '']);
  const appts = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    appts.push({
      id: r.id,
      patient_id: r.patient_id,
      doctor_id: r.doctor_id,
      appt_date: r.appt_date,
      appt_time: r.appt_time,
      concern: r.concern,
      status: r.status,
      diagnosis: r.diagnosis,
      doctor_comment: r.doctor_comment,
      created_at: r.created_at,
      patient_name: r['patient_name'],
      patient_email: r['patient_email']
    });
  }
  stmt.free();
  res.render('dashboard/doctor_appts', { appts });
});

router.post('/:id/status', ensureAuth('doctor'), body('status').isIn(['pending','confirmed','completed','cancelled']), async (req, res) => {
  const { id } = req.params;
  const { status, diagnosis, doctor_comment } = req.body;
  const db = await getDb();

  // Fetch current doctor's name and specialization for permissive matching (same as listing)
  const meStmt = db.prepare('SELECT name, COALESCE(specialization, "") AS spec FROM users WHERE id=? LIMIT 1');
  meStmt.bind([req.session.user.id]);
  let myName = '', mySpec = '';
  if (meStmt.step()) {
    const r = meStmt.getAsObject();
    myName = r.name || '';
    mySpec = r.spec || '';
  }
  meStmt.free();

  // Check ownership either by exact doctor_id or by matching name/specialization of the assigned doctor
  const own = db.prepare(`
    SELECT 1
    FROM appointments a
    JOIN users d ON d.id = a.doctor_id
    WHERE a.id = ?
      AND (
        a.doctor_id = ? OR (
          lower(trim(d.name)) = lower(trim(?)) AND ifnull(lower(trim(d.specialization)), '') = ifnull(lower(trim(?)), '')
        )
      )
    LIMIT 1
  `);
  own.bind([id, req.session.user.id, myName, mySpec]);
  const exists = own.step();
  own.free();
  if (!exists) return res.status(404).render('404');

  db.run('UPDATE appointments SET status=?, diagnosis=?, doctor_comment=? WHERE id=?', [status, diagnosis || null, doctor_comment || null, id]);
  await persistDb();
  req.flash('success', 'Status updated');
  res.redirect('/appointments/doctor');
});

module.exports = router;
