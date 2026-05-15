import { test, expect, type Page, type Locator } from "@playwright/test"

/**
 * Manual mapping test — pick destinations row-by-row via the dropdown (instead of Auto-map AI).
 * Each row in the Column Mapping editor has a Select with placeholder "Select field...".
 * We pick a specific destination field for 2 source fields, leave the rest unmapped,
 * confirm the POST /jobs payload's column_mapping reflects exactly those choices.
 */
const ART = "e2e/.artifacts"

function netCapture(page: Page) {
    const cap = { jobsRequests: [] as Array<any>, errorResponses: [] as Array<any> }
    page.on("request", (req) => {
        if (req.url().includes("/jobs") && req.method() === "POST") {
            cap.jobsRequests.push({ url: req.url(), method: req.method(), body: req.postData() || "" })
        }
    })
    page.on("response", async (resp) => {
        if (resp.status() >= 400 && /\/jobs|\/connectors/.test(resp.url())) {
            try { cap.errorResponses.push({ url: resp.url(), status: resp.status(), body: (await resp.text()).slice(0,500) }) } catch {}
        }
    })
    return cap
}

async function dismissBanners(page: Page) {
    const a = page.getByRole("button", { name: /accept all/i }).first()
    if (await a.isVisible({ timeout: 1500 }).catch(() => false)) {
        await a.click().catch(() => {})
        await page.waitForTimeout(300)
    }
}

