import 'dotenv/config';

export const cloud = process.env.VERCEL === '1';
export const secureCookies = cloud || process.env.NODE_ENV === 'production';

export function allowedOrigins() {
  const configured = (process.env.APP_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const deployments = cloud
    ? [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
        .filter(Boolean)
        .map((host) => `https://${host}`)
    : [];
  const local = cloud
    ? []
    : [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:3001',
        'http://localhost:3001',
      ];
  return new Set([...configured, ...deployments, ...local]);
}
