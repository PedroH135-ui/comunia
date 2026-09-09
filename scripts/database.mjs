import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const bin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/16/bin';
const data = process.env.PG_DATA_DIR || 'E:/ComunIA/postgres-data';
const run = (name, args, allow = false) => {
  const p = spawnSync(path.join(bin, name + '.exe'), args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: args.includes('start') ? 'ignore' : 'pipe',
    timeout: 60000,
  });
  if (!allow && p.status !== 0) throw new Error(p.stderr || p.stdout || String(p.error));
  return p;
};
if (process.argv[2] === 'stop') {
  if (existsSync(data)) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], true);
  process.exit(0);
}
if (!existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  writeFileSync(
    '.env',
    `DATABASE_URL=postgresql://comunia:${password}@127.0.0.1:55432/comunia\nPORT=3001\nPG_DATA_DIR=${data}\nPG_BIN=${bin}\n`,
  );
  dotenv.config({ override: true, quiet: true });
}
mkdirSync(path.dirname(data), { recursive: true });
if (!existsSync(path.join(data, 'PG_VERSION'))) {
  const secret = path.join(path.dirname(data), 'init-password.tmp');
  writeFileSync(secret, decodeURIComponent(new URL(process.env.DATABASE_URL).password));
  try {
    run('initdb', [
      '-D',
      data,
      '-U',
      'comunia',
      '--auth=scram-sha-256',
      '--encoding=UTF8',
      '--locale=C',
      `--pwfile=${secret}`,
    ]);
  } finally {
    unlinkSync(secret);
  }
  const config = path.join(data, 'postgresql.conf');
  writeFileSync(
    config,
    readFileSync(config, 'utf8') +
      "\nlisten_addresses = '127.0.0.1'\nport = 55432\ntimezone = 'America/Sao_Paulo'\n",
  );
}
if (run('pg_ctl', ['-D', data, 'status'], true).status !== 0)
  run('pg_ctl', ['-D', data, '-l', path.join(path.dirname(data), 'postgres.log'), '-w', 'start']);
const { Client } = await import('pg');
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/postgres';
const client = new Client({ connectionString: url.toString() });
await client.connect();
if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='comunia'")).rowCount)
  await client.query('CREATE DATABASE comunia');
await client.end();
console.log('PostgreSQL ComunIA disponível em 127.0.0.1:55432.');
