import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../server/app.js';
import { pool, query } from '../server/db.js';
const server = app.listen(0, '127.0.0.1');
const address = await new Promise<string>((resolve) =>
  server.on('listening', () => resolve(`http://127.0.0.1:${(server.address() as any).port}/api`)),
);
const createdUsers: number[] = [],
  createdEvents: number[] = [],
  createdKnowledge: number[] = [];
let adminCookie = '',
  memberCookie = '',
  otherCookie = '';
async function request(path: string, method = 'GET', body?: unknown, cookie = '') {
  const response = await fetch(address + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
  };
}
before(async () => {
  const login = await request('/auth/login', 'POST', {
    email: 'admin',
    password: 'admin',
  });
  assert.equal(login.status, 200);
  adminCookie = login.cookie;
  for (let i = 0; i < 2; i++) {
    const user = await request('/auth/register', 'POST', {
      name: `Teste automático ${i}`,
      email: `qa-${Date.now()}-${i}@comunia.local`,
      password: 'Teste@12345',
    });
    assert.equal(user.status, 201);
    createdUsers.push(user.data.id);
    if (i === 0) memberCookie = user.cookie;
    else otherCookie = user.cookie;
  }
});
after(async () => {
  // Remove only fixtures created by this test run, preserving all demonstration/user data.
  for (const uid of createdUsers) {
    await query(
      'DELETE FROM payments WHERE registration_id IN (SELECT id FROM registrations WHERE user_id=$1)',
      [uid],
    );
    await query('DELETE FROM registrations WHERE user_id=$1', [uid]);
    await query('DELETE FROM notifications WHERE user_id=$1', [uid]);
    await query('DELETE FROM chat_messages WHERE user_id=$1', [uid]);
    await query('DELETE FROM support_requests WHERE user_id=$1', [uid]);
    await query('DELETE FROM users WHERE id=$1', [uid]);
  }
  for (const eid of createdEvents) await query('DELETE FROM events WHERE id=$1', [eid]);
  for (const kid of createdKnowledge) await query('DELETE FROM knowledge WHERE id=$1', [kid]);
  await query("DELETE FROM notifications WHERE body LIKE 'QA isolado %'");
  if (adminCookie) await request('/auth/logout', 'POST', {}, adminCookie);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});
test('autenticação e permissões protegem dados e administração', async () => {
  assert.equal((await request('/events')).status, 401);
  assert.equal((await request('/admin/overview', 'GET', undefined, memberCookie)).status, 403);
  assert.equal(
    (await request('/auth/login', 'POST', { email: 'admin@comunia.local', password: 'errada123' }))
      .status,
    401,
  );
  assert.equal(
    (await request('/auth/register', 'POST', { name: 'X', email: 'invalid', password: '123' }))
      .status,
    400,
  );
});

