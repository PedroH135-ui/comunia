import path from 'node:path';
import express from 'express';
import { existsSync } from 'node:fs';
import { app } from './app.js';
import { pool } from './db.js';
if (existsSync('dist/index.html')) {
  app.use(express.static('dist'));
  app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
}
const server = app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () =>
  console.log('ComunIA API: http://127.0.0.1:3001'),
);
process.on('SIGTERM', () =>
  server.close(() => {
    void pool.end();
  }),
);
