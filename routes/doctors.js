const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function getDoctorPhoto(name, specialization) {
  const spec = String(specialization||'').toLowerCase().replace(/\s+/g, ',');
  const base = `${name||''}-${specialization||''}`;
  let hash = 0; for (let i=0;i<base.length;i++){ hash = ((hash<<5)-hash) + base.charCodeAt(i); hash |= 0; }
  const sig = Math.abs(hash);
  return `https://source.unsplash.com/800x600/?doctor,${encodeURIComponent(spec||'medicine')}&sig=${sig}`;
}

router.get('/', async (req, res) => {
  const db = await getDb();
  // Group by normalized name + specialization to avoid duplicate-looking entries
  const result = db.exec("SELECT MIN(id) as id, MIN(name) as name, MIN(email) as email, COALESCE(specialization,'') as specialization, MAX(COALESCE(bio,'')) as bio, MAX(COALESCE(photo,'')) as photo FROM users WHERE role='doctor' GROUP BY lower(trim(name)), lower(trim(COALESCE(specialization,''))) ORDER BY lower(trim(name))");
  let doctors = result[0] ? result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    specialization: row[3],
    bio: row[4],
    photo: row[5]
  })) : [];
  doctors = doctors.map(d => ({ ...d, photo: d.photo || getDoctorPhoto(d.name, d.specialization) }));
  res.render('doctors/index', { doctors });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await getDb();
  const stmt = db.prepare("SELECT id, name, email, specialization, bio, photo FROM users WHERE id=? AND role='doctor' LIMIT 1");
  stmt.bind([id]);
  let doctor = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    doctor = { id: row.id, name: row.name, email: row.email, specialization: row.specialization, bio: row.bio, photo: row.photo };
  }
  stmt.free();
  if (doctor) doctor.photo = doctor.photo || getDoctorPhoto(doctor.name, doctor.specialization);
  if (!doctor) return res.status(404).render('404');
  res.render('doctors/show', { doctor });
});

module.exports = router;
