import { defineConfig } from 'vitest/config';

// Vitest runs pure-logic unit tests only. Playwright owns tests/e2e/*.spec.js
// (it imports @playwright/test, which must not run under Vitest).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
