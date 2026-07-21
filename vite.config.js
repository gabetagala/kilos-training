import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    // build stamp for the Athlete page's update row
    'import.meta.env.KILOS_BUILD': JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' '),
    ),
  },
  server: {
    port: 2100,
    open: true,
  },
  plugins: [
    VitePWA({
      // Auto-activates new SW immediately — users always get the latest on next open
      registerType: 'autoUpdate',
      injectRegister: 'script',

      // We manage our own public/manifest.json
      manifest: false,

      workbox: {
        // Precache everything Vite builds (content-hashed JS/CSS + HTML)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,m4a,mp3}'],

        // SPA fallback — all navigation goes to index.html
        // Exclude standalone pages (coach previews etc.) from SW interception
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/coach-/],

        // Nuke old caches when a new SW activates
        cleanupOutdatedCaches: true,

        // Take control of all tabs immediately on activation
        clientsClaim: true,

        // Network-first for HTML so fresh content is always preferred when online
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kilos-html-v1',
              networkTimeoutSeconds: 4,
            },
          },
        ],
      },
    }),
  ],
})
