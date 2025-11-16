# Hospital Management System (Express + EJS + SQLite)

A complete, minimal hospital management web app with:

- Patient registration and login
- Doctor registration and login
- Seeded doctors list (viewable by anyone)
- Patient can book appointments with doctors and view "My Appointments"
- Doctor dashboard to view patient appointments and update status
- Flash messages, validation, 404/500 pages, session-backed auth

## Tech

- Node.js, Express
- EJS + express-ejs-layouts
- better-sqlite3 (file-based DB), connect-sqlite3 (session store)
- express-session, express-validator, bcryptjs

## Setup

1) Install Node.js 18+.
2) In a terminal, run:

```
npm install
npm run start
```

The server starts at http://localhost:3000

SQLite DB file is created at `data/hospital.sqlite`. Session store at `data/sessions.sqlite`.

## Seeded Doctors

These doctors are pre-loaded. All have password: `doctor123`.

- aisha.khan@hospital.test (Cardiologist)
- rohan.mehta@hospital.test (Dermatologist)
- emily.chen@hospital.test (Pediatrician)
- omar.farooq@hospital.test (Orthopedic Surgeon)

## Usage Flow

- Register as a patient: /auth/register/patient
- Register as a doctor: /auth/register/doctor
- Login: /auth/login
- Browse doctors: /doctors
- As patient: book via "Book Appointment", then view at /appointments/mine or Dashboard
- As doctor: see Dashboard and /appointments/doctor, update status

## Notes

- Passwords are hashed with bcrypt.
- Validation and flash messages guide users.
- Method override is enabled for future PUT/DELETE needs.