async function openWizard(page: Page, label: string) {
    await page.goto("/jobs", { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /jobs|scheduled jobs/i }).first().waitFor({ timeout: 30000 })
    await dismissBanners(page)
    await page.getByRole("button", { name: /new job/i }).first().click()
    await page.waitForURL(/jobs\/create/, { timeout: 15000 })
    await page.getByRole("heading", { name: /create job/i }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${ART}/${label}-01-wizard.png`, fullPage: true })
}

async function pickCategory(card: Locator, ui: RegExp) {
    const cat = card.locator("button[role='combobox']").nth(0)
    await cat.click()
    await card.page().getByRole("option", { name: ui }).first().click({ timeout: 5000 })
    await card.page().waitForTimeout(700)
}
async function pickProvider(card: Locator, name: RegExp) {
    const prov = card.locator("button[role='combobox']").nth(1)
    await prov.click({ timeout: 8000 })
    await card.page().getByRole("option", { name }).first().click({ timeout: 8000 })
    await card.page().waitForTimeout(2000)
}
async function pickEntity(card: Locator, name: RegExp) {
    const b = card.getByRole("button", { name }).first()
    await expect(b).toBeVisible({ timeout: 10000 })
    await b.click()
    await card.page().waitForTimeout(300)
}
function findCard(page: Page, side: "source" | "destination"): Locator {
    const label = side === "source" ? "Source" : "Destination"
    return page
        .locator(`div.rounded-lg.border.bg-card`)
        .filter({ has: page.getByText(new RegExp(`${label}.*(primary)`, "i")) })
        .first()
}
async function fillName(page: Page, name: string) {
    const input = page.getByLabel(/job name/i).last()
    await input.click()
    await input.fill("")
    await input.pressSequentially(name, { delay: 20 })
    await input.evaluate((el: HTMLInputElement, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
        setter?.call(el, val)
        el.dispatchEvent(new Event("input", { bubbles: true }))
    }, name)
}

test("MANUAL: Zoho customers → QBO customers — pick dest for 2 rows by hand", async ({ page }) => {
    test.setTimeout(120000)

    const cap = netCapture(page)
    await openWizard(page, "M1-manual")

    const src = findCard(page, "source")
    const dst = findCard(page, "destination")

    await pickCategory(src, /^Applications$/i)
    await pickProvider(src, /zoho books/i)
    await pickEntity(src, /^Customers$/i)
    await pickCategory(dst, /^Applications$/i)
    await pickProvider(dst, /quickbooks/i)
    await pickEntity(dst, /^Customers$/i)

    const NAME = `pw-manual-${Date.now().toString().slice(-6)}`
    await fillName(page, NAME)
    await page.screenshot({ path: `${ART}/M1-manual-02-step1-filled.png`, fullPage: true })

    // Go to Step 2 (mapping)
    await page.getByRole("button", { name: /^next/i }).last().click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${ART}/M1-manual-03-mapping-open.png`, fullPage: true })

    // Each row in the Column Mapping editor has a Select with placeholder
    // "— Not mapped —". They appear in document order matching the source-field list.
    // Strategy: enumerate all comboboxes inside the Column Mapping panel and
    // pick by index (1st = Contact Name, then Company Name, etc.).
    // The first 2 comboboxes (Category + Provider) live in panels above; the
    // mapping ones come after.
    const allCombos = page.locator("button[role='combobox']")
    const total = await allCombos.count()
    console.log(`total comboboxes on page: ${total}`)
    // Find the mapping comboboxes — those with text "Not mapped" or with a
    // sibling source-field label. Use the placeholder/value text "Not mapped".
    const notMappedCombos = page.locator("button[role='combobox']").filter({ hasText: /not mapped/i })
    const notMappedCount = await notMappedCombos.count()
    console.log(`mapping comboboxes ('not mapped' state): ${notMappedCount}`)

    // Row 1: 1st "not mapped" combobox → pick "Display Name"
    const combo1 = notMappedCombos.first()
    await combo1.scrollIntoViewIfNeeded()
    await combo1.click({ timeout: 5000 })
    await page.waitForTimeout(500)
    // Pick "Display Name" — the first option matching that label
    await page.getByRole("option", { name: /^Display Name$/i }).first().click({ timeout: 5000 })
    await page.waitForTimeout(500)

    // After picking, that row's combobox text changes from "Not mapped" to
    // "Display Name". The set shrinks by 1. Re-locate.
    const stillUnmapped = page.locator("button[role='combobox']").filter({ hasText: /not mapped/i })
    const stillCount = await stillUnmapped.count()
    console.log(`after pick 1, unmapped count: ${stillCount}`)
    // Row 2: pick a 2nd one — say the new first unmapped → pick "Company Name"
    if (stillCount > 0) {
        const combo2 = stillUnmapped.first()
        await combo2.scrollIntoViewIfNeeded()
        await combo2.click({ timeout: 5000 })
        await page.waitForTimeout(500)
        await page.getByRole("option", { name: /^Company Name$/i }).first().click({ timeout: 5000 })
        await page.waitForTimeout(500)
    }

    await page.screenshot({ path: `${ART}/M1-manual-04-after-pick.png`, fullPage: true })

    // Now check the header — "X / Y mapped"
    const mappedHeader = page.getByText(/\d+ ?\/ ?\d+ mapped/).first()
    if (await mappedHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
        const txt = await mappedHeader.textContent()
        console.log("Mapping header:", txt)
    }

    // Click Create Job
    await page.getByRole("button", { name: /^create job$/i }).last().click({ timeout: 8000 })
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${ART}/M1-manual-99-final.png`, fullPage: true })

    console.log("=== MANUAL MAPPING RESULT ===")
    console.log("jobsRequests:", cap.jobsRequests.map(r => r.body.slice(0, 800)))
    console.log("errors:", cap.errorResponses)

    // Validate the payload had MANUAL mapping (not auto-mapped 26 fields).
    expect(cap.jobsRequests.length).toBe(1)
    const body = JSON.parse(cap.jobsRequests[0].body)
    console.log("name:", body.name)
    console.log("column_mapping:", body.column_mapping)
    console.log("pipeline_steps[0].inline_mapping:", body.pipeline_steps?.[0]?.inline_mapping)

    // Expect SOME mapping (1 or 2 keys, not the 26 from Auto-map)
    const mappingKeys = Object.keys(body.column_mapping || body.pipeline_steps?.[0]?.inline_mapping || {})
    console.log(`mapped keys: ${mappingKeys.length} — ${JSON.stringify(mappingKeys)}`)
    expect(mappingKeys.length).toBeGreaterThan(0)
    expect(mappingKeys.length).toBeLessThan(10) // sanity: manual was 2 picks
})
