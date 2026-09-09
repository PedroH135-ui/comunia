import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'node:crypto';
import { z, ZodError } from 'zod';
import { pool, query } from './db.js';
import { hash, verify } from './security.js';
import { cloud, secureCookies, allowedOrigins } from './runtime.js';
import { consumeAttempt } from './rate-limit.js';

export const app = express();
app.disable('x-powered-by');
if (cloud) app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
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
    }
  }
}
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const auth = async (req: Request, _res: Response, next: NextFunction) => {
  const { rows } = await query(
    'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now()',
    [req.cookies.session || ''],
  );
  if (!rows[0]) throw fail('Entre na sua conta para continuar.', 401);
  req.user = rows[0];
  next();
};
const admin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') throw fail('Acesso exclusivo da administração.', 403);
  next();
};
const id = (s: unknown) => z.coerce.number().int().positive().parse(s);
const session = async (res: Response, user: User) => {
  const token = randomBytes(32).toString('hex');
  await query(
    "INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [token, user.id],
  );
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
  const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
  if (
    !rows[0] ||
    (data.email === 'admin' && rows[0].role !== 'admin') ||
    !verify(data.password, rows[0].password_hash)
  ) {
    throw fail('Login ou senha incorretos.', 401);
  }
  const { password_hash, ...user } = rows[0];
  await session(res, user);
  res.json(user);
});
app.post('/api/auth/register', limitAuth, async (req, res) => {
  const data = registrationSchema
    .extend({ name: z.string().trim().min(2).max(80) })
    .parse(req.body);
  const { rows } = await query(
    'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role',
    [data.name, data.email, hash(data.password)],
  );
  await session(res, rows[0]);
  res.status(201).json(rows[0]);
});
app.post('/api/auth/logout', async (req, res) => {
  await query('DELETE FROM sessions WHERE token=$1', [req.cookies.session || '']);
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});
app.get('/api/auth/me', auth, (req, res) => res.json(req.user));
app.use('/api', auth);
const eventSelect = `SELECT e.*, (SELECT count(*)::int FROM registrations r WHERE r.event_id=e.id AND r.status<>'cancelled') AS registered FROM events e`;
app.get('/api/events', async (req, res) => {
  const { rows } = await query(
    eventSelect +
      (req.user!.role === 'admin' ? '' : ' WHERE e.published=true') +
      ' ORDER BY e.starts_at',
  );
  res.json(rows);
});
app.get('/api/notices', async (_req, res) =>
  res.json((await query('SELECT * FROM notices ORDER BY created_at DESC,id DESC')).rows),
);
app.get('/api/notifications', async (req, res) =>
  res.json(
    (
      await query(
        'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',
        [req.user!.id],
      )
    ).rows,
  ),
);
app.post('/api/notifications/read', async (req, res) => {
  await query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user!.id]);
  res.json({ ok: true });
});
app.get('/api/registrations', async (req, res) => {
  res.json(
    (
      await query(
        `SELECT r.*,e.title,e.starts_at,e.location,e.theme FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=$1 ORDER BY r.created_at DESC`,
        [req.user!.id],
      )
    ).rows,
  );
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
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
app.get('/api/chat', async (req, res) =>
  res.json(
    (
      await query(
        'SELECT * FROM (SELECT * FROM chat_messages WHERE user_id=$1 ORDER BY id DESC LIMIT 60) recent ORDER BY id',
        [req.user!.id],
      )
    ).rows,
  ),
);
app.post('/api/chat', async (req, res) => {
  const { message } = z.object({ message: z.string().trim().min(1).max(1000) }).parse(req.body);
  const input = normalize(message);
  let answer = '';
  let intent = 'fallback';
  if (/atendente|humano|pastor|oracao/.test(input)) {
    intent = 'human';
    answer =
      'Registrei seu pedido para a equipe de acolhimento. Um administrador pode acompanhá-lo no painel. Nesta V1, o retorno acontece por aqui na comunidade, sem envio automático por WhatsApp.';
    await query('INSERT INTO support_requests(user_id,message) VALUES($1,$2)', [
      req.user!.id,
      message,
    ]);
  } else if (/inscri|meus eventos|ingresso/.test(input)) {
    intent = 'registrations';
    const { rows } = await query(
      "SELECT e.title,r.status FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=$1 AND r.status<>'cancelled'",
      [req.user!.id],
    );
    answer = rows.length
      ? 'Suas inscrições:\n' +
        rows
          .map(
            (r) =>
              `• ${r.title} — ${r.status === 'confirmed' ? 'confirmada' : 'pagamento simulado pendente'}`,
          )
          .join('\n')
      : 'Você ainda não tem inscrições ativas. Abra Eventos e escolha um encontro para participar.';
  } else if (/evento|programacao|agenda|retiro|proximo/.test(input)) {
    intent = 'events';
    const { rows } = await query(
      'SELECT title,starts_at,price_cents FROM events WHERE published=true AND starts_at>now() ORDER BY starts_at LIMIT 5',
    );
    answer = rows.length
      ? 'Confira os próximos encontros:\n' +
        rows
          .map(
            (e) =>
              `• ${e.title} — ${new Date(e.starts_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · ${e.price_cents === 0 ? 'gratuito' : (e.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          )
          .join('\n') +
        '\nVocê pode se inscrever pela página Eventos.'
      : 'Ainda não há próximos eventos publicados. Peça ajuda a um atendente.';
  } else if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigad)/.test(input)) {
    intent = 'greeting';
    answer =
      'Olá! Que bom ter você por aqui. Posso ajudar com eventos, horários, localização e suas inscrições. O que você gostaria de saber?';
  } else {
    const { rows } = await query('SELECT * FROM knowledge ORDER BY id');
    const matches = rows
      .map((k) => ({
        k,
        score: k.keywords.split(',').filter((w: string) => input.includes(normalize(w.trim())))
          .length,
      }))
      .sort((a, b) => b.score - a.score);
    if (matches[0]?.score) {
      intent = 'knowledge';
      answer = matches[0].k.answer;
    } else
      answer =
        'Ainda não encontrei essa informação na base da comunidade. Posso consultar eventos, horários e inscrições. Se preferir falar com a equipe, escreva “atendente”.';
  }
  await query(
    "INSERT INTO chat_messages(user_id,role,content,intent) VALUES($1,'user',$2,$4),($1,'assistant',$3,$4)",
    [req.user!.id, message, answer, intent],
  );
  res.json({ answer, intent });
});
app.use('/api/admin', admin);
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
    res.json(result.rows[0]);
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
});
app.get('/api/admin/knowledge', async (_req, res) =>
  res.json((await query('SELECT * FROM knowledge ORDER BY id')).rows),
);
const knowledgeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  keywords: z.string().trim().min(2).max(500),
  answer: z.string().trim().min(5).max(4000),
});
app.post('/api/admin/knowledge', async (req, res) => {
  const k = knowledgeSchema.parse(req.body);
  res
    .status(201)
    .json(
      (
        await query(
          'INSERT INTO knowledge(title,keywords,answer) VALUES($1,$2,$3) RETURNING *',
          Object.values(k),
        )
      ).rows[0],
    );
});
app.put('/api/admin/knowledge/:id', async (req, res) => {
  const k = knowledgeSchema.parse(req.body);
  const result = await query(
    'UPDATE knowledge SET title=$1,keywords=$2,answer=$3,updated_at=now() WHERE id=$4 RETURNING *',
    [...Object.values(k), id(req.params.id)],
  );
  if (!result.rowCount) throw fail('Conteúdo não encontrado.', 404);
  res.json(result.rows[0]);
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
    res.status(201).json({ ok: true });
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
});
app.post('/api/admin/support/:id/close', async (req, res) => {
  const result = await query(
    "UPDATE support_requests SET status='closed' WHERE id=$1 RETURNING *",
    [id(req.params.id)],
  );
  if (!result.rowCount) throw fail('Solicitação não encontrada.', 404);
  res.json({ ok: true });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Confira os campos informados.', details: err.flatten() });
  if (err.code === '23505') return res.status(409).json({ error: 'Este cadastro já existe.' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Não foi possível concluir. Tente novamente.' });
});
