const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const flash = require('connect-flash');
const morgan = require('morgan');
const methodOverride = require('method-override');
const layouts = require('express-ejs-layouts');

const { initDb, seedInitial, resetToIndianDoctorsIfNeeded } = require('./db');

const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');

const app = express();

// Init DB and seed (async)
(async () => {
  await initDb();
  await resetToIndianDoctorsIfNeeded();
  await seedInitial();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(layouts);
  app.set('layout', 'partials/layout');

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride('_method'));
  app.use(morgan('dev'));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(
    session({
      store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'data') }),
      secret: 'super-secure-hospital-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
    })
  );
  app.use(flash());

  // Expose user and flash to views
  app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
  });

  // Home
  app.get('/', (req, res) => {
    res.render('home');
  });

  // Routes
  app.use('/auth', authRoutes);
  app.use('/doctors', doctorRoutes);
  app.use('/appointments', appointmentRoutes);
  app.use('/dashboard', dashboardRoutes);
  app.use('/profile', profileRoutes);
  app.use('/admin', adminRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).render('404');
  });

  // 500
  app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).render('500');
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Hospital Management app running on http://localhost:${PORT}`);
  });
})();
