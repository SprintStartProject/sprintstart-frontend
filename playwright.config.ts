/**
 * End-to-end journeys (docs/testing/e2e-journeys.md) against the stack from
 * `bash e2e/stack.sh up`: real Keycloak, backend and database, with the AI replaced by e2e/ai-stub.
 * The production build is served by `vite preview` on the port Keycloak's client allows.
 */
import { defineConfig, devices } from "@playwright/test";
import { APP_URL } from "./e2e/stack.ts";

export default defineConfig({
  testDir: "./e2e/journeys",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx vite preview --port 5173 --strictPort",
    url: APP_URL,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
