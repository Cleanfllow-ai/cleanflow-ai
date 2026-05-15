import { test as setup, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"
import { execFileSync } from "node:child_process"

const authFile = path.join(__dirname, ".auth/user.json")
const credsPath = path.join(__dirname, ".auth/creds.json")
const totpSecretPath = path.join(__dirname, ".auth/totp_secret.txt")

/**
 * Authenticate the bootstrapped Playwright test user.
 *
 * Pre-requisite: run `conda run -n mcc-project python e2e/bootstrap_test_user.py`
 * once to provision the user, enroll TOTP (we own the secret), and add them to
 * the test org. The bootstrap writes:
 *   e2e/.auth/creds.json       — email, password, sub, org, etc.
 *   e2e/.auth/totp_secret.txt  — base32 TOTP secret
 *
 * This setup logs in via the UI, generates a fresh TOTP code from the secret
 * to satisfy the SOFTWARE_TOKEN_MFA challenge, then captures the authenticated
 * session state for the rest of the suite to reuse.
 */
setup("authenticate", async ({ page }) => {
    if (!fs.existsSync(credsPath) || !fs.existsSync(totpSecretPath)) {
        fs.mkdirSync(path.dirname(authFile), { recursive: true })
        fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }))
        setup.skip(true, "creds.json / totp_secret.txt missing — run bootstrap_test_user.py first")
        return
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"))
    const email: string = creds.email
    const password: string = creds.password

    await page.goto("/auth/login")
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole("button", { name: /^sign in$/i }).click()

    // MFA dialog appears — generate a fresh TOTP code via Python (pyotp).
    // Python is the easiest cross-platform path since the conda env already has it.
    const mfaDialog = page.getByRole("dialog", { name: /two-factor|2fa|authentication code/i })
    await mfaDialog.waitFor({ state: "visible", timeout: 10000 })

    const code = execFileSync(
        "conda",
        ["run", "-n", "mcc-project", "python", "-c",
         `import pyotp,sys; print(pyotp.TOTP(open(r'${totpSecretPath}').read().strip()).now())`],
        { encoding: "utf8" }
    ).trim()

    // The code field accepts 6 digits; the dialog has a single textbox for the code.
    await mfaDialog.getByRole("textbox").fill(code)
    await mfaDialog.getByRole("button", { name: /verify code|verify/i }).click()

    // After successful MFA, we should redirect to an authenticated route.
    await expect(page).toHaveURL(/\/(jobs|dashboard|files|home|$)/, { timeout: 20000 })
    await expect(page).not.toHaveURL(/\/auth\//, { timeout: 5000 })

    fs.mkdirSync(path.dirname(authFile), { recursive: true })
    await page.context().storageState({ path: authFile })
})
