const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');

test('login page loads', async () => {
  const res = await request(app).get('/login');
  assert.equal(res.status, 200);
  assert.match(res.text, /RISER/);
});

test('protected dashboard redirects when unauthenticated', async () => {
  const res = await request(app).get('/dashboard');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/login');
});
