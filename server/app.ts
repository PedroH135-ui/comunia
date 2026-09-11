import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'node:crypto';
import { z, ZodError } from 'zod';
import { pool, query, prisma } from './db.js';
import { hash, verify } from './security.js';
import { cloud, secureCookies, allowedOrigins } from './runtime.js';
import { consumeAttempt } from './rate-limit.js';
import {
  extractWhatsAppTextMessages,
  sendWhatsAppText,
  verifyWhatsAppSignature,
  whatsappConfigured,
} from './whatsapp.js';
import { pushConfigured, pushPublicConfig, sendPushToUsers } from './push.js';

export const app = express();
app.disable('x-powered-by');
if (cloud) app.set('trust proxy', 1);
app.use(
  express.json({
    limit: '64kb',
    verify: (req, _res, buffer) => {
      (req as Request).rawBody = Buffer.from(buffer);
    },
  }),
);
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; upgrade-insecure-requests",
  );
  if (cloud) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Cache-Control', 'no-store');
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin &&
    !allowedOrigins().has(req.headers.origin)
  )
    return res.status(403).json({ error: 'Origem não autorizada.' });
  next();
});
type User = { id: number; name: string; email: string; role: string };
declare global {
  namespace Express {
    interface Request {
      user?: User;
      rawBody?: Buffer;
    }
  }
}
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const auth = async (req: Request, _res: Response, next: NextFunction) => {
  const active = await prisma.sessions.findFirst({
    where: { token: req.cookies.session || '', expires_at: { gt: new Date() } },
    select: { users: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!active?.users) throw fail('Entre na sua conta para continuar.', 401);
  req.user = active.users;
  next();
};
const admin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') throw fail('Acesso exclusivo da administração.', 403);
  next();
};
const id = (s: unknown) => z.coerce.number().int().positive().parse(s);
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

async function answerChat(message: string, user?: User) {
  const input = normalize(message);
  let answer = '';
  let intent = 'fallback';
  if (/atendente|humano|pastor|oracao/.test(input)) {
    if (!user) {
      return {
        intent: 'auth',
        answer:
          'Para solicitar atendimento da equipe, entre ou crie sua conta. Assim conseguimos identificar você e acompanhar o pedido com privacidade.',
      };
    }
    intent = 'human';
    answer =
      'Registrei seu pedido para a equipe de acolhimento. Um administrador pode acompanhá-lo no painel. Nesta V1, o retorno acontece por aqui na comunidade, sem envio automático por WhatsApp.';
    await prisma.support_requests.create({ data: { user_id: user.id, message } });
  } else if (/inscri|meus eventos|ingresso/.test(input)) {
    if (!user) {
      return {
        intent: 'auth',
        answer:
          'Para consultar inscrições e ingressos, entre na sua conta. As informações pessoais ficam protegidas e vinculadas somente a você.',
      };
    }
    intent = 'registrations';
    const rows = await prisma.registrations.findMany({
      where: { user_id: user.id, status: { not: 'cancelled' } },
      select: { status: true, events: { select: { title: true } } },
    });
    answer = rows.length
      ? 'Suas inscrições:\n' +
        rows
          .map(
            (r) =>
              `• ${r.events.title} — ${r.status === 'confirmed' ? 'confirmada' : 'pagamento simulado pendente'}`,
          )
          .join('\n')
      : 'Você ainda não tem inscrições ativas. Abra Eventos e escolha um encontro para participar.';
  } else if (/evento|programacao|agenda|retiro|proximo/.test(input)) {
    intent = 'events';
    const rows = await prisma.events.findMany({
      where: { published: true, starts_at: { gt: new Date() } },
      orderBy: { starts_at: 'asc' },
      take: 5,
      select: { title: true, starts_at: true, price_cents: true },
    });
    answer = rows.length
      ? 'Confira os próximos encontros:\n' +
        rows
          .map(
            (e) =>
              `• ${e.title} — ${new Date(e.starts_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · ${e.price_cents === 0 ? 'gratuito' : (e.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          )
          .join('\n') +
        '\nVocê pode se inscrever pela página Eventos.'
      : 'Ainda não há próximos eventos publicados. Volte em breve para conferir a agenda.';
  } else if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigad)/.test(input)) {
    intent = 'greeting';
    answer =
      'Olá! Que bom ter você por aqui. Posso ajudar com eventos, horários e localização. O que você gostaria de saber?';
  } else {
    const rows = await prisma.knowledge.findMany({ orderBy: { id: 'asc' } });
    const matches = rows
      .map((k) => ({
        k,
        score: k.keywords
          .split(',')
          .filter((word: string) => input.includes(normalize(word.trim()))).length,
      }))
      .sort((a, b) => b.score - a.score);
    if (matches[0]?.score) {
      intent = 'knowledge';
      answer = matches[0].k.answer;
    } else {
      answer =
        'Ainda não encontrei essa informação na base da comunidade. Posso consultar eventos, horários e localização.';
    }
  }
  return { answer, intent };
}
const session = async (res: Response, user: User) => {
  const token = randomBytes(32).toString('hex');
  await prisma.sessions.create({
    data: { token, user_id: user.id, expires_at: new Date(Date.now() + 7 * 86400000) },
  });
  res.cookie('session', token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'strict',
    maxAge: 7 * 86400000,
    path: '/',
  });
};
const registrationSchema = z.object({
  email: z
    .string()
    .email()
    .max(200)
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
async function limitAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await consumeAttempt(req.path, req.ip || 'local', 30);
    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}
app.get('/api/health', async (_req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', database: 'PostgreSQL', version: '1.0.0', payments: 'simulated' });
});
app.post('/api/auth/login', limitAuth, async (req, res) => {
  const data = loginSchema.parse(req.body);
  const email = data.email === 'admin' ? 'admin@comunia.local' : data.email;
  const accountLimit = await consumeAttempt('login-account', email, 15);
  if (!accountLimit.allowed) {
    res.setHeader('Retry-After', accountLimit.retryAfter);
    throw fail('Muitas tentativas. Aguarde alguns minutos.', 429);
  }
  const account = await prisma.users.findUnique({ where: { email } });
  if (
    !account ||
    (data.email === 'admin' && account.role !== 'admin') ||
    !verify(data.password, account.password_hash)
  ) {
    throw fail('Login ou senha incorretos.', 401);
  }
  const { password_hash, ...user } = account;
  await session(res, user);
  res.json(user);
});
app.post('/api/auth/register', limitAuth, async (req, res) => {
  const data = registrationSchema
    .extend({ name: z.string().trim().min(2).max(80) })
    .parse(req.body);
  const user = await prisma.users.create({
    data: { name: data.name, email: data.email, password_hash: hash(data.password) },
    select: { id: true, name: true, email: true, role: true },
  });
  await session(res, user);
  res.status(201).json(user);
});
app.post('/api/auth/logout', async (req, res) => {
  await prisma.sessions.deleteMany({ where: { token: req.cookies.session || '' } });
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});
app.get('/api/auth/me', auth, (req, res) => res.json(req.user));

app.get('/api/public/events', async (_req, res) => {
  const events = await prisma.events.findMany({
    where: { published: true },
    orderBy: { starts_at: 'asc' },
    include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
  });
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json(events.map(({ _count, ...event }) => ({ ...event, registered: _count.registrations })));
});
app.get('/api/public/notices', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json(await prisma.notices.findMany({ orderBy: [{ created_at: 'desc' }, { id: 'desc' }] }));
});
app.post('/api/public/chat', async (req, res) => {
  const rate = await consumeAttempt('public-chat', req.ip || 'local', 40);
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfter);
    throw fail('Muitas mensagens em pouco tempo. Aguarde alguns minutos.', 429);
  }
  const { message } = z.object({ message: z.string().trim().min(1).max(1000) }).parse(req.body);
  res.json(await answerChat(message));
});

app.get('/api/integrations/whatsapp/webhook', (req, res) => {
  const query = z
    .object({
      'hub.mode': z.literal('subscribe'),
      'hub.verify_token': z.string().min(1).max(500),
      'hub.challenge': z.string().min(1).max(500),
    })
    .safeParse(req.query);
  if (
    !query.success ||
    !process.env.WHATSAPP_VERIFY_TOKEN ||
    query.data['hub.verify_token'] !== process.env.WHATSAPP_VERIFY_TOKEN
  )
    return res.status(403).send('Verificação recusada.');
  res.type('text/plain').send(query.data['hub.challenge']);
});

app.post('/api/integrations/whatsapp/webhook', async (req, res) => {
  if (!whatsappConfigured()) throw fail('Integração do WhatsApp indisponível.', 503);
  if (!verifyWhatsAppSignature(req.rawBody, req.get('X-Hub-Signature-256')))
    throw fail('Assinatura do webhook inválida.', 401);
  const messages = extractWhatsAppTextMessages(req.body);
  for (const message of messages) {
    const previous = await prisma.whatsapp_events.findUnique({
      where: { provider_id: message.id },
    });
    if (previous?.status === 'sent' || previous?.status === 'processing') continue;
    try {
      if (previous)
        await prisma.whatsapp_events.update({
          where: { provider_id: message.id },
          data: { status: 'processing' },
        });
      else
        await prisma.whatsapp_events.create({
          data: { provider_id: message.id, status: 'processing' },
        });
    } catch (error: any) {
      if (error?.code === 'P2002') continue;
      throw error;
    }
    try {
      const answer = await answerChat(message.text);
      await sendWhatsAppText(message.from, answer.answer);
      await prisma.whatsapp_events.update({
        where: { provider_id: message.id },
        data: { intent: answer.intent, status: 'sent' },
      });
    } catch (error) {
      await prisma.whatsapp_events.update({
        where: { provider_id: message.id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }
  res.json({ received: true });
});
app.use('/api', auth);
app.get('/api/events', async (req, res) => {
  const events = await prisma.events.findMany({
    where: req.user!.role === 'admin' ? {} : { published: true },
    orderBy: { starts_at: 'asc' },
    include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
  });
  res.json(events.map(({ _count, ...event }) => ({ ...event, registered: _count.registrations })));
});
app.get('/api/notices', async (_req, res) =>
  res.json(await prisma.notices.findMany({ orderBy: [{ created_at: 'desc' }, { id: 'desc' }] })),
);
app.get('/api/notifications', async (req, res) =>
  res.json(
    await prisma.notifications.findMany({
      where: { user_id: req.user!.id },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 100,
    }),
  ),
);
app.post('/api/notifications/read', async (req, res) => {
  await prisma.notifications.updateMany({ where: { user_id: req.user!.id }, data: { read: true } });
  res.json({ ok: true });
});
const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith('https://'), 'Endpoint inválido.'),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(8).max(256),
  }),
});
app.get('/api/push/config', (_req, res) => res.json(pushPublicConfig()));
app.post('/api/push/subscriptions', async (req, res) => {
  if (!pushConfigured()) throw fail('Notificações do dispositivo indisponíveis.', 503);
  const subscription = pushSubscriptionSchema.parse(req.body);
  const owner = await prisma.push_subscriptions.findUnique({
    where: { endpoint: subscription.endpoint },
    select: { user_id: true },
  });
  if (owner && owner.user_id !== req.user!.id)
    throw fail('Esta assinatura já pertence a outra conta.', 409);
  if (owner)
    await prisma.push_subscriptions.update({
      where: { endpoint: subscription.endpoint },
      data: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });
  else
    await prisma.push_subscriptions.create({
      data: {
        user_id: req.user!.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  res.status(201).json({ ok: true });
});
app.delete('/api/push/subscriptions', async (req, res) => {
  const { endpoint } = pushSubscriptionSchema.pick({ endpoint: true }).parse(req.body);
  await prisma.push_subscriptions.deleteMany({
    where: { endpoint, user_id: req.user!.id },
  });
  res.json({ ok: true });
});
app.get('/api/registrations', async (req, res) => {
  const items = await prisma.registrations.findMany({
    where: { user_id: req.user!.id },
    orderBy: { created_at: 'desc' },
    include: { events: { select: { title: true, starts_at: true, location: true, theme: true } } },
  });
  res.json(items.map(({ events, ...registration }) => ({ ...registration, ...events })));
});
app.post('/api/events/:id/register', async (req, res) => {
  const eventId = id(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const event = (await client.query('SELECT * FROM events WHERE id=$1 FOR UPDATE', [eventId]))
      .rows[0];
    if (!event || !event.published) throw fail('Evento indisponível.', 404);
    if (new Date(event.starts_at) < new Date())
      throw fail('As inscrições para este evento já terminaram.');
    const previous = (
      await client.query('SELECT * FROM registrations WHERE user_id=$1 AND event_id=$2', [
        req.user!.id,
        eventId,
      ])
    ).rows[0];
    if (previous && previous.status !== 'cancelled')
      throw fail('Você já está inscrito neste evento.', 409);
    const count = (
      await client.query(
        "SELECT count(*)::int AS total FROM registrations WHERE event_id=$1 AND status<>'cancelled'",
        [eventId],
      )
    ).rows[0].total;
    if (count >= event.capacity) throw fail('As vagas deste evento se esgotaram.', 409);
    const status = event.price_cents > 0 ? 'pending' : 'confirmed';
    const ticket = 'COM-' + randomBytes(5).toString('hex').toUpperCase();
    const registration = (
      await client.query(
        `INSERT INTO registrations(user_id,event_id,status,amount_cents,ticket) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,event_id) DO UPDATE SET status=EXCLUDED.status,amount_cents=EXCLUDED.amount_cents,ticket=EXCLUDED.ticket,created_at=now() RETURNING *`,
        [req.user!.id, eventId, status, event.price_cents, ticket],
      )
    ).rows[0];
    await client.query('INSERT INTO notifications(user_id,title,body) VALUES($1,$2,$3)', [
      req.user!.id,
      status === 'pending' ? 'Inscrição reservada' : 'Inscrição confirmada',
      `${event.title}: ${status === 'pending' ? 'conclua o pagamento simulado em Minhas inscrições.' : 'sua presença está confirmada. Até lá!'}`,
    ]);
    await client.query('COMMIT');
    await sendPushToUsers([req.user!.id], {
      title: status === 'pending' ? 'Inscrição reservada' : 'Inscrição confirmada',
      body: `${event.title}: ${status === 'pending' ? 'conclua o pagamento simulado.' : 'sua presença está confirmada.'}`,
      url: '/?v=registrations',
      tag: `registration-${registration.id}`,
    });
    res.status(201).json(registration);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
app.post('/api/registrations/:id/pay', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = (
      await client.query('SELECT * FROM registrations WHERE id=$1 AND user_id=$2 FOR UPDATE', [
        id(req.params.id),
        req.user!.id,
      ])
    ).rows[0];
    if (!r) throw fail('Inscrição não encontrada.', 404);
    if (r.status !== 'pending') throw fail('Esta inscrição não possui pagamento pendente.', 409);
    await client.query(
      "INSERT INTO payments(registration_id,amount_cents,status) VALUES($1,$2,'approved') ON CONFLICT(registration_id) DO UPDATE SET amount_cents=EXCLUDED.amount_cents,status='approved',created_at=now()",
      [r.id, r.amount_cents],
    );
    await client.query("UPDATE registrations SET status='confirmed' WHERE id=$1", [r.id]);
    await client.query('INSERT INTO notifications(user_id,title,body) VALUES($1,$2,$3)', [
      req.user!.id,
      'Pagamento simulado aprovado',
      `Sua inscrição ${r.ticket} foi confirmada. Nenhum valor real foi cobrado.`,
    ]);
    await client.query('COMMIT');
    await sendPushToUsers([req.user!.id], {
      title: 'Pagamento simulado aprovado',
      body: 'Sua inscrição foi confirmada.',
      url: '/?v=registrations',
      tag: `payment-${r.id}`,
    });
    res.json({ ok: true, simulated: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
app.post('/api/registrations/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = (
      await client.query('SELECT * FROM registrations WHERE id=$1 AND user_id=$2 FOR UPDATE', [
        id(req.params.id),
        req.user!.id,
      ])
    ).rows[0];
    if (!r) throw fail('Inscrição não encontrada.', 404);
    if (r.status === 'cancelled') throw fail('Inscrição já cancelada.', 409);
    await client.query("UPDATE registrations SET status='cancelled' WHERE id=$1", [r.id]);
    await client.query("UPDATE payments SET status='refunded' WHERE registration_id=$1", [r.id]);
    await client.query('INSERT INTO notifications(user_id,title,body) VALUES($1,$2,$3)', [
      req.user!.id,
      'Inscrição cancelada',
      'A vaga foi liberada. Se houve pagamento de demonstração, o estorno também foi simulado.',
    ]);
    await client.query('COMMIT');
    await sendPushToUsers([req.user!.id], {
      title: 'Inscrição cancelada',
      body: 'A vaga foi liberada.',
      url: '/?v=registrations',
      tag: `cancel-${r.id}`,
    });
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
app.get('/api/chat', async (req, res) =>
  res.json(
    (
      await prisma.chat_messages.findMany({
        where: { user_id: req.user!.id },
        orderBy: { id: 'desc' },
        take: 60,
      })
    ).reverse(),
  ),
);
app.post('/api/chat', async (req, res) => {
  const { message } = z.object({ message: z.string().trim().min(1).max(1000) }).parse(req.body);
  const { answer, intent } = await answerChat(message, req.user!);
  await prisma.chat_messages.createMany({
    data: [
      { user_id: req.user!.id, role: 'user', content: message, intent },
      { user_id: req.user!.id, role: 'assistant', content: answer, intent },
    ],
  });
  res.json({ answer, intent });
});
app.use('/api/admin', admin);
app.get('/api/admin/integrations', (_req, res) =>
  res.json({
    whatsapp: {
      configured: whatsappConfigured(),
      webhookPath: '/api/integrations/whatsapp/webhook',
    },
    push: { configured: pushConfigured() },
  }),
);
app.get('/api/admin/overview', async (_req, res) => {
  const [stats, registrations, support, messages, users] = await Promise.all([
    query(
      "SELECT (SELECT count(*)::int FROM users WHERE role='member') AS members,(SELECT count(*)::int FROM events WHERE published=true AND starts_at>now()) AS events,(SELECT count(*)::int FROM registrations WHERE status<>'cancelled') AS registrations,(SELECT coalesce(sum(amount_cents),0)::int FROM payments WHERE status='approved') AS revenue,(SELECT count(*)::int FROM support_requests WHERE status='open') AS support",
    ),
    query(
      'SELECT r.*,u.name,u.email,e.title FROM registrations r JOIN users u ON u.id=r.user_id JOIN events e ON e.id=r.event_id ORDER BY r.created_at DESC LIMIT 100',
    ),
    query(
      'SELECT s.*,u.name,u.email FROM support_requests s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 100',
    ),
    query(
      "SELECT c.*,u.name FROM chat_messages c JOIN users u ON u.id=c.user_id WHERE c.role='user' ORDER BY c.id DESC LIMIT 30",
    ),
    query('SELECT id,name,email,role,created_at FROM users ORDER BY id'),
  ]);
  res.json({
    stats: stats.rows[0],
    registrations: registrations.rows,
    support: support.rows,
    messages: messages.rows,
    users: users.rows,
  });
});
app.put('/api/admin/users/:id/role', async (req, res) => {
  const userId = id(req.params.id);
  const { role } = z.object({ role: z.enum(['member', 'admin']) }).parse(req.body);
  if (userId === req.user!.id && role !== req.user!.role)
    throw fail('Peça a outro administrador para alterar o perfil da sua conta.', 409);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(20260909)');
    const current = (
      await c.query('SELECT id,name,email,role,created_at FROM users WHERE id=$1 FOR UPDATE', [
        userId,
      ])
    ).rows[0];
    if (!current) throw fail('Pessoa não encontrada.', 404);
    if (current.role === 'admin' && role === 'member') {
      const administrators = (
        await c.query("SELECT count(*)::int AS total FROM users WHERE role='admin'")
      ).rows[0].total;
      if (administrators <= 1)
        throw fail('A comunidade precisa manter pelo menos um administrador.', 409);
    }
    const updated = (
      await c.query(
        'UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,email,role,created_at',
        [role, userId],
      )
    ).rows[0];
    if (current.role !== role)
      await c.query('INSERT INTO notifications(user_id,title,body) VALUES($1,$2,$3)', [
        userId,
        'Seu perfil foi atualizado',
        role === 'admin'
          ? 'Você agora pode acessar o painel administrativo da comunidade.'
          : 'Seu acesso foi atualizado para o perfil de membro da comunidade.',
      ]);
    await c.query('COMMIT');
    res.json(updated);
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
});
const eventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  category: z.enum(['Jovens', 'Retiro', 'Comunidade', 'Voluntariado', 'Oficina']),
  starts_at: z.string().datetime({ offset: true }),
  location: z.string().trim().min(3).max(160),
  capacity: z.number().int().min(1).max(10000),
  price_cents: z.number().int().min(0).max(1000000),
  theme: z.enum(['forest', 'sand', 'peach', 'sage', 'blue']),
  published: z.boolean(),
});
app.post('/api/admin/events', async (req, res) => {
  const e = eventSchema.parse(req.body);
  if (new Date(e.starts_at) < new Date()) throw fail('Escolha uma data futura.');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await c.query(
      'INSERT INTO events(title,description,category,starts_at,location,capacity,price_cents,theme,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      Object.values(e),
    );
    if (e.published)
      await c.query('INSERT INTO notifications(user_id,title,body) SELECT id,$1,$2 FROM users', [
        'Novo evento na comunidade',
        `${e.title} está na agenda. Confira e participe!`,
      ]);
    await c.query('COMMIT');
    if (e.published)
      await sendPushToUsers(undefined, {
        title: 'Novo evento na comunidade',
        body: `${e.title} está na agenda. Confira e participe!`,
        url: '/?v=events',
        tag: `event-${result.rows[0].id}`,
      });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
});
app.put('/api/admin/events/:id', async (req, res) => {
  const e = eventSchema.parse(req.body);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const previous = (
      await c.query('SELECT * FROM events WHERE id=$1 FOR UPDATE', [id(req.params.id)])
    ).rows[0];
    if (!previous) throw fail('Evento não encontrado.', 404);
    const count = (
      await c.query(
        "SELECT count(*)::int AS n FROM registrations WHERE event_id=$1 AND status<>'cancelled'",
        [id(req.params.id)],
      )
    ).rows[0].n;
    if (e.capacity < count)
      throw fail(`Há ${count} vagas reservadas. A capacidade não pode ser menor.`);
    const result = await c.query(
      'UPDATE events SET title=$1,description=$2,category=$3,starts_at=$4,location=$5,capacity=$6,price_cents=$7,theme=$8,published=$9 WHERE id=$10 RETURNING *',
      [...Object.values(e), id(req.params.id)],
    );
    if (e.published && !previous.published)
      await c.query('INSERT INTO notifications(user_id,title,body) SELECT id,$1,$2 FROM users', [
        'Novo evento na comunidade',
        `${e.title} está na agenda.`,
      ]);
    else
      await c.query(
        "INSERT INTO notifications(user_id,title,body) SELECT user_id,$1,$2 FROM registrations WHERE event_id=$3 AND status<>'cancelled'",
        [
          'Atualização de evento',
          `${e.title} teve informações atualizadas. Confira os detalhes na agenda.`,
          id(req.params.id),
        ],
      );
    await c.query('COMMIT');
    const targetUsers =
      e.published && !previous.published
        ? undefined
        : (
            await query(
              "SELECT user_id FROM registrations WHERE event_id=$1 AND status<>'cancelled'",
              [id(req.params.id)],
            )
          ).rows.map((row) => row.user_id as number);
    await sendPushToUsers(targetUsers, {
      title:
        e.published && !previous.published ? 'Novo evento na comunidade' : 'Atualização de evento',
      body: `${e.title} teve informações atualizadas.`,
      url: '/?v=events',
      tag: `event-${id(req.params.id)}`,
    });
    res.json(result.rows[0]);
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
});
app.get('/api/admin/knowledge', async (_req, res) =>
  res.json(await prisma.knowledge.findMany({ orderBy: { id: 'asc' } })),
);
const knowledgeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  keywords: z.string().trim().min(2).max(500),
  answer: z.string().trim().min(5).max(4000),
});
app.post('/api/admin/knowledge', async (req, res) => {
  const k = knowledgeSchema.parse(req.body);
  res.status(201).json(await prisma.knowledge.create({ data: k }));
});
app.put('/api/admin/knowledge/:id', async (req, res) => {
  const k = knowledgeSchema.parse(req.body);
  res.json(
    await prisma.knowledge.update({
      where: { id: id(req.params.id) },
      data: { ...k, updated_at: new Date() },
    }),
  );
});
app.post('/api/admin/notices', async (req, res) => {
  const n = z
    .object({
      title: z.string().trim().min(3).max(120),
      body: z.string().trim().min(5).max(4000),
      category: z.string().trim().min(2).max(60),
    })
    .parse(req.body);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('INSERT INTO notices(title,body,category) VALUES($1,$2,$3)', Object.values(n));
    await c.query('INSERT INTO notifications(user_id,title,body) SELECT id,$1,$2 FROM users', [
      n.title,
      n.body,
    ]);
    await c.query('COMMIT');
    await sendPushToUsers(undefined, {
      title: n.title,
      body: n.body,
      url: '/?v=notices',
      tag: 'community-notice',
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
});
app.post('/api/admin/support/:id/close', async (req, res) => {
  await prisma.support_requests.update({
    where: { id: id(req.params.id) },
    data: { status: 'closed' },
  });
  res.json({ ok: true });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Confira os campos informados.', details: err.flatten() });
  if (err.code === '23505' || err.code === 'P2002')
    return res.status(409).json({ error: 'Este cadastro já existe.' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'Registro não encontrado.' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Não foi possível concluir. Tente novamente.' });
});
