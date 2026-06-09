const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { requireAuth, requireRole } = require('../middleware/auth');
const { all, run } = require('../config/db');
const router = express.Router();

router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await all('SELECT id,name,email,role,team,status,weekly_goal,monthly_target,avatar_url,created_at FROM users ORDER BY role,name');
  const logs = await all('SELECT a.*, u.name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 12');
  res.render('admin_users', { title: 'Manage Users & Roles', users, logs });
});
router.post('/users', requireAuth, requireRole('admin'), [
  body('name').trim().isLength({ min: 3 }), body('email').isEmail(), body('password').isLength({ min: 8 }), body('role').isIn(['agent','manager','admin'])
], async (req, res) => {
  if (!validationResult(req).isEmpty()) { req.flash('error', 'Enter valid user details. Password must be at least 8 characters.'); return res.redirect('/admin/users'); }
  const defaultAvatar = req.body.role === 'manager' ? '/img/manager-avatar.svg' : (req.body.role === 'admin' ? '/img/admin-avatar.svg' : '/img/agent-avatar.svg');
  try {
    await run('INSERT INTO users(name,email,password_hash,role,team,weekly_goal,monthly_target,status,avatar_url) VALUES(?,?,?,?,?,?,?,?,?)', [req.body.name, req.body.email.toLowerCase(), await bcrypt.hash(req.body.password, 10), req.body.role, req.body.team || 'Alpha Growth Team', req.body.weekly_goal || 0, req.body.monthly_target || 0, 'active', req.body.avatar_url || defaultAvatar]);
    await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'USER_CREATED', `Created account for ${req.body.email}`]);
    req.flash('success', 'New user created successfully.');
  } catch (e) { req.flash('error', 'Email already exists.'); }
  res.redirect('/admin/users');
});
router.post('/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  if (!['agent','manager','admin'].includes(req.body.role)) { req.flash('error', 'Invalid role.'); return res.redirect('/admin/users'); }
  const defaultAvatar = req.body.role === 'manager' ? '/img/manager-avatar.svg' : (req.body.role === 'admin' ? '/img/admin-avatar.svg' : '/img/agent-avatar.svg');
  await run('UPDATE users SET role=?, team=?, weekly_goal=?, monthly_target=?, status=?, avatar_url=? WHERE id=?', [req.body.role, req.body.team || 'Alpha Growth Team', req.body.weekly_goal || 0, req.body.monthly_target || 0, req.body.status || 'active', req.body.avatar_url || defaultAvatar, req.params.id]);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'USER_CONFIGURATION_UPDATED', `Updated user ID ${req.params.id}`]);
  req.flash('success', 'User access configuration updated.'); res.redirect('/admin/users');
});

router.get('/settings', requireAuth, requireRole('admin'), async (req, res) => {
  const settings = await all('SELECT * FROM system_settings ORDER BY `key`');
  res.render('admin_settings', { title: 'System Settings', settings });
});
router.post('/settings', requireAuth, requireRole('admin'), async (req, res) => {
  const keys = Array.isArray(req.body.key) ? req.body.key : [req.body.key];
  const values = Array.isArray(req.body.value) ? req.body.value : [req.body.value];
  for (let i = 0; i < keys.length; i++) {
    await run('UPDATE system_settings SET value=? WHERE `key`=?', [values[i], keys[i]]);
  }
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'SYSTEM_SETTINGS_UPDATED', 'Updated KPI weights and recommendation rules']);
  req.flash('success', 'System settings updated.');
  res.redirect('/admin/settings');
});
module.exports = router;
