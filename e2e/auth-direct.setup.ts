/**
 * Alternative auth setup — bypass the UI login + MFA entirely.
 *
 * Reads pre-fetched Cognito tokens from `e2e/.auth/inject-tokens.json`
 * (written by a separate `python` helper that calls cognito-idp directly),
 * and injects them into localStorage at the app origin.
 *
 * Format of inject-tokens.json:
 *   { "idToken": "...", "accessToken": "...", "refreshToken": "..." }
 *
 * This is much more reliable than the UI auth.setup.ts because:
 *  - No fragile email/password selectors
 *  - No TOTP timing race
 *  - Fresh tokens via boto3 cognito-idp on every run
 */
import { test as setup, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

const authFile = path.join(__dirname, ".auth", "user.json")
const injectPath = path.join(__dirname, ".auth", "inject-tokens.json")

setup("inject auth tokens", async ({ page }) => {
    if (!fs.existsSync(injectPath)) {
        setup.skip(true, `${injectPath} missing — run python helper first`)
        return
    }
    const tokens = JSON.parse(fs.readFileSync(injectPath, "utf8"))

    const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"

    // Visit any page on the origin first so we can use localStorage
    await page.goto(`${baseURL}/`)

    // Inject tokens
    await page.evaluate((tokens) => {
        window.localStorage.setItem(
            "authTokens",
            JSON.stringify({
                idToken: tokens.idToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            }),
        )
    }, tokens)

    // Reload so the app picks up the localStorage
    await page.goto(`${baseURL}/jobs`)
    // Expect we land on /jobs (not redirected to /auth/login)
    await expect(page).not.toHaveURL(/\/auth\//, { timeout: 10000 })

    fs.mkdirSync(path.dirname(authFile), { recursive: true })
    await page.context().storageState({ path: authFile })
    console.log(`✔ wrote auth state to ${authFile}`)
})
