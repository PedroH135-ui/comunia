import { createHash } from 'node:crypto';
import { query } from './db.js';

// One atomic counter shared by all function instances, with a fixed expiry window.
export async function consumeAttempt(scope: string, identity: string, limit: number) {
  const key = createHash('sha256').update(`${scope}:${identity}`).digest('hex');
  const { rows } = await query(
    `INSERT INTO auth_attempts(key,count,expires_at) VALUES($1,1,now()+interval '10 minutes')
     ON CONFLICT(key) DO UPDATE SET
       count=CASE WHEN auth_attempts.expires_at<=now() THEN 1 ELSE auth_attempts.count+1 END,
       expires_at=CASE WHEN auth_attempts.expires_at<=now() THEN now()+interval '10 minutes' ELSE auth_attempts.expires_at END
     RETURNING count, GREATEST(1,ceil(extract(epoch FROM expires_at-now())))::int AS retry_after`,
    [key],
  );
  return { allowed: rows[0].count <= limit, retryAfter: rows[0].retry_after as number };
}
