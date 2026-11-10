import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import webpush from 'web-push';
import { app } from '../server/app.js';
import { disconnectDatabase, query } from '../server/db.js';
const server = app.listen(0, '127.0.0.1');
const address = await new Promise<string>((resolve) =>
  server.on('listening', () => resolve(`http://127.0.0.1:${(server.address() as any).port}/api`)),
);
const createdUsers: number[] = [],
  createdEvents: number[] = [],
  createdKnowledge: number[] = [],
  createdWhatsAppEvents: string[] = [];
let adminCookie = '',
  memberCookie = '',
  otherCookie = '';
const testRateKeys = [
  createHash('sha256').update('/auth/login:127.0.0.1').digest('hex'),
  createHash('sha256').update('/auth/register:127.0.0.1').digest('hex'),
  createHash('sha256').update('login-account:admin@comunia.local').digest('hex'),
  createHash('sha256').update('public-chat:127.0.0.1').digest('hex'),
];
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
async function rawRequest(path: string, options: RequestInit = {}) {
  return fetch(address + path, options);
}
before(async () => {
  await query('DELETE FROM auth_attempts WHERE key = ANY($1::text[])', [testRateKeys]);
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
  for (const providerId of createdWhatsAppEvents)
    await query('DELETE FROM whatsapp_events WHERE provider_id=$1', [providerId]);
  await query("DELETE FROM notifications WHERE body LIKE 'QA isolado %'");
  await query('DELETE FROM auth_attempts WHERE key = ANY($1::text[])', [testRateKeys]);
  if (adminCookie) await request('/auth/logout', 'POST', {}, adminCookie);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDatabase();
});
test('autenticação e permissões protegem dados e administração', async () => {
  assert.equal((await request('/events')).status, 401);
  assert.equal((await request('/admin/overview', 'GET', undefined, memberCookie)).status, 403);
  assert.equal((await request('/admin/integrations')).status, 401);
  assert.equal((await request('/admin/integrations', 'GET', undefined, memberCookie)).status, 403);
  const integrations = await request('/admin/integrations', 'GET', undefined, adminCookie);
  assert.equal(integrations.status, 200);
  assert.equal(typeof integrations.data.push.configured, 'boolean');
  assert.equal(typeof integrations.data.whatsapp.configured, 'boolean');
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

test('visitante consulta página pública e assistente sem criar sessão', async () => {
  const events = await request('/public/events');
  assert.equal(events.status, 200);
  assert.ok(events.data.length > 0);
  assert.ok(events.data.every((event: any) => event.published));
  assert.equal((await request('/public/notices')).status, 200);

  const publicAnswer = await request('/public/chat', 'POST', {
    message: 'Quais são os próximos eventos?',
  });
  assert.equal(publicAnswer.status, 200);
  assert.equal(publicAnswer.data.intent, 'events');

  const privateAnswer = await request('/public/chat', 'POST', { message: 'Meus ingressos' });
  assert.equal(privateAnswer.status, 200);
  assert.equal(privateAnswer.data.intent, 'auth');
  assert.match(privateAnswer.data.answer, /entre na sua conta/i);
  assert.equal((await request('/chat')).status, 401);
});

test('webhook do WhatsApp exige assinatura e não revela dados privados', async () => {
  const previous = {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phone: process.env.WHATSAPP_PHONE_NUMBER_ID,
    verify: process.env.WHATSAPP_VERIFY_TOKEN,
    secret: process.env.WHATSAPP_APP_SECRET,
  };
  process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-teste';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
  process.env.WHATSAPP_VERIFY_TOKEN = 'verificacao-de-teste';
  process.env.WHATSAPP_APP_SECRET = 'segredo-de-teste';
  const providerId = `wamid.qa.${Date.now()}`;
  createdWhatsAppEvents.push(providerId);
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: providerId,
                  from: '5511999999999',
                  type: 'text',
                  text: { body: 'Meus ingressos' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(body).digest('hex')}`;
  const originalFetch = globalThis.fetch;
  let graphRequest: any = null;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith('https://graph.facebook.com/')) {
      graphRequest = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.reply' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };
  try {
    const verification = await rawRequest(
      '/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verificacao-de-teste&hub.challenge=12345',
    );
    assert.equal(verification.status, 200);
    assert.equal(await verification.text(), '12345');
    assert.equal(
      (
        await rawRequest('/integrations/whatsapp/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=errada' },
          body,
        })
      ).status,
      401,
    );
    const accepted = await rawRequest('/integrations/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body,
    });
    assert.equal(accepted.status, 200);
    assert.equal(graphRequest.to, '5511999999999');
    assert.match(graphRequest.text.body, /entre na sua conta/i);
    const stored = (
      await query('SELECT provider_id,intent,status FROM whatsapp_events WHERE provider_id=$1', [
        providerId,
      ])
    ).rows[0];
    assert.deepEqual(stored, { provider_id: providerId, intent: 'auth', status: 'sent' });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      WHATSAPP_ACCESS_TOKEN: previous.token,
      WHATSAPP_PHONE_NUMBER_ID: previous.phone,
      WHATSAPP_VERIFY_TOKEN: previous.verify,
      WHATSAPP_APP_SECRET: previous.secret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('push é opt-in, autenticado e cada membro controla apenas seu dispositivo', async (t) => {
  const previous = {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  };
  const keys = webpush.generateVAPIDKeys();
  Object.assign(process.env, {
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: 'mailto:qa@example.test',
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  assert.equal((await request('/push/config')).status, 401);
  const config = await request('/push/config', 'GET', undefined, memberCookie);
  assert.equal(config.status, 200);
  assert.equal(config.data.enabled, true);
  assert.ok(config.data.publicKey);
  const subscription = {
    endpoint: `https://push.example.test/${Date.now()}`,
    keys: { p256dh: 'p'.repeat(80), auth: 'a'.repeat(24) },
  };
  assert.equal(
    (await request('/push/subscriptions', 'POST', subscription, memberCookie)).status,
    201,
  );
  assert.equal(
    (await request('/push/subscriptions', 'POST', subscription, otherCookie)).status,
    409,
  );
  assert.equal(
    (
      await request(
        '/push/subscriptions',
        'DELETE',
        { endpoint: subscription.endpoint },
        otherCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await query('SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint=$1', [
        subscription.endpoint,
      ])
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await request(
        '/push/subscriptions',
        'DELETE',
        { endpoint: subscription.endpoint },
        memberCookie,
      )
    ).status,
    200,
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

test('Prisma mantém respostas HTTP para duplicidade e registros ausentes', async () => {
  const duplicate = await request('/auth/register', 'POST', {
    name: 'Duplicado',
    email: 'admin@comunia.local',
    password: 'Teste@12345',
  });
  assert.equal(duplicate.status, 409);
  const missing = await request(
    '/admin/knowledge/2147483647',
    'PUT',
    {
      title: 'Conteúdo ausente',
      keywords: 'ausente',
      answer: 'Resposta de teste ausente.',
    },
    adminCookie,
  );
  assert.equal(missing.status, 404);
  const me = await request('/auth/me', 'GET', undefined, adminCookie);
  assert.equal(me.status, 200);
  assert.equal('password_hash' in me.data, false);
});
test('administrador escolhe o perfil das pessoas com proteções de acesso', async () => {
  const userId = createdUsers[0];
  assert.equal(
    (await request(`/admin/users/${userId}/role`, 'PUT', { role: 'owner' }, adminCookie)).status,
    400,
  );
  const promoted = await request(
    `/admin/users/${userId}/role`,
    'PUT',
    { role: 'admin' },
    adminCookie,
  );
  assert.equal(promoted.status, 200);
  assert.equal(promoted.data.role, 'admin');
  assert.equal((await request('/admin/overview', 'GET', undefined, memberCookie)).status, 200);
  const selfDemotion = await request(
    `/admin/users/${userId}/role`,
    'PUT',
    { role: 'member' },
    memberCookie,
  );
  assert.equal(selfDemotion.status, 409);
  const demoted = await request(
    `/admin/users/${userId}/role`,
    'PUT',
    { role: 'member' },
    adminCookie,
  );
  assert.equal(demoted.status, 200);
  assert.equal(demoted.data.role, 'member');
  assert.equal((await request('/admin/overview', 'GET', undefined, memberCookie)).status, 403);
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
