const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');

const DOCTOR_EMAIL_DOMAIN = process.env.HOSPITAL_DOMAIN || 'hospital.test';

let dbInstance = null;

async function initDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'hospital.sqlite');

  let filebuffer;
  if (fs.existsSync(dbPath)) {
    filebuffer = fs.readFileSync(dbPath);
  } else {
    filebuffer = null;
  }

  dbInstance = new SQL.Database(filebuffer);

  // Enable WAL-like behavior if possible, but sql.js is in-memory, so persist on changes
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('patient','doctor')),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      specialization TEXT,
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appt_date TEXT NOT NULL,
      appt_time TEXT NOT NULL,
      concern TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_appts_doctor ON appointments(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_appts_patient ON appointments(patient_id);
  `);

  // Add new columns if they don't exist
  try { dbInstance.run("ALTER TABLE users ADD COLUMN photo TEXT"); } catch (e) {}
  try { dbInstance.run("ALTER TABLE appointments ADD COLUMN diagnosis TEXT"); } catch (e) {}
  try { dbInstance.run("ALTER TABLE appointments ADD COLUMN doctor_comment TEXT"); } catch (e) {}

  return dbInstance;
}

async function resetToIndianDoctorsIfNeeded() {
  const dataDir = path.join(__dirname, 'data');
  const flagPath = path.join(dataDir, 'seed_v2_applied.flag');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(flagPath)) return; // already reset

  if (!dbInstance) await initDb();

  // Wipe appointments and users
  dbInstance.run('DELETE FROM appointments');
  dbInstance.run('DELETE FROM users');

  // Seed Indian doctors
  const saltRounds = 10;
  const defaultPass = bcrypt.hashSync('doctor123', saltRounds);
  const doctors = [
    ['doctor','Dr. Aditi Sharma',`aditi.sharma@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Cardiologist','Compassionate cardiologist focused on preventive heart care.'],
    ['doctor','Dr. Rajesh Iyer',`rajesh.iyer@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Neurologist','Specialist in brain and nervous system disorders.'],
    ['doctor','Dr. Kavya Patel',`kavya.patel@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Pediatrician','Caring pediatrician dedicated to children’s health.'],
    ['doctor','Dr. Arjun Mehta',`arjun.mehta@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Orthopedic Surgeon','Expert in bone and joint treatments and sports injuries.'],
    ['doctor','Dr. Sneha Nair',`sneha.nair@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Dermatologist','Skin and hair specialist using modern therapies.']
  ];
  for (const row of doctors) {
    dbInstance.run('INSERT INTO users (role,name,email,password_hash,specialization,bio) VALUES (?,?,?,?,?,?)', row);
  }
  await persistDb();
  fs.writeFileSync(flagPath, 'ok');
}

async function persistDb() {
  if (!dbInstance) return;
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'hospital.sqlite');
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

async function seedInitial() {
  if (!dbInstance) await initDb();

  const saltRounds = 10;
  const defaultPass = bcrypt.hashSync('doctor123', saltRounds);

  const doctors = [
    ['doctor','Dr. Aditi Sharma',`aditi.sharma@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Cardiologist','Compassionate cardiologist focused on preventive heart care.'],
    ['doctor','Dr. Rajesh Iyer',`rajesh.iyer@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Neurologist','Specialist in brain and nervous system disorders.'],
    ['doctor','Dr. Kavya Patel',`kavya.patel@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Pediatrician','Caring pediatrician dedicated to children’s health.'],
    ['doctor','Dr. Arjun Mehta',`arjun.mehta@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Orthopedic Surgeon','Expert in bone and joint treatments and sports injuries.'],
    ['doctor','Dr. Sneha Nair',`sneha.nair@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Dermatologist','Skin and hair specialist using modern therapies.']
  ];
  // Insert if missing (use prepared SELECT)
  const checkStmt = dbInstance.prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
  for (const row of doctors) {
    const email = row[2];
    checkStmt.bind([email]);
    const exists = checkStmt.step();
    checkStmt.reset();
    if (!exists) {
      dbInstance.run('INSERT INTO users (role,name,email,password_hash,specialization,bio) VALUES (?,?,?,?,?,?)', row);
    }
  }
  checkStmt.free();
  await persistDb();
}

async function getDb() {
  if (!dbInstance) await initDb();
  return dbInstance;
}

module.exports = { initDb, seedInitial, getDb, persistDb, resetToIndianDoctorsIfNeeded, forceResetIndianDoctors };

async function forceResetIndianDoctors() {
  if (!dbInstance) await initDb();
  dbInstance.run('DELETE FROM appointments');
  dbInstance.run('DELETE FROM users');
  const saltRounds = 10;
  const defaultPass = bcrypt.hashSync('doctor123', saltRounds);
  const doctors = [
    ['doctor','Dr. Aditi Sharma',`aditi.sharma@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Cardiologist','Compassionate cardiologist focused on preventive heart care.'],
    ['doctor','Dr. Rajesh Iyer',`rajesh.iyer@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Neurologist','Specialist in brain and nervous system disorders.'],
    ['doctor','Dr. Kavya Patel',`kavya.patel@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Pediatrician','Caring pediatrician dedicated to children’s health.'],
    ['doctor','Dr. Arjun Mehta',`arjun.mehta@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Orthopedic Surgeon','Expert in bone and joint treatments and sports injuries.'],
    ['doctor','Dr. Sneha Nair',`sneha.nair@${DOCTOR_EMAIL_DOMAIN}`, defaultPass,'Dermatologist','Skin and hair specialist using modern therapies.']
  ];
  for (const row of doctors) {
    dbInstance.run('INSERT INTO users (role,name,email,password_hash,specialization,bio) VALUES (?,?,?,?,?,?)', row);
  }
  await persistDb();
}

module.exports.forceResetIndianDoctors = forceResetIndianDoctors;
