import 'dotenv/config';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 5000,
});
if (process.env.VERCEL === '1') attachDatabasePool(pool);
export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  transactionOptions: { maxWait: 10000, timeout: 15000 },
});
export const disconnectDatabase = async () => {
  await prisma.$disconnect();
  await pool.end();
};
// Raw SQL remains available for row locks and the shared atomic rate limiter.
export const query = (sql: string, values: unknown[] = []) => pool.query(sql, values);
