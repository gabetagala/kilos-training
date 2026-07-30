import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const page = (p) => fileURLToPath(new URL(p, import.meta.url))

const commit =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  (() => {
    try {
      return execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      return 'local'
    }
  })()

export default defineConfig({
  define: {
    // build stamp + commit for the Athlete page's version row
    'import.meta.env.KILOS_BUILD': JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' '),
    ),
    'import.meta.env.KILOS_COMMIT': JSON.stringify(commit),
  },
  server: {
    port: 2100,
    open: true,
  },
  build: {
    rollupOptions: {
      // Multi-page: Kilos SPA + the Bantay baby-monitor sub-app (bantay/SCOPE.md §2)
      input: {
        main: page('index.html'),
        'bantay-home': page('bantay/index.html'),
        'bantay-cam': page('bantay/cam.html'),
        'bantay-view': page('bantay/view.html'),
      },
    },
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
        // Exclude standalone pages (coach previews, Bantay) from SW interception
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/coach-/, /^\/bantay/],

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
