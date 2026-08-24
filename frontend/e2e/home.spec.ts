import { test, expect } from '@playwright/test';
import { mockApi } from './mocks';

/**
 * Smoke + screenshot coverage for the scaffold's home page, driven off mocked
 * API responses. Each test asserts the key content is present, then captures a
 * full-page screenshot into e2e/screenshots/ for visual review.
 *
 * This is the reusable e2e/screenshot pattern for Northstar frontends: mock
 * every API call in one place (mocks.ts), assert, then screenshot.
 */

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('home page renders hero and the mocked API status', async ({ page }) => {
  await page.goto('./');

  await expect(
    page.getByRole('heading', { name: 'Your App Name', level: 1 }),
  ).toBeVisible();

  // Proves the mocked GET /api/status rendered into the status panel.
  await expect(page.getByText('Healthy', { exact: false })).toBeVisible();

  await page.screenshot({
    path: 'e2e/screenshots/home-light.png',
    fullPage: true,
    // Fast-forward the theme transition so renders are deterministic instead
    // of catching a half-faded frame right after the toggle click.
    animations: 'disabled',
  });
});

test('home page renders in dark mode', async ({ page }) => {
  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Your App Name', level: 1 }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Toggle Theme' }).click();

  await page.screenshot({
    path: 'e2e/screenshots/home-dark.png',
    fullPage: true,
    // Fast-forward the theme transition so renders are deterministic instead
    // of catching a half-faded frame right after the toggle click.
    animations: 'disabled',
  });
});
