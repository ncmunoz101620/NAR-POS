import test from 'node:test';
import assert from 'node:assert/strict';

test('expired admin sessions redirect once, including CSRF expiry before JSON parsing', async () => {
  const redirects = [];
  globalThis.window = { location: { pathname: '/admin/orders', replace: (url) => redirects.push(url) } };
  globalThis.document = { querySelector: () => ({ getAttribute: () => 'test-token' }) };
  const { request } = await import('../../src/api/client.js');
  globalThis.fetch = async () => ({ status: 419 });
  await assert.rejects(request('/orders', 'POST', {}), { sessionExpired: true, status: 419 });
  globalThis.fetch = async () => ({ status: 401 });
  await assert.rejects(request('/orders'), { sessionExpired: true, status: 401 });
  assert.deepEqual(redirects, ['/login']);
  const { isSessionRedirecting } = await import('../../src/lib/sessionExpiry.js');
  assert.equal(isSessionRedirecting(), true);
});

test('guest pages, login failures, and permission errors do not trigger expiry redirect', async () => {
  const { redirectExpiredSession } = await import('../../src/lib/sessionExpiry.js');
  for (const path of ['/login', '/', '/menu', '/checkout']) {
    globalThis.window = { location: { pathname: path, replace: () => assert.fail('Unexpected redirect') } };
    assert.equal(redirectExpiredSession(401), false);
    assert.equal(redirectExpiredSession(419), false);
  }
  window.location.pathname = '/admin/orders';
  assert.equal(redirectExpiredSession(403), false);
  assert.equal(redirectExpiredSession(422), false);
  assert.equal(redirectExpiredSession(500), false);
});
