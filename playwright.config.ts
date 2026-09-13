import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 120_000,
  use: { baseURL: `http://localhost:${port}/` },
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
