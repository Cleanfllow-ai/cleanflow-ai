import { test, expect, type Page } from "@playwright/test"

/**
 * Multi-cardinality job wizard scenarios from the implementation plan.
 *
 * Pre-reqs (one-time setup on the test org):
 *   1. Connect ZohoBooks, QuickBooks Online, and Snowflake via
 *      Settings → Connectors. The wizard's provider dropdown reads from
 *      these connections.
 *   2. PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD set.
 *
 * Skip behaviour: if connectors aren't connected, individual scenarios are
 * skipped rather than failing — Kiran's first runs may not have all three.
 */

const SCENARIOS = {
    SNOWFLAKE_DB: process.env.PLAYWRIGHT_SNOWFLAKE_DB || "ANALYTICS_DB",
    SNOWFLAKE_SCHEMA: process.env.PLAYWRIGHT_SNOWFLAKE_SCHEMA || "PUBLIC",
    SNOWFLAKE_TABLE: process.env.PLAYWRIGHT_SNOWFLAKE_TABLE || "customers",
}

async function gotoNewJob(page: Page) {
    await page.goto("/jobs")
    // Open the new wizard. Button label may evolve — match a few variants.
    const newJobBtn = page.getByRole("button", { name: /new job|create job|\+ job/i }).first()
    await newJobBtn.click()
    // Wizard mounts to the Endpoints step (first in our 4-step structure).
    await expect(page.getByText(/source.*destination/i)).toBeVisible({ timeout: 10000 })
}

async function pickEndpoint(
    page: Page,
    side: "source" | "destination",
    provider: string,
    entity: string,
) {
    const panel = page.locator(`[data-testid="endpoint-panel-${side}"]`).first()
    await panel.getByRole("button", { name: /provider|select source|select destination/i }).click()
    await page.getByRole("option", { name: new RegExp(provider, "i") }).click()
    // ERP entity dropdown vs warehouse hierarchy is category-aware.
    await panel.getByRole("button", { name: /entity|table/i }).click()
    await page.getByRole("option", { name: new RegExp(entity, "i") }).click()
}

