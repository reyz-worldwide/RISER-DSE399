const { run, all } = require('../config/db');
const { getTeamOverview } = require('./performanceService');
const { buildManagerRecommendations } = require('./recommendationService');

async function generateMonthlyReport(managerId, period = 'May 2026') {
  const overview = await getTeamOverview();
  const { leaderboard, summary } = overview;
  const recommendations = buildManagerRecommendations(overview);
  const top = summary.topPerformer;
  const support = leaderboard.filter(a => a.totalScore < 55).map(a => a.name).join(', ') || 'None';
  const summaryText = `Period: ${period}\nTotal Agents: ${leaderboard.length}\nAverage Team Score: ${summary.teamScore}\nTotal Sales: ${summary.totalSales}\nTotal Customers Contacted: ${summary.totalCustomers}\nTotal Follow-ups: ${summary.totalFollowups}\nTop Performer: ${top ? `${top.name} (${top.totalScore})` : 'N/A'}\nAgents Requiring Support: ${support}\nManager AI Recommendations:\n${recommendations.map(r => `- [${r[0]}] ${r[1]}`).join('\n')}\n\nManager Summary: Team productivity is evaluated using growth, consistency, engagement and leadership indicators for objective appraisal and leadership identification.`;
  await run('INSERT INTO reports(manager_id,period,summary) VALUES(?,?,?)', [managerId, period, summaryText]);
  return summaryText;
}
async function getReports() { return all('SELECT r.*, u.name AS manager_name FROM reports r JOIN users u ON u.id=r.manager_id ORDER BY r.created_at DESC'); }
module.exports = { generateMonthlyReport, getReports };
