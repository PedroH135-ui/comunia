import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { hash } from '../server/security.js';

// One-time copy into an empty Neon database. Never alters the local source.
const local = dotenv.parse(readFileSync('.env'));
const remote = dotenv.parse(readFileSync('.local/cloud.env'));
const destination = remote.DATABASE_URL_UNPOOLED || remote.DATABASE_URL;
if (!destination) throw new Error('Conexão de nuvem ausente.');
const targetUrl = new URL(destination);
if (!targetUrl.hostname.endsWith('.neon.tech') || !targetUrl.searchParams.has('sslmode'))
  throw new Error('Destino deve ser Neon com TLS.');
if (!['localhost', '127.0.0.1'].includes(new URL(local.DATABASE_URL).hostname))
  throw new Error('Origem deve ser o PostgreSQL local.');
const source = new pg.Client({ connectionString: local.DATABASE_URL });
const target = new pg.Client({ connectionString: destination });
const tables = [
  'users',
  'events',
  'registrations',
  'payments',
  'notices',
  'notifications',
  'knowledge',
  'chat_messages',
  'support_requests',
];
const snapshot: Record<string, Record<string, unknown>[]> = {};
const credentials: { email: string; password: string; role: string }[] = [];
const quote = (identifier: string) => {
  if (!/^[a-z_]+$/.test(identifier)) throw new Error('Identificador inesperado.');
  return `"${identifier}"`;
};
try {
  await source.connect();
  await target.connect();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  for (const table of tables)
    snapshot[table] = (await source.query(`SELECT * FROM ${quote(table)} ORDER BY id`)).rows;
  await source.query('COMMIT');
  writeFileSync('.local/migration-backup.json', JSON.stringify(snapshot));
  await target.query('BEGIN');
  // Refuse overwriting or merging an existing application installation.
  for (const table of tables) {
    if ((await target.query('SELECT to_regclass($1) AS name', [`public.${table}`])).rows[0].name)
      throw new Error('O banco de destino já contém tabelas do aplicativo. Migração cancelada.');
  }
  await target.query(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  for (const user of snapshot.users) {
    if (['admin@comunia.local', 'membro@comunia.local'].includes(String(user.email))) {
      const password = randomBytes(24).toString('base64url');
      user.password_hash = hash(password);
      credentials.push({ email: String(user.email), password, role: String(user.role) });
    }
  }
  for (const table of tables) {
    for (const row of snapshot[table]) {
      const columns = Object.keys(row);
      await target.query(
        `INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`,
        Object.values(row),
      );
    }
    await target.query(
      `SELECT setval(pg_get_serial_sequence($1,'id'), COALESCE((SELECT max(id) FROM ${quote(table)}),1), EXISTS(SELECT 1 FROM ${quote(table)}))`,
      [table],
    );
  }
  writeFileSync(
    '.local/ACESSOS-ONLINE.md',
    '# Acessos privados do ComunIA online\n\nNão publique ou compartilhe este arquivo. As contas locais mantêm as senhas anteriores.\n\n' +
      credentials.map((c) => `- ${c.role}: ${c.email}\n  Senha: ${c.password}\n`).join('\n'),
  );
  await target.query('COMMIT');
  const counts = Object.fromEntries(tables.map((t) => [t, snapshot[t].length]));
  writeFileSync(
    '.local/cloud-migration.json',
    JSON.stringify(
      { completedAt: new Date().toISOString(), host: targetUrl.hostname, counts },
      null,
      2,
    ),
  );
  console.log('Migração concluída. Sessões e contadores de login não foram copiados.');
  console.log(JSON.stringify(counts));
  console.log('Novos acessos salvos em .local/ACESSOS-ONLINE.md (arquivo privado).');
} catch (error) {
  await target.query('ROLLBACK').catch(() => {});
  throw new Error(error instanceof Error ? error.message : 'Falha na migração.');
} finally {
  await source.end();
  await target.end();
}
