const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const morgan = require('morgan');
const methodOverride = require('method-override');
const { initDatabase } = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const activityRoutes = require('./src/routes/activityRoutes');
const managerRoutes = require('./src/routes/managerRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const apiRoutes = require('./src/routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'riser-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 3 }
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/activity', activityRoutes);
app.use('/manager', managerRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => res.status(404).render('404', { title: 'Page Not Found' }));

initDatabase().then(() => {
  if (require.main === module) {
    app.listen(PORT, () => console.log(`RISER server running at http://localhost:${PORT}`));
  }
}).catch(err => {
  console.error('Database initialisation failed:', err);
  process.exit(1);
});

module.exports = app;
