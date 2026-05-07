import { test as setup, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

const authFile = path.join(__dirname, ".auth/user.json")

/**
 * One-time Cognito login that captures cookies + localStorage so the rest of
 * the suite can hit authenticated routes without re-logging-in.
 *
 * Required env vars:
 *   PLAYWRIGHT_TEST_EMAIL    — Cognito test user email
 *   PLAYWRIGHT_TEST_PASSWORD — Cognito test user password
 *
 * If the credentials are missing, the suite will SKIP rather than fail —
 * Kiran can run the framework without creds and only the auth-gated tests
 * will be skipped. Browser-shape sanity tests (smoke.spec.ts) still run.
 */
setup("authenticate", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_TEST_EMAIL
    const password = process.env.PLAYWRIGHT_TEST_PASSWORD

    if (!email || !password) {
        // Write an empty storage state so dependent projects don't fail to start.
        fs.mkdirSync(path.dirname(authFile), { recursive: true })
        fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }))
        setup.skip(true, "PLAYWRIGHT_TEST_EMAIL / PASSWORD not set — skipping auth setup")
        return
    }

    await page.goto("/auth/login")

    // Cognito-hosted form: adjust selectors to match the actual login page.
    // The CleanFlowAI auth flow is rendered via modules/auth/components/.
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole("button", { name: /sign in|log in/i }).click()

    // Wait for redirect to authenticated landing page (jobs list or dashboard).
    await expect(page).toHaveURL(/\/(jobs|dashboard|files|home)/, { timeout: 15000 })

    fs.mkdirSync(path.dirname(authFile), { recursive: true })
    await page.context().storageState({ path: authFile })
})
