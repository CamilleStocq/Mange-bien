/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest,woff2,webp}'] },
      devOptions: { enabled: false },
      manifest: {
        name: 'Mange bien ! — repas, sport & progression',
        short_name: 'Mange bien !',
        description: 'Mon application personnelle : repas, batch cooking, courses, sport et progression.',
        lang: 'fr-BE',
        start_url: './#/aujourdhui',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6EFE2',
        theme_color: '#F6EFE2',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' }
});
