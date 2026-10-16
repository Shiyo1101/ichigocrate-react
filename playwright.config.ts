import { defineConfig, devices } from "@playwright/test";

const PORT = 5174;
const FIXTURE_URL = `http://localhost:${PORT}/e2e/fixture/index.html`;

// E2E はライブラリの src を直接読むフィクスチャページ (e2e/fixture) に対して走らせる。
// dev playground (index.html) とは分け、テストから操作しやすい window.fixture を公開する。
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: FIXTURE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: FIXTURE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
