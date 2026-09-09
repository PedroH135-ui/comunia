import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
if (!existsSync('.local/server.json')) {
  console.log('Nenhum servidor iniciado pelo atalho foi encontrado.');
  process.exit(0);
}
const { pid, root: registeredRoot } = JSON.parse(readFileSync('.local/server.json', 'utf8'));
if (registeredRoot !== root || !Number.isInteger(pid))
  throw new Error('Registro de processo inválido.');
// Check the PID still belongs to this exact application before stopping it.
const check = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object -ExpandProperty CommandLine`,
  ],
  { encoding: 'utf8', windowsHide: true },
);
if (check.stdout.includes(path.join(root, 'server/index.ts'))) {
  process.kill(pid);
  console.log('Servidor ComunIA encerrado.');
} else console.log('O processo registrado já foi encerrado.');
unlinkSync('.local/server.json');
