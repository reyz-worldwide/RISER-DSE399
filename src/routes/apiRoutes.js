const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getUserPerformance, getLeaderboard } = require('../services/performanceService');
const router = express.Router();
router.get('/performance', requireAuth, async (req, res) => res.json(await getUserPerformance(req.session.user.id)));
router.get('/leaderboard', requireAuth, async (req, res) => res.json(await getLeaderboard()));
module.exports = router;
