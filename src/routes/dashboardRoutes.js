const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getUserPerformance, getTeamOverview, getActivities } = require('../services/performanceService');
const { refreshAgentRecommendations, getManagerRecommendations } = require('../services/recommendationService');
const { run, all } = require('../config/db');
const router = express.Router();

router.get('/dashboard', requireAuth, async (req, res) => {
  if (req.session.user.role === 'manager') {
    const overview = await getTeamOverview();
    const recommendations = await getManagerRecommendations();
    return res.render('dashboard', { title: 'Manager Dashboard', mode: 'manager', overview, recommendations });
  }
  if (req.session.user.role === 'admin') {
    const overview = await getTeamOverview();
    const logs = await all('SELECT a.*, u.name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 5');
    return res.render('dashboard', { title: 'Admin Dashboard', mode: 'admin', overview, recommendations: [], logs });
  }
  const { summary } = await getUserPerformance(req.session.user.id);
  const recommendations = await refreshAgentRecommendations(req.session.user.id);
  res.render('dashboard', { title: 'Agent Dashboard', mode: 'agent', summary, recommendations });
});

router.get('/analytics', requireAuth, async (req, res) => {
  if (req.session.user.role === 'manager' || req.session.user.role === 'admin') {
    const overview = await getTeamOverview();
    return res.render('analytics', { title: 'Team Analytics Dashboard', mode: 'team', overview, activities: [], summary: overview.summary });
  }
  const { activities, summary } = await getUserPerformance(req.session.user.id);
  res.render('analytics', { title: 'Analytics Dashboard', mode: 'agent', activities: activities.slice().reverse(), summary });
});

router.get('/history', requireAuth, requireRole('agent'), async (req, res) => {
  const activities = await getActivities(req.session.user.id);
  res.render('history', { title: 'Historical Performance', activities: activities.slice().reverse() });
});

router.get('/goals', requireAuth, requireRole('agent'), async (req, res) => {
  const goals = await all('SELECT * FROM goals WHERE user_id=? ORDER BY created_at DESC', [req.session.user.id]);
  const { summary } = await getUserPerformance(req.session.user.id);
  res.render('goals', { title: 'Goals & Targets', goals, summary });
});
router.post('/goals', requireAuth, requireRole('agent'), [
  body('period').trim().isLength({ min: 3 }),
  body('sales_target').isInt({ min: 0 }),
  body('customer_target').isInt({ min: 0 }),
  body('followup_target').isInt({ min: 0 })
], async (req, res) => {
  if (!validationResult(req).isEmpty()) { req.flash('error', 'Please enter valid goal details.'); return res.redirect('/goals'); }
  await run('INSERT INTO goals(user_id,period,sales_target,customer_target,followup_target,customer_focus) VALUES(?,?,?,?,?,?)', [req.session.user.id, req.body.period, req.body.sales_target, req.body.customer_target, req.body.followup_target, req.body.customer_focus || '']);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'GOAL_CREATED', `Created ${req.body.period} targets`]);
  req.flash('success', 'Goal target saved successfully.');
  res.redirect('/goals');
});

router.get('/leaderboard', requireAuth, async (req, res) => {
  const leaderboard = await require('../services/performanceService').getLeaderboard();
  res.render('leaderboard', { title: 'Ranking & Leaderboard', leaderboard });
});

router.get('/settings', requireAuth, (req, res) => res.render('settings', { title: 'Settings' }));
router.post('/settings', requireAuth, [
  body('name').trim().isLength({ min: 3 }),
  body('team').trim().isLength({ min: 2 }),
  body('weekly_goal').optional().isInt({ min: 0, max: 999 }),
  body('monthly_target').optional().isInt({ min: 0, max: 9999 }),
  body('avatar_url').optional({ checkFalsy: true }).isString()
], async (req, res) => {
  if (!validationResult(req).isEmpty()) { req.flash('error', 'Please enter valid profile information.'); return res.redirect('/settings'); }
  const avatar = req.body.avatar_url || (req.session.user.role === 'manager' ? '/img/manager-avatar.svg' : (req.session.user.role === 'admin' ? '/img/admin-avatar.svg' : '/img/agent-avatar.svg'));
  await run('UPDATE users SET name=?, team=?, weekly_goal=?, monthly_target=?, avatar_url=? WHERE id=?', [req.body.name, req.body.team, req.body.weekly_goal || 0, req.body.monthly_target || 0, avatar, req.session.user.id]);
  req.session.user.name = req.body.name; req.session.user.team = req.body.team; req.session.user.weekly_goal = req.body.weekly_goal || 0; req.session.user.monthly_target = req.body.monthly_target || 0; req.session.user.avatar_url = avatar;
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'PROFILE_UPDATED', 'User updated profile settings']);
  req.flash('success', 'Profile updated successfully.'); res.redirect('/settings');
});
router.post('/settings/password', requireAuth, [body('password').isLength({ min: 8 })], async (req, res) => {
  if (!validationResult(req).isEmpty()) { req.flash('error', 'Password must contain at least 8 characters.'); return res.redirect('/settings'); }
  await run('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), req.session.user.id]);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'PASSWORD_UPDATED', 'User changed password']);
  req.flash('success', 'Password updated successfully.'); res.redirect('/settings');
});
module.exports = router;
