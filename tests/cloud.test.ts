import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

process.env.VERCEL = '1';
process.env.VERCEL_URL = 'comunia-preview.example';
process.env.VERCEL_PROJECT_PRODUCTION_URL = 'comunia.example';
process.env.APP_ORIGINS = 'https://comunidade.example';
const { app } = await import('../server/app.js');
const { disconnectDatabase, query } = await import('../server/db.js');
const { consumeAttempt } = await import('../server/rate-limit.js');
const { allowedOrigins } = await import('../server/runtime.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.on('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDatabase();
});

test('nuvem aceita apenas origens exatas e não libera localhost', async () => {
  const allowed = allowedOrigins();
  assert.ok(allowed.has('https://comunia.example'));
  assert.ok(allowed.has('https://comunia-preview.example'));
  assert.ok(allowed.has('https://comunidade.example'));
  assert.ok(!allowed.has('http://127.0.0.1:3001'));
  const blocked = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: 'https://comunia.example.attacker.example' },
  });
  assert.equal(blocked.status, 403);
});

test('cookie de sessão publicado exige HTTPS e logout invalida a sessão', async () => {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: 'https://comunia.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: 'admin' }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie') || '';
  try {
    assert.match(cookie, /; Secure/i);
    assert.match(cookie, /; HttpOnly/i);
    assert.match(cookie, /; SameSite=Strict/i);
  } finally {
    await fetch(base + '/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: cookie.split(';')[0] },
    });
  }
  assert.equal(
    (await fetch(base + '/api/auth/me', { headers: { Cookie: cookie.split(';')[0] } })).status,
    401,
  );
});

test('limite distribuído é atômico sob concorrência e expira', async () => {
  const scope = 'qa-' + randomUUID();
  const key = createHash('sha256').update(`${scope}:member`).digest('hex');
  try {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeAttempt(scope, 'member', 3)),
    );
    assert.equal(results.filter((r) => r.allowed).length, 3);
    assert.equal((await consumeAttempt(scope, 'member', 3)).allowed, false);
    await query("UPDATE auth_attempts SET expires_at=now()-interval '1 second' WHERE key=$1", [
      key,
    ]);
    assert.equal((await consumeAttempt(scope, 'member', 3)).allowed, true);
  } finally {
    await query('DELETE FROM auth_attempts WHERE key=$1', [key]);
  }
});
