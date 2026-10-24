import { defineConfig } from "@playwright/test";
import fs from "node:fs";

// The tests talk to the same Supabase project as the app (for test-only setup), so read the same settings.
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

// End-to-end tests run against a local app on port 3200 and tagged test data made by e2e/seed.ts.
// They use the installed Chrome, so no browser download is needed. Emails are printed to the server log (no Resend key locally).
export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1, // one shared database: run one test at a time, in file order
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  webServer: {
    command: "npx next dev -p 3200",
    url: "http://localhost:3200",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { NEXT_PUBLIC_APP_URL: "http://localhost:3200", RESEND_API_KEY: "" },
  },
  use: {
    baseURL: "http://localhost:3200",
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    trace: "off",
  },
});
