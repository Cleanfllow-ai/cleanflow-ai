import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright config for CleanFlowAI multi-cardinality jobs feature.
 *
 * Run modes:
 *   npx playwright test                  — full suite
 *   npx playwright test --headed         — visible browser (debugging)
 *   npx playwright test --ui             — interactive runner
 *   npx playwright test e2e/jobs/wizard  — one folder
 *   npx playwright show-trace <zip>      — open a saved trace
 *
 * Required env vars (set in .env.local or shell before running):
 *   PLAYWRIGHT_BASE_URL    — e.g. http://localhost:3000 or https://dev.cleanflowai.com
 *   PLAYWRIGHT_TEST_EMAIL  — Cognito test user email
 *   PLAYWRIGHT_TEST_PASSWORD — Cognito test user password
 *
 * Auth state is captured once by e2e/auth.setup.ts and reused across tests
 * to avoid re-login on every spec.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,            // jobs feature is stateful; serialize for now
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,                      // serial — same dev backend across tests
    reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
        trace: "on-first-retry",     // full trace on failure for replay
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    projects: [
        // 1. Auth setup — runs once, saves cookies/storage state
        // Prefer auth-direct.setup.ts (token injection from python helper) when
        // inject-tokens.json is present; falls back to auth.setup.ts (UI login).
        {
            name: "setup",
            testMatch: /.*auth-direct\.setup\.ts/,
        },
        // 2. Authenticated tests — reuse the saved state
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: "e2e/.auth/user.json",
            },
            dependencies: ["setup"],
        },
    ],
})
