import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const gateway = process.env.MF_GATEWAY ?? 'http://127.0.0.1:8080';

export default defineConfig({
  base: '/portal/',
  plugins: [react()],
  server: { port: 5174, proxy: { '/api': gateway } },
});
