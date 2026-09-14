import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 120_000,
  // CI runners are slow enough that saving to IndexedDB can outlast the default five seconds.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  // A test that fails on CI runs once more with a trace, so timing failures can be diagnosed from
  // the uploaded report instead of blocking a deploy. Retried passes are still reported as flaky.
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${port}/`, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  // End-to-end tests run against the built site on a plain static server.
  webServer: {
    command: `node tools/static-server.ts --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
