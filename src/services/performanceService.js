const { all, get } = require('../config/db');

function scoreClamp(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))); }

async function getActivities(userId) {
  return all('SELECT * FROM activities WHERE user_id=? ORDER BY activity_date DESC, id DESC', [userId]);
}

function calculateStreak(activities = []) {
  const uniqueDates = [...new Set(activities.map(a => a.activity_date))].sort().reverse();
  if (!uniqueDates.length) return 0;
  let streak = 1;
  let prev = new Date(uniqueDates[0]);
  for (let i = 1; i < uniqueDates.length; i++) {
    const current = new Date(uniqueDates[i]);
    const diff = Math.round((prev - current) / (1000 * 60 * 60 * 24));
    if (diff === 1) { streak++; prev = current; } else if (diff > 1) break;
  }
  return streak;
}

function calculateSummary(activities = [], user = {}) {
  const totalSales = activities.reduce((sum, a) => sum + Number(a.sales_count || 0), 0);
  const totalCustomers = activities.reduce((sum, a) => sum + Number(a.customer_count || 0), 0);
  const totalFollowups = activities.reduce((sum, a) => sum + Number(a.followups_count || 0), 0);
  const totalHours = activities.reduce((sum, a) => sum + Number(a.hours_worked || 0), 0);
  const avgMoodRaw = activities.length ? activities.reduce((sum, a) => sum + Number(a.mood_level || 0), 0) / activities.length : 0;
  const avgCommitmentRaw = activities.length ? activities.reduce((sum, a) => sum + Number(a.commitment_level || 0), 0) / activities.length : 0;
  const avgCustomers = activities.length ? totalCustomers / activities.length : 0;
  const avgSales = activities.length ? totalSales / activities.length : 0;
  const activeDays = new Set(activities.map(a => a.activity_date)).size;
  const conversionRate = totalCustomers ? (totalSales / totalCustomers) * 100 : 0;
  const consistency = scoreClamp(activeDays >= 5 ? 90 + Math.min(activeDays, 10) : activeDays * 18);
  const growth = scoreClamp((avgSales * 16) + (avgCustomers * 2.8) + (conversionRate * .6));
  const engagement = scoreClamp((totalCustomers * 2.2) + (totalFollowups * 2.6) + (totalHours * 3.4));
  const leadership = scoreClamp((avgCommitmentRaw * 12) + (avgMoodRaw * 8) + (activeDays * 5));
  const totalScore = scoreClamp((growth * .30) + (consistency * .25) + (engagement * .25) + (leadership * .20));
  const weeklyGoal = Number(user.weekly_goal || 50);
  const monthlyTarget = Number(user.monthly_target || 200);
  const goalProgress = weeklyGoal ? scoreClamp((totalCustomers / weeklyGoal) * 100) : 0;
  const monthlyProgress = monthlyTarget ? scoreClamp((totalCustomers / monthlyTarget) * 100) : 0;
  const streak = calculateStreak(activities);
  const badges = [];
  if (totalScore >= 80) badges.push('High Performer');
  if (consistency >= 85) badges.push('Consistency Builder');
  if (totalFollowups >= 20) badges.push('Follow-up Champion');
  if (leadership >= 75) badges.push('Leadership Potential');
  if (streak >= 3) badges.push(`${streak}-Day Activity Streak`);
  if (!badges.length) badges.push('Growth in Progress');
  return {
    totalSales,
    totalCustomers,
    totalFollowups,
    totalHours: Number(totalHours.toFixed(1)),
    avgMood: avgMoodRaw.toFixed(1),
    avgCommitment: avgCommitmentRaw.toFixed(1),
    activeDays,
    conversionRate: Number(conversionRate.toFixed(1)),
    growth,
    consistency,
    engagement,
    leadership,
    totalScore,
    weeklyGoal,
    monthlyTarget,
    goalProgress,
    monthlyProgress,
    streak,
    badges
  };
}

async function getUserPerformance(userId) {
  const user = await get('SELECT id,name,email,role,team,weekly_goal,monthly_target,avatar_url FROM users WHERE id=?', [userId]);
  const activities = await getActivities(userId);
  return { user, activities, summary: calculateSummary(activities, user || {}) };
}

async function getLeaderboard() {
  const users = await all("SELECT id, name, email, role, team, weekly_goal, monthly_target, avatar_url FROM users WHERE role='agent' AND status='active' ORDER BY name ASC");
  const rows = [];
  for (const user of users) {
    const perf = await getUserPerformance(user.id);
    rows.push({ ...user, ...perf.summary });
  }
  return rows.sort((a, b) => b.totalScore - a.totalScore).map((r, index) => ({ position: index + 1, ...r }));
}

async function getTeamOverview() {
  const leaderboard = await getLeaderboard();
  const teamScore = leaderboard.length ? Math.round(leaderboard.reduce((s, r) => s + r.totalScore, 0) / leaderboard.length) : 0;
  const totalSales = leaderboard.reduce((s, r) => s + r.totalSales, 0);
  const totalCustomers = leaderboard.reduce((s, r) => s + r.totalCustomers, 0);
  const totalFollowups = leaderboard.reduce((s, r) => s + r.totalFollowups, 0);
  const avgConsistency = leaderboard.length ? Math.round(leaderboard.reduce((s, r) => s + r.consistency, 0) / leaderboard.length) : 0;
  const avgEngagement = leaderboard.length ? Math.round(leaderboard.reduce((s, r) => s + r.engagement, 0) / leaderboard.length) : 0;
  const topPerformer = leaderboard[0] || null;
  const needsSupport = leaderboard.filter(r => r.totalScore < 55);
  const highPotential = leaderboard.filter(r => r.leadership >= 70);
  return { leaderboard, summary: { teamScore, totalSales, totalCustomers, totalFollowups, avgConsistency, avgEngagement, topPerformer, needsSupportCount: needsSupport.length, highPotentialCount: highPotential.length } };
}

module.exports = { getActivities, calculateSummary, getUserPerformance, getLeaderboard, getTeamOverview };
