import 'dotenv/config';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 5000,
});
if (process.env.VERCEL === '1') attachDatabasePool(pool);
export const query = (sql: string, values: unknown[] = []) => pool.query(sql, values);
