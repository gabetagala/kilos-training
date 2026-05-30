import { defineConfig, devices } from '@playwright/test';

// Kilos is iPhone-Safari-first (one-handed, mid-set, 375px). We test the
// money path on the real WebKit engine at a phone viewport, against the
// PRODUCTION build served by `vite preview` (so the PWA/service worker and
// the same bundle the user gets are exercised — not the dev server).

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iphone-safari',
      use: { ...devices['iPhone 13'] }, // WebKit + 390x844; closest to the gym phone
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
