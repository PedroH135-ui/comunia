import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_CLOUD': JSON.stringify(process.env.VERCEL === '1' ? '1' : '0') },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: { outDir: 'dist' },
});