test.describe("wizard cardinality flows", () => {
    test.beforeEach(async ({ page }) => {
        await gotoNewJob(page)
    })

    test("1:1 ERP→ERP — QB Customers → Zoho Customers, auto-map, save", async ({ page }) => {
        await pickEndpoint(page, "source", "QuickBooks", "customers")
        await pickEndpoint(page, "destination", "Zoho", "customers")

        // Cardinality banner shows 1:1
        await expect(page.getByText(/1:1/)).toBeVisible()

        await page.getByRole("button", { name: /next|continue/i }).click() // → Config
        await page.getByLabel(/job name/i).fill("E2E QB→Zoho 1:1")
        await page.getByRole("button", { name: /next|continue/i }).click() // → Mapping

        // Auto-map should be enabled for 1:1
        const autoMap = page.getByRole("button", { name: /auto-map/i })
        await expect(autoMap).toBeEnabled()
        await autoMap.click()

        // Some columns mapped — confidence badges should appear
        await expect(page.locator('[data-testid^="confidence-badge-"]').first()).toBeVisible({ timeout: 30000 })

        await page.getByRole("button", { name: /next|continue/i }).click() // → DQ
        await page.getByRole("button", { name: /create job|save/i }).click()

        await expect(page.getByText(/E2E QB→Zoho 1:1/)).toBeVisible({ timeout: 10000 })
    })

    test("1:N ERP→ERP+Warehouse — auto-map disabled, per-pair manual", async ({ page }) => {
        await pickEndpoint(page, "source", "QuickBooks", "customers")
        await pickEndpoint(page, "destination", "Zoho", "customers")

        // Add second destination — Snowflake table
        await page.getByRole("button", { name: /\+ add destination/i }).click()
        await pickEndpoint(page, "destination", "Snowflake", SCENARIOS.SNOWFLAKE_TABLE)

        await expect(page.getByText(/1:N/)).toBeVisible()

        // M:N must be blocked — verify no "+ add source" while destinations > 1
        await expect(page.getByRole("button", { name: /\+ add source/i })).toBeHidden()

        await page.getByRole("button", { name: /next|continue/i }).click() // → Config
        await page.getByLabel(/job name/i).fill("E2E QB→Zoho+Snowflake 1:N")
        await page.getByRole("button", { name: /next|continue/i }).click() // → Mapping

        // Two accordion panels (one per dest)
        const panels = page.locator('[data-testid^="mapping-panel-"]')
        await expect(panels).toHaveCount(2)

        // Auto-map disabled (1:N case)
        await expect(page.getByRole("button", { name: /auto-map/i }).first()).toBeDisabled()
    })

    test("N:1 (union) — multiple sources, single dest, parallel 1:1 pairing", async ({ page }) => {
        await pickEndpoint(page, "source", "QuickBooks", "customers")
        // Add second source
        await page.getByRole("button", { name: /\+ add source/i }).click()
        await pickEndpoint(page, "source", "Zoho", "customers")
        await pickEndpoint(page, "destination", "Snowflake", SCENARIOS.SNOWFLAKE_TABLE)

        await expect(page.getByText(/N:1/)).toBeVisible()
        await expect(page.getByRole("button", { name: /\+ add destination/i })).toBeHidden()
    })

    test("M:N is blocked at the UI", async ({ page }) => {
        await pickEndpoint(page, "source", "QuickBooks", "customers")
        await pickEndpoint(page, "destination", "Zoho", "customers")

        // Two destinations
        await page.getByRole("button", { name: /\+ add destination/i }).click()
        await pickEndpoint(page, "destination", "Snowflake", SCENARIOS.SNOWFLAKE_TABLE)

        // Now the source-add button should be hidden
        await expect(page.getByRole("button", { name: /\+ add source/i })).toBeHidden()
    })

    test("Save mapping as template, reuse from Settings", async ({ page }) => {
        await pickEndpoint(page, "source", "QuickBooks", "customers")
        await pickEndpoint(page, "destination", "Zoho", "customers")
        await page.getByRole("button", { name: /next|continue/i }).click() // → Config
        await page.getByLabel(/job name/i).fill("E2E template-source job")
        await page.getByRole("button", { name: /next|continue/i }).click() // → Mapping

        await page.getByRole("button", { name: /auto-map/i }).click()
        await expect(page.locator('[data-testid^="confidence-badge-"]').first()).toBeVisible({ timeout: 30000 })

        const tplName = `E2E QB→Zoho ${Date.now()}`
        await page.getByRole("button", { name: /save as template/i }).click()
        await page.getByLabel(/template name/i).fill(tplName)
        await page.getByRole("button", { name: /^create template$|^save template$/i }).click()

        // Verify it lands in Settings
        await page.goto("/settings")
        await page.getByRole("tab", { name: /mapping templates/i }).click()
        await expect(page.getByText(tplName)).toBeVisible({ timeout: 10000 })
    })
})

test.describe("jobs list batch actions (#8)", () => {
    test("select multiple jobs and trigger batch run", async ({ page }) => {
        await page.goto("/jobs")
        await expect(page.locator("table, [role=table]")).toBeVisible()

        const checkboxes = page.locator('input[type="checkbox"]:not([aria-label*="all" i])')
        const count = await checkboxes.count()
        test.skip(count < 2, "Fewer than 2 jobs available for batch test")

        await checkboxes.nth(0).check()
        await checkboxes.nth(1).check()

        // Sticky action bar should appear
        await expect(page.getByRole("button", { name: /^run$/i })).toBeVisible()

        // Capture network call
        const [response] = await Promise.all([
            page.waitForResponse((r) => r.url().includes("/jobs/batch-action") && r.request().method() === "POST"),
            page.getByRole("button", { name: /^run$/i }).click(),
        ])
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body).toHaveProperty("successes")
        expect(body).toHaveProperty("failures")
    })
})
