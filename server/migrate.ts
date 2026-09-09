import { disconnectDatabase, prisma } from './db.js';

try {
  await prisma.auth_attempts.deleteMany({ where: { expires_at: { lt: new Date() } } });
  await prisma.sessions.deleteMany({ where: { expires_at: { lt: new Date() } } });
  console.log('Sessões e limites expirados removidos. O esquema é gerenciado por Prisma Migrate.');
} finally {
  await disconnectDatabase();
}
