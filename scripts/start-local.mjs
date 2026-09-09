import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
const url = 'http://127.0.0.1:3001';
async function healthy() {
  try {
    const r = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1200) });
    const data = await r.json();
    return data.status === 'ok' && data.version === '1.0.0' && data.database === 'PostgreSQL';
  } catch {
    return false;
  }
}
if (await healthy()) {
  console.log(`ComunIA já está disponível em ${url}`);
  process.exit(0);
}
const db = spawnSync(process.execPath, ['scripts/database.mjs', 'start'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});
if (db.status !== 0) process.exit(1);
if (!existsSync('dist/index.html')) {
  console.error('Execute npm.cmd run build antes de iniciar a V1.');
  process.exit(1);
}
mkdirSync('.local', { recursive: true });
const log = openSync('.local/app.log', 'a');
const child = spawn(process.execPath, ['--import', 'tsx', path.join(root, 'server/index.ts')], {
  cwd: root,
  stdio: ['ignore', log, log],
  windowsHide: true,
  detached: true,
});
writeFileSync(
  '.local/server.json',
  JSON.stringify({ pid: child.pid, root, startedAt: new Date().toISOString() }),
);
child.unref();
closeSync(log);
for (let attempt = 0; attempt < 25; attempt++) {
  if (await healthy()) {
    console.log(`ComunIA disponível em ${url}`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
}
console.error('Não foi possível iniciar. Consulte .local/app.log.');
process.exit(1);