test('admin aceita usuário curto sem enfraquecer a validação de novos cadastros', async () => {
  assert.equal(
    (await request('/auth/login', 'POST', { email: 'admin', password: 'xxxxx' })).status,
    401,
  );
  const login = await request('/auth/login', 'POST', {
    email: 'admin@comunia.local',
    password: 'admin',
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.role, 'admin');
  await request('/auth/logout', 'POST', {}, login.cookie);
  assert.equal(
    (
      await request('/auth/register', 'POST', {
        name: 'Teste',
        email: 'short@comunia.local',
        password: 'admin',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/auth/register', 'POST', {
        name: 'Teste',
        email: 'admin',
        password: 'SenhaLonga123',
      })
    ).status,
    400,
  );
});
test('evento, disputa de última vaga, pagamento, isolamento e cancelamento', async () => {
  const event = {
    title: 'QA isolado última vaga',
    description: 'Evento exclusivo do teste automatizado de integração.',
    category: 'Oficina',
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    location: 'Sala QA',
    capacity: 1,
    price_cents: 2500,
    theme: 'blue',
    published: true,
  };
  const created = await request('/admin/events', 'POST', event, adminCookie);
  assert.equal(created.status, 201);
  const eid = created.data.id;
  createdEvents.push(eid);
  const results = await Promise.all([
    request(`/events/${eid}/register`, 'POST', {}, memberCookie),
    request(`/events/${eid}/register`, 'POST', {}, otherCookie),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const winnerIndex = results.findIndex((r) => r.status === 201);
  const winnerCookie = winnerIndex === 0 ? memberCookie : otherCookie;
  const loserCookie = winnerIndex === 0 ? otherCookie : memberCookie;
  const rid = results[winnerIndex].data.id;
  assert.equal(results[winnerIndex].data.status, 'pending');
  assert.equal((await request(`/registrations/${rid}/pay`, 'POST', {}, loserCookie)).status, 404);
  const payments = await Promise.all([
    request(`/registrations/${rid}/pay`, 'POST', {}, winnerCookie),
    request(`/registrations/${rid}/pay`, 'POST', {}, winnerCookie),
  ]);
  assert.deepEqual(payments.map((p) => p.status).sort(), [200, 409]);
  const registration = (await request('/registrations', 'GET', undefined, winnerCookie)).data.find(
    (r: any) => r.id === rid,
  );
  assert.equal(registration.status, 'confirmed');
  assert.equal(
    (await query('SELECT count(*)::int AS n FROM payments WHERE registration_id=$1', [rid])).rows[0]
      .n,
    1,
  );
  assert.equal(
    (await request(`/registrations/${rid}/cancel`, 'POST', {}, winnerCookie)).status,
    200,
  );
  assert.equal(
    (await query('SELECT status FROM payments WHERE registration_id=$1', [rid])).rows[0].status,
    'refunded',
  );
  assert.equal((await request(`/events/${eid}/register`, 'POST', {}, loserCookie)).status, 201);
  const notifications = await request('/notifications', 'GET', undefined, winnerCookie);
  assert.ok(notifications.data.some((n: any) => n.title === 'Pagamento simulado aprovado'));
  await request('/notifications/read', 'POST', {}, winnerCookie);
  assert.ok(
    (await request('/notifications', 'GET', undefined, winnerCookie)).data.every(
      (n: any) => n.read,
    ),
  );
});
test('chatbot consulta eventos reais, base editada e encaminha atendimento', async () => {
  const knowledge = await request(
    '/admin/knowledge',
    'POST',
    {
      title: 'QA instrução',
      keywords: 'testeunicoqa',
      answer: 'Resposta da base local, validada.',
    },
    adminCookie,
  );
  assert.equal(knowledge.status, 201);
  createdKnowledge.push(knowledge.data.id);
  const answer = await request('/chat', 'POST', { message: 'testeunicoqa' }, memberCookie);
  assert.equal(answer.data.answer, 'Resposta da base local, validada.');
  const event = await request('/chat', 'POST', { message: 'Próximos eventos' }, memberCookie);
  assert.equal(event.data.intent, 'events');
  assert.ok(event.data.answer.includes('QA isolado'));
  const unknown = await request(
    '/chat',
    'POST',
    { message: 'xyzsemcorrespondencia' },
    memberCookie,
  );
  assert.equal(unknown.data.intent, 'fallback');
  const human = await request('/chat', 'POST', { message: 'Quero um atendente' }, memberCookie);
  assert.equal(human.data.intent, 'human');
  const overview = await request('/admin/overview', 'GET', undefined, adminCookie);
  const ticket = overview.data.support.find((s: any) => s.name === 'Teste automático 0');
  assert.ok(ticket);
  assert.equal(
    (await request(`/admin/support/${ticket.id}/close`, 'POST', {}, adminCookie)).status,
    200,
  );
  const history = await request('/chat', 'GET', undefined, memberCookie);
  assert.equal(history.data.length, 8);
  assert.equal((await request('/chat', 'GET', undefined, otherCookie)).data.length, 0);
});
test('validação de eventos rejeita preço negativo e capacidade inválida', async () => {
  const invalid = {
    title: 'QA inválido',
    description: 'Evento inválido de teste.',
    category: 'Comunidade',
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    location: 'Sala QA',
    capacity: 0,
    price_cents: -1,
    theme: 'forest',
    published: false,
  };
  assert.equal((await request('/admin/events', 'POST', invalid, adminCookie)).status, 400);
});
