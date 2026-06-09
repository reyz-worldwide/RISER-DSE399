const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { get, run } = require('../config/db');
const { redirectIfAuth } = require('../middleware/auth');
const router = express.Router();

async function userCount() {
  const row = await get('SELECT COUNT(*) AS total FROM users');
  return row ? row.total : 0;
}

function buildSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    team: user.team,
    weekly_goal: user.weekly_goal,
    monthly_target: user.monthly_target,
    avatar_url: user.avatar_url,
    status: user.status
  };
}

router.get('/', async (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  if ((await userCount()) === 0) return res.redirect('/setup');
  res.redirect('/login');
});

router.get('/setup', redirectIfAuth, async (req, res) => {
  if ((await userCount()) > 0) return res.redirect('/login');
  res.render('setup', { title: 'System Setup' });
});

router.post('/setup', redirectIfAuth, [
  body('name').trim().isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('team').optional({ checkFalsy: true }).trim().isLength({ min: 2 })
], async (req, res) => {
  if ((await userCount()) > 0) return res.redirect('/login');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', 'Enter a valid name, email and password with at least 8 characters.');
    return res.redirect('/setup');
  }
  const hash = await bcrypt.hash(req.body.password, 10);
  await run(`INSERT INTO users(name,email,password_hash,role,team,weekly_goal,monthly_target,status,avatar_url)
             VALUES(?,?,?,?,?,?,?,?,?)`, [
    req.body.name,
    req.body.email.toLowerCase(),
    hash,
    'admin',
    req.body.team || 'System Administration',
    0,
    0,
    'active',
    '/img/admin-avatar.svg'
  ]);
  const user = await get('SELECT * FROM users WHERE email=?', [req.body.email.toLowerCase()]);
  req.session.user = buildSessionUser(user);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [user.id, 'SYSTEM_SETUP_COMPLETED', 'Initial administrator account created']);
  res.redirect('/dashboard');
});

router.get('/login', redirectIfAuth, async (req, res) => {
  if ((await userCount()) === 0) return res.redirect('/setup');
  res.render('login', { title: 'Login' });
});

router.post('/login', redirectIfAuth, [body('email').isEmail(), body('password').notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { req.flash('error', 'Enter a valid email and password.'); return res.redirect('/login'); }
  const user = await get('SELECT * FROM users WHERE email=? AND status=?', [req.body.email.toLowerCase(), 'active']);
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    req.flash('error', 'Invalid email or password.'); return res.redirect('/login');
  }
  req.session.user = buildSessionUser(user);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [user.id, 'USER_LOGIN', 'User signed in']);
  res.redirect('/dashboard');
});

router.get('/register', redirectIfAuth, async (req, res) => {
  if ((await userCount()) === 0) return res.redirect('/setup');
  res.render('register', { title: 'Register' });
});

router.post('/register', redirectIfAuth, [
  body('name').trim().isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 8 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { req.flash('error', 'Name, valid email and 8-character password are required.'); return res.redirect('/register'); }
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    await run('INSERT INTO users(name,email,password_hash,role,team,avatar_url,status) VALUES(?,?,?,?,?,?,?)', [req.body.name, req.body.email.toLowerCase(), hash, 'agent', 'Alpha Growth Team', '/img/agent-avatar.svg', 'active']);
    req.flash('success', 'Registration successful. Please login.'); res.redirect('/login');
  } catch (e) { req.flash('error', 'Email already exists.'); res.redirect('/register'); }
});

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
module.exports = router;
