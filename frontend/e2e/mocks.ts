import type { Page } from '@playwright/test';

/**
 * Deterministic API mocks for the e2e suite.
 *
 * Every backend call the frontend makes is fulfilled here with a fixed fixture,
 * so the tests never touch a real server and render identically every run.
 * Add a new route here whenever the frontend starts calling a new endpoint.
 */
export async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/status', (route) =>
    route.fulfill({ json: { status: 'Healthy', service: 'AroundTheWorld.WebApi' } }),
  );
  // Interest / newsletter forms — accept any submission so the UI shows success.
  await page.route('**/api/interest/**', (route) =>
    route.fulfill({ status: 200, json: { ok: true } }),
  );
}
