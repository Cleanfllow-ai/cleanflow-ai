import { test, expect } from "@playwright/test"

/**
 * Auth-free smoke tests. These run without Cognito creds and verify:
 *   - the dev server is up
 *   - core routes render without crashing the React tree
 *   - critical chunks load (no missing-export errors)
 *
 * If THESE fail there's no point running the full suite — fix the build first.
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe("smoke @no-auth", () => {
    test("login page renders", async ({ page }) => {
        const errors: string[] = []
        page.on("pageerror", (e) => errors.push(e.message))

        await page.goto("/auth/login", { waitUntil: "domcontentloaded" })

        expect(errors, `Page errors: ${errors.join("\n")}`).toHaveLength(0)
        // At minimum a sign-in CTA should be visible.
        await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible()
    })

    test("home redirects unauthenticated users to login", async ({ page }) => {
        await page.goto("/")
        // Should land on /auth/login (or similar). Just verify we left "/".
        await expect(page).not.toHaveURL("/")
    })
})
