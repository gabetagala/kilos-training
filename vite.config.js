import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const page = (p) => fileURLToPath(new URL(p, import.meta.url))

// Sub-apps live at their own URLs. Without a trailing slash Vite's SPA
// fallback serves the Kilos shell instead — silently, with a 200 — so the
// dev server sends the bare path to the slashed one. Prod does this in
// vercel.json rewrites.
const SUB_APPS = ['tomato-plate', 'tomatito', 'hotmum', 'tomato', 'tayo', 'coach-cilyn']
const subAppTrailingSlash = () => ({
  name: 'subapp-trailing-slash',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url || '').split('?')[0]
      if (SUB_APPS.some((a) => path === `/${a}`)) {
        res.statusCode = 301
        res.setHeader('Location', `${path}/`)
        return res.end()
      }
      next()
    })
  },
})

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
    // build stamp + commit — full ISO so the client renders "Updated
    // August 12, 2026 · 8:09 AM" in HIS timezone (home footer + Athlete row)
    'import.meta.env.KILOS_BUILD': JSON.stringify(new Date().toISOString()),
    'import.meta.env.KILOS_COMMIT': JSON.stringify(commit),
  },
  server: {
    port: 2100,
    open: true,
  },
  build: {
    rollupOptions: {
      // Multi-page: Kilos SPA + the Tomato Cam baby-monitor sub-app (tomato/SCOPE.md §2)
      // + Tayô, the desk-break coach + Tomato Plate, the feeding app
      // (all own URLs, deliberately unlinked from home)
      input: {
        main: page('index.html'),
        'tomato-home': page('tomato/index.html'),
        'tomato-cam': page('tomato/cam.html'),
        'tomato-view': page('tomato/view.html'),
        tayo: page('tayo/index.html'),
        // HOTMUM — Sam's app. Own page, own icon, own localStorage namespace;
        // shares only the step engine and the fonts (hotmum/PLAN.md §4).
        hotmum: page('hotmum/index.html'),
        'tomato-plate': page('tomato-plate/index.html'),
        tomatito: page('tomatito/index.html'),
      },
    },
  },
  plugins: [
    subAppTrailingSlash(),
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
        navigateFallbackDenylist: [
          /^\/coach-/,
          /^\/bantay/,
          /^\/tomato/,
          /^\/tomatito/,
          /^\/tayo/,
          /^\/hotmum/,
        ],

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
