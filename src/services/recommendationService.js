const { run, all } = require('../config/db');
const { getUserPerformance, getTeamOverview } = require('./performanceService');

function buildAgentRecommendations(summary) {
  const recs = [];
  if (summary.totalCustomers < 40) recs.push(['High', 'Contact at least 12 warm prospects today.', 'Customer engagement is below the weekly target.']);
  if (summary.totalFollowups < 18) recs.push(['High', 'Complete at least 5 follow-ups before the next product sharing session.', 'Follow-up activity is a strong conversion driver.']);
  if (Number(summary.avgMood) < 3.5) recs.push(['Medium', 'Use a shorter 45-minute focused work block to avoid burnout.', 'Mood score shows motivation may be fluctuating.']);
  if (summary.totalHours < 15) recs.push(['High', 'Block 2 hours tonight for customer follow-up and product explanation.', 'Time investment is currently below the planned commitment level.']);
  if (summary.consistency < 80) recs.push(['Medium', 'Log activity daily for the next 5 days to improve consistency score.', 'Consistent tracking gives more accurate analytics and recommendation output.']);
  if (!recs.length) recs.push(['Low', 'Maintain current momentum and mentor one junior agent this week.', 'Your growth, consistency and engagement indicators are healthy.']);
  return recs;
}

function buildManagerRecommendations(overview) {
  const { leaderboard, summary } = overview;
  const low = leaderboard.filter(a => a.totalScore < 55);
  const inconsistent = leaderboard.filter(a => a.consistency < 70);
  const recs = [];
  if (low.length) recs.push(['High', `Arrange coaching check-ins with ${low.map(a => a.name).join(', ')}.`, 'These agents are below the target performance score and may need structured support.']);
  if (inconsistent.length) recs.push(['Medium', 'Run a weekly activity logging reminder for inconsistent agents.', 'Consistency score affects fair performance evaluation and report accuracy.']);
  if (summary.topPerformer) recs.push(['Low', `Recognise ${summary.topPerformer.name} as current top performer.`, 'Recognition supports motivation and leadership development.']);
  if (summary.totalFollowups < summary.totalCustomers * 0.35) recs.push(['Medium', 'Emphasise follow-up discipline during the next team meeting.', 'Team follow-up volume is low compared with customer engagement.']);
  return recs;
}

async function refreshAgentRecommendations(userId) {
  const { summary } = await getUserPerformance(userId);
  const recs = buildAgentRecommendations(summary);
  await run("DELETE FROM recommendations WHERE user_id=? AND audience='agent'", [userId]);
  for (const [priority, task, reason] of recs) {
    await run('INSERT INTO recommendations(user_id,audience,task,priority,reason) VALUES(?,?,?,?,?)', [userId, 'agent', task, priority, reason]);
  }
  return all("SELECT * FROM recommendations WHERE user_id=? AND audience='agent' ORDER BY id DESC", [userId]);
}

async function getManagerRecommendations() {
  const overview = await getTeamOverview();
  return buildManagerRecommendations(overview).map(([priority, task, reason], index) => ({ id: index + 1, priority, task, reason }));
}

module.exports = { buildAgentRecommendations, buildManagerRecommendations, refreshAgentRecommendations, getManagerRecommendations };
