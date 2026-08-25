import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e config for the frontend.
 *
 * These tests drive the app off mocked API responses (see e2e/mocks.ts), so
 * they need no backend and render deterministically. Each spec also captures
 * full-page screenshots into e2e/screenshots/ for visual review.
 *
 * Run:  npm run test:e2e            (headless, starts the dev server for you)
 *       npm run test:e2e -- --ui    (interactive)
 *
 * e2e/screenshots/ is GITIGNORED and asserts nothing — page.screenshot() is a
 * plain write, not a comparison, so these files can never fail a build.
 *
 * ⚠️ This comment used to claim the CI job uploads e2e/screenshots/ as a
 * per-PR artifact. It does not — ci.yml uploads playwright-report/ and only
 * `if: failure()`. e2e/README.md has the step to add if you want them.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    // Must carry Vite's `base` (see vite.config.ts). Vite's dev server
    // redirects bare '/' to the base, so the home page happens to work without
    // it — but any deeper route ('/editor') lands on Vite's "server is
    // configured with a public base URL" hint page instead of the app.
    // Specs therefore navigate with RELATIVE paths ('./', './thing'); a
    // leading slash discards the base again.
    // Rename this alongside `base` when you scaffold a new app.
    baseURL: 'http://localhost:4173/birthday/',
    trace: 'on-first-retry',
  },
  // This app is mobile-only, so the e2e suite drives a phone viewport. Running
  // it on Desktop Chrome would exercise a layout no user will ever see.
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173/birthday/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
