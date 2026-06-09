const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { run, get } = require('../config/db');
const { getActivities } = require('../services/performanceService');
const { refreshAgentRecommendations } = require('../services/recommendationService');
const router = express.Router();

const validators = [
  body('activity_date').isISO8601(),
  body('sales_count').isInt({ min: 0 }),
  body('customer_count').isInt({ min: 0 }),
  body('followups_count').isInt({ min: 0 }),
  body('hours_worked').isFloat({ min: 0 }),
  body('mood_level').isInt({ min: 1, max: 5 }),
  body('commitment_level').isInt({ min: 1, max: 5 }),
  body('schedule_preference').trim().isLength({ min: 3 })
];

router.get('/', requireAuth, requireRole('agent'), async (req, res) => {
  const activities = await getActivities(req.session.user.id);
  res.render('activity', { title: 'Activity Input', activities, editActivity: null });
});
router.get('/:id/edit', requireAuth, requireRole('agent'), async (req, res) => {
  const activities = await getActivities(req.session.user.id);
  const editActivity = await get('SELECT * FROM activities WHERE id=? AND user_id=?', [req.params.id, req.session.user.id]);
  res.render('activity', { title: 'Edit Activity', activities, editActivity });
});
router.post('/', requireAuth, requireRole('agent'), validators, async (req, res) => {
  if (!validationResult(req).isEmpty()) { req.flash('error', 'Please fill all activity fields with valid values.'); return res.redirect('/activity'); }
  await run(`INSERT INTO activities(user_id,activity_date,sales_count,customer_count,followups_count,hours_worked,mood_level,commitment_level,schedule_preference,customer_update)
             VALUES(?,?,?,?,?,?,?,?,?,?)`, [req.session.user.id, req.body.activity_date, req.body.sales_count, req.body.customer_count, req.body.followups_count, req.body.hours_worked, req.body.mood_level, req.body.commitment_level, req.body.schedule_preference, req.body.customer_update || '']);
  await refreshAgentRecommendations(req.session.user.id);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'ACTIVITY_CREATED', `Recorded activity for ${req.body.activity_date}`]);
  req.flash('success', 'Daily activity recorded and analytics updated.'); res.redirect('/dashboard');
});
router.post('/:id/update', requireAuth, requireRole('agent'), validators, async (req, res) => {
  if (!validationResult(req).isEmpty()) { req.flash('error', 'Please fill all activity fields with valid values.'); return res.redirect(`/activity/${req.params.id}/edit`); }
  await run(`UPDATE activities SET activity_date=?, sales_count=?, customer_count=?, followups_count=?, hours_worked=?, mood_level=?, commitment_level=?, schedule_preference=?, customer_update=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
    [req.body.activity_date, req.body.sales_count, req.body.customer_count, req.body.followups_count, req.body.hours_worked, req.body.mood_level, req.body.commitment_level, req.body.schedule_preference, req.body.customer_update || '', req.params.id, req.session.user.id]);
  await refreshAgentRecommendations(req.session.user.id);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'ACTIVITY_UPDATED', `Updated activity ID ${req.params.id}`]);
  req.flash('success', 'Activity updated and recommendations recalculated.'); res.redirect('/activity');
});
router.post('/:id/delete', requireAuth, requireRole('agent'), async (req, res) => {
  await run('DELETE FROM activities WHERE id=? AND user_id=?', [req.params.id, req.session.user.id]);
  await refreshAgentRecommendations(req.session.user.id);
  await run('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)', [req.session.user.id, 'ACTIVITY_DELETED', `Deleted activity ID ${req.params.id}`]);
  req.flash('success', 'Activity deleted.'); res.redirect('/activity');
});
module.exports = router;
