import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import dotenv from 'dotenv';

const deployment = process.argv[2];
const cli = process.argv[3];
if (!deployment?.startsWith('https://comunia-') || !cli) throw new Error('Informe a URL e o caminho da CLI.');
let cookie = '';
let fixtureId;
const checked = [];
function request(path, method = 'GET', body, expected = 200, origin = deployment) {
  const args = [cli, 'curl', path, '--deployment', deployment, '--', '--silent', '--show-error', '--max-time', '30', '--request', method,
    '--header', `Origin: ${origin}`, '--header', 'Content-Type: application/json',
    '--dump-header', '.local/smoke-headers.txt', '--output', '.local/smoke-response.json'];
  if (cookie) {
    writeFileSync('.local/smoke-cookie.txt', `Cookie: ${cookie}`);
    args.push('--header', '@.local/smoke-cookie.txt');
  }
  if (body !== undefined) {
    writeFileSync('.local/smoke-request.json', JSON.stringify(body));
    args.push('--data-binary', '@.local/smoke-request.json');
  }
  execFileSync(process.execPath, args, { stdio: 'pipe', windowsHide: true });
  const headers = readFileSync('.local/smoke-headers.txt', 'utf8');
  const status = Number([...headers.matchAll(/HTTP\/\S+ (\d+)/g)].at(-1)?.[1]);
  assert.equal(status, expected, `${method} ${path} retornou ${status}`);
  const raw = readFileSync('.local/smoke-response.json', 'utf8');
  const session = headers.match(/^set-cookie:\s*(session=[^;]+);/im)?.[1];
  checked.push(`${method} ${path}: ${status}`);
  return { headers, session, raw, data: headers.toLowerCase().includes('application/json') ? JSON.parse(raw) : null };
}
const remote = dotenv.parse(readFileSync('.local/cloud.env'));
const db = new pg.Client({ connectionString: remote.DATABASE_URL_UNPOOLED });
try {
  await db.connect();
  assert.equal(request('/api/health').data.status, 'ok');
  const html = request('/').raw;
  assert.ok(html.includes('<div id="root">'));
  const asset = html.match(/src="([^\"]+\.js)"/)?.[1];
  assert.ok(asset);
  assert.ok(!request(asset).raw.includes('Comunia@123'), 'Senha local presente no bundle público');
  request('/api/events', 'GET', undefined, 401);
  request('/api/auth/login', 'POST', {}, 403, 'https://attacker.example');
  request('/api/auth/login', 'POST', { email: 'admin@comunia.local', password: 'Comunia@123' }, 401);
  const secrets = readFileSync('.local/ACESSOS-ONLINE.md', 'utf8');
  const adminPassword = secrets.match(/admin: admin@comunia\.local\s+Senha: (\S+)/)?.[1];
  assert.ok(adminPassword);
  const login = request('/api/auth/login', 'POST', { email: 'admin@comunia.local', password: adminPassword });
  assert.match(login.headers, /; Secure/i);
  assert.match(login.headers, /; HttpOnly/i);
  cookie = login.session;
  assert.ok(cookie);
  assert.ok(request('/api/admin/overview').data);
  request('/api/auth/logout', 'POST');
  cookie = '';
  const signup = request('/api/auth/register', 'POST', { name: 'Validação da hospedagem', email: `qa-${randomUUID()}@comunia.local`, password: randomUUID() }, 201);
  fixtureId = signup.data.id;
  cookie = signup.session;
  request('/api/admin/overview', 'GET', undefined, 403);
  const events = request('/api/events').data;
  assert.ok(events.every((e) => e.published));
  const free = events.find((e) => e.price_cents === 0 && e.registered < e.capacity && new Date(e.starts_at) > new Date());
  assert.ok(free);
  const registration = request(`/api/events/${free.id}/register`, 'POST', {}, 201).data;
  assert.equal(registration.status, 'confirmed');
  assert.ok(request('/api/registrations').data.some((r) => r.id === registration.id));
  request(`/api/registrations/${registration.id}/cancel`, 'POST');
  const answer = request('/api/chat', 'POST', { message: 'Quais são os próximos eventos?' }).data;
  assert.ok(answer);
  request('/api/auth/logout', 'POST');
  request('/api/auth/me', 'GET', undefined, 401);
  writeFileSync('.local/cloud-smoke.json', JSON.stringify({ checkedAt: new Date().toISOString(), deployment, checked }, null, 2));
  console.log('Validação de nuvem concluída:', checked.length, 'requisições verificadas.');
} finally {
  if (fixtureId) {
    await db.query('BEGIN');
    await db.query('DELETE FROM payments WHERE registration_id IN (SELECT id FROM registrations WHERE user_id=$1)', [fixtureId]);
    for (const table of ['registrations', 'notifications', 'chat_messages', 'support_requests'])
      await db.query(`DELETE FROM ${table} WHERE user_id=$1`, [fixtureId]);
    await db.query('DELETE FROM users WHERE id=$1', [fixtureId]);
    await db.query('COMMIT');
  }
  await db.end();
}
