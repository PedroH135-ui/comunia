import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { pool, query } from './db.js';

try {
  await query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  await query('DELETE FROM auth_attempts WHERE expires_at < now()');
  await query('DELETE FROM sessions WHERE expires_at < now()');
  console.log('Esquema atualizado sem apagar cadastros.');
} finally {
  await pool.end();
}
