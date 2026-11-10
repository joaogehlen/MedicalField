import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, /api vai para o gateway Nginx local (:8080).
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': process.env.MF_GATEWAY ?? 'http://127.0.0.1:8080' } },
});
