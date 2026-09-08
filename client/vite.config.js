import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

export default defineConfig({
  // One source of truth for the version: package.json.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      /* `prompt` rather than `autoUpdate`: the app still updates itself without
         being asked, but on its own terms. autoUpdate reloads the moment a new
         worker activates, which can land in the middle of a half-typed entry.
         See lib/update.js — it waits for a moment when nothing is open. */
      registerType: 'prompt',
      // Registered from lib/update.js instead, so the polling and the reload
      // are in one place rather than split with an injected script.
      injectRegister: null,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'My Hisab',
        short_name: 'My Hisab',
        version,
        description: 'Daily transactions, borrowed & lent, savings and balance in one place.',
        theme_color: '#1a1a19',
        background_color: '#1a1a19',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Add expense', url: '/?add=expense' },
          { name: 'Add income', url: '/?add=income' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Last good API response is kept so the app still opens with data offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hisab-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
});
