const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getTeamOverview } = require('../services/performanceService');
const { getManagerRecommendations } = require('../services/recommendationService');
const { generateMonthlyReport, getReports } = require('../services/reportService');
const router = express.Router();

router.get('/reports', requireAuth, requireRole('manager','admin'), async (req, res) => {
  const overview = await getTeamOverview();
  const reports = await getReports();
  const recommendations = req.session.user.role === 'manager' ? await getManagerRecommendations() : [];
  res.render('manager_reports', { title: 'Manager Reports', overview, leaderboard: overview.leaderboard, reports, recommendations });
});
router.post('/reports', requireAuth, requireRole('manager','admin'), async (req, res) => {
  await generateMonthlyReport(req.session.user.id, req.body.period || 'May 2026');
  req.flash('success', 'Monthly appraisal report generated.');
  res.redirect('/manager/reports');
});
module.exports = router;
