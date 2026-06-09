const test = require('node:test');
const assert = require('node:assert');
const { calculateSummary } = require('../src/services/performanceService');

test('calculateSummary returns meaningful KPI values', () => {
  const summary = calculateSummary([
    { sales_count: 3, customer_count: 10, hours_worked: 3, mood_level: 4 },
    { sales_count: 2, customer_count: 8, hours_worked: 2, mood_level: 3 }
  ]);
  assert.equal(summary.totalSales, 5);
  assert.equal(summary.totalCustomers, 18);
  assert(summary.totalScore >= 0 && summary.totalScore <= 100);
});
