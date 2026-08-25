// Throwaway, not for commit. The committed config's only project is WebKit
// (iPhone 13), which is not installed in this sandbox — so every spec errors on
// browser launch and the suite proves nothing. Same specs, same mobile
// viewport, chromium engine: this exercises the app's behaviour and my new
// specs. It does NOT substitute for CI, which runs the real WebKit target that
// matches the iPhones this app is actually for.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "/data/repos/around-the-world/frontend/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173/birthday/",
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command: "npm run dev -- --port 4173 --strictPort",
    url: "http://localhost:4173/birthday/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
