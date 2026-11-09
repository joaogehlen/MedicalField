import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Em desenvolvimento, /api vai para o gateway (Nginx local em :8080).
const gateway = process.env.MF_GATEWAY ?? 'http://127.0.0.1:8080';

export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'MedicalField Campo',
        short_name: 'MedicalField',
        description: 'Ficha de atendimento pré-hospitalar offline-first',
        lang: 'pt-BR',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#f4f6f7',
        theme_color: '#10283d',
        icons: [{ src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        navigateFallback: '/app/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  server: { port: 5173, proxy: { '/api': gateway } },
});
