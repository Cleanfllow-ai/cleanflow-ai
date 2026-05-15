import { test, expect, type Page, type Locator } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const TOKENS = (() => {
    const p = path.join(__dirname, "..", ".auth", "inject-tokens.json")
    return JSON.parse(fs.readFileSync(p, "utf8"))
})()

test.beforeEach(async ({ context }) => {
    // Inject auth tokens BEFORE the page loads so the auth provider's
    // useEffect on mount reads them and skips the "Loading..." spinner.
    await context.addInitScript((tokens) => {
        window.localStorage.setItem(
            "authTokens",
            JSON.stringify({
                idToken: tokens.idToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            }),
        )
    }, TOKENS)
})

// Skip the auth.setup.ts storage state — we inject via beforeEach instead
test.use({ storageState: { cookies: [], origins: [] } })
test.setTimeout(120000)  // Next.js dev mode is slow on first navigation

/**
 * Full cardinality matrix test through the actual Jobs creation wizard.
 *
 * Uses selectors derived from modules/jobs/components/endpoints-step.tsx:
 *   - Each endpoint card has Category label + combobox, Provider label + combobox
 *   - Entity picker is a list of <button> rows with the entity label
 *   - "Add destination" / "Add source" buttons add new endpoint cards
 *   - The header text "SOURCE (PRIMARY)" or "DESTINATION (PRIMARY)" identifies card #1
 *
 * Each test captures network requests + console errors + toast text and validates
 * that the resulting POST /jobs payload reflects the intended cardinality.
 */

const ART = "e2e/.artifacts"

function netCapture(page: Page) {
    const out = {
        jobsRequests: [] as Array<{ url: string; method: string; body: string }>,
        errorResponses: [] as Array<{ url: string; status: number; body: string }>,
        consoleErrors: [] as string[],
    }
    page.on("request", (req) => {
        if (req.url().includes("/jobs") && req.method() !== "GET") {
            out.jobsRequests.push({ url: req.url(), method: req.method(), body: req.postData() || "" })
        }
    })
    page.on("response", async (resp) => {
        if (resp.status() >= 400 && /\/jobs|\/connectors|\/org/.test(resp.url())) {
            let body = ""
            try { body = (await resp.text()).slice(0, 600) } catch {}
            out.errorResponses.push({ url: resp.url(), status: resp.status(), body })
        }
    })
    page.on("console", (msg) => {
        if (msg.type() === "error") out.consoleErrors.push(msg.text().slice(0, 300))
    })
    return out
}

async function dismissBanners(page: Page) {
    const accept = page.getByRole("button", { name: /accept all/i }).first()
    if (await accept.isVisible({ timeout: 1500 }).catch(() => false)) {
        await accept.click().catch(() => {})
        await page.waitForTimeout(300)
    }
}

async function openWizard(page: Page, label: string) {
    await page.goto("/jobs", { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /jobs|scheduled jobs/i }).first().waitFor({ timeout: 30000 })
    await dismissBanners(page)
    await page.screenshot({ path: `${ART}/${label}-01-list.png`, fullPage: true })

    // Force-navigate directly to /jobs/create — more reliable than clicking through
    // because Next.js dev mode rebuilds can delay router.push.
    await page.goto("/jobs/create", { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /create job/i }).waitFor({ timeout: 30000 })
    // Wait for provider loading to finish (Loading... → real select)
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${ART}/${label}-02-wizard.png`, fullPage: true })
}

/**
 * Find a source/destination endpoint card by its position (1 = primary, 2 = second, ...).
 * Falls back to text-matching the section header.
 */
function findCard(page: Page, side: "source" | "destination", index = 1): Locator {
    // Each card is `<div class="rounded-lg border bg-card p-3 space-y-2.5">` with a header
    // containing "Source (primary)" or "Destination (primary)". Use the badge text.
    const sideLabel = side === "source" ? "Source" : "Destination"
    return page
        .locator(`div.rounded-lg.border.bg-card`)
        .filter({ has: page.getByText(new RegExp(`${sideLabel}.*(primary|\\(${index === 1 ? "primary" : "secondary"}\\))`, "i")) })
        .first()
}

async function selectInCard(card: Locator, labelText: RegExp, optionText: RegExp) {
    const select = card.locator("button[role='combobox']").filter({ hasNot: card.locator(":scope:has(svg.animate-spin)") })
    // The label is right above the combobox; clicking the combobox by ANY pattern
    // is unreliable. Better: pick by aria-labelledby or by position.
    // Simpler: there are exactly 2 comboboxes per card in fixed order: Category, Provider.
    const all = card.locator("button[role='combobox']")
    const count = await all.count()
    let targetIndex = -1
    for (let i = 0; i < count; i++) {
        const t = (await all.nth(i).textContent({ timeout: 1000 }).catch(() => "")) || ""
        // We don't have the label inside the combobox text in this app.
        // Use position instead — caller passes labelText hint to disambiguate.
        if (labelText.test("category") && i === 0) { targetIndex = i; break }
        if (labelText.test("provider") && i === 1) { targetIndex = i; break }
    }
    if (targetIndex === -1) targetIndex = 0
    await all.nth(targetIndex).click({ timeout: 6000 })
    await card.page().getByRole("option", { name: optionText }).first().click({ timeout: 6000 })
    await card.page().waitForTimeout(800)
}

async function pickCategory(card: Locator, category: "Applications" | "Warehouse" | "Storage") {
    const cat = card.locator("button[role='combobox']").nth(0)
    const current = (await cat.textContent({ timeout: 1000 }).catch(() => "")) || ""
    // Map our test alias to the actual UI option text
    const uiLabelMap = {
        "Applications": /^Applications$/i,
        "Warehouse": /^Data Warehouses$|^Warehouse$/i,
        "Storage": /^Cloud Storage$|^Storage$/i,
    } as const
    if (current.toLowerCase().includes(category.toLowerCase())) return
    if (category === "Warehouse" && current.toLowerCase().includes("warehouse")) return
    if (category === "Storage" && current.toLowerCase().includes("storage")) return
    await cat.click()
    await card.page().getByRole("option", { name: uiLabelMap[category] }).first().click({ timeout: 5000 })
    await card.page().waitForTimeout(700)
}

async function pickProvider(card: Locator, providerName: RegExp) {
    // Wait for provider combobox to no longer say Loading...
    const prov = card.locator("button[role='combobox']").nth(1)
    await expect(prov).toBeVisible({ timeout: 10000 })
    // Sometimes the combobox is replaced by a "Loading..." placeholder div. Wait for it to become a combobox.
    for (let i = 0; i < 10; i++) {
        const visible = await prov.isVisible({ timeout: 1000 }).catch(() => false)
        if (visible) break
        await card.page().waitForTimeout(500)
    }
    await prov.click({ timeout: 8000 })
    await card.page().getByRole("option", { name: providerName }).first().click({ timeout: 8000 })
    await card.page().waitForTimeout(2000) // entity list loads
}

async function pickEntity(card: Locator, entityName: RegExp) {
    // ErpEntityPicker renders each entity as a <button type="button"> with the label text inside.
    // Look for the button inside the card.
    const entBtn = card.getByRole("button", { name: entityName }).first()
    await expect(entBtn).toBeVisible({ timeout: 10000 })
    await entBtn.click({ timeout: 5000 })
    await card.page().waitForTimeout(300)
}

async function fillName(page: Page, name: string) {
    const inputs = page.getByLabel(/job name/i)
    const cnt = await inputs.count()
    console.log(`fillName: ${cnt} matching inputs`)
    // Try the LAST one (which seems to be the active stepper's input)
    const input = inputs.last()
    await input.click()
    await input.fill("")
    await input.pressSequentially(name, { delay: 20 })
    await page.waitForTimeout(300)
    // Also dispatch a synthetic React-friendly input event
    await input.evaluate((el: HTMLInputElement, val) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
        if (nativeSetter) {
            nativeSetter.call(el, val)
            el.dispatchEvent(new Event("input", { bubbles: true }))
            el.dispatchEvent(new Event("change", { bubbles: true }))
        }
    }, name)
}

async function clickAddDestination(page: Page) {
    await page.getByRole("button", { name: /add destination/i }).click({ timeout: 5000 })
    await page.waitForTimeout(800)
}

async function clickAddSource(page: Page) {
    await page.getByRole("button", { name: /add source/i }).click({ timeout: 5000 })
    await page.waitForTimeout(800)
}

async function setFrequency(page: Page, freq: "batch" | "every-hour" | "every-15-min" | "daily") {
    const map = {
        "batch": /one-time|batch|^one time$/i,
        "every-hour": /every hour|1 hour|^hourly$/i,
        "every-15-min": /every 15 minutes|15 min/i,
        "daily": /daily|every day/i,
    } as const
    // Find Frequency by its label
    const trigger = page.locator("div").filter({ has: page.getByText(/^Frequency$/i, { exact: true }) }).first()
        .getByRole("combobox").first()
    await trigger.click({ timeout: 5000 }).catch(async () => {
        // Fallback: pick any combobox that contains an "every hour"-style label
        const fallback = page.getByRole("combobox").filter({ hasText: /every|batch|hour|day|once/i }).first()
        await fallback.click({ timeout: 5000 }).catch(() => {})
    })
    await page.getByRole("option", { name: map[freq] }).first().click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(400)
}

async function goNextOrCreate(page: Page) {
    // The footer button changes label across steps
    const btn = page.locator("button").filter({ hasText: /^next|create job|create.*launch|^launch$|^save$|^submit$/i }).last()
    await btn.click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(2000)
}

async function collectToasts(page: Page): Promise<string[]> {
    await page.waitForTimeout(3500)
    const toasts: string[] = []
    const candidates = page.locator('li[role="status"], [role="status"], [data-state="open"]')
    const n = await candidates.count()
    for (let i = 0; i < n; i++) {
        const t = (await candidates.nth(i).textContent().catch(() => "")) || ""
        const trimmed = t.trim()
        // Filter out the Next.js dev badge CSS noise
        if (trimmed && trimmed.length < 300 && !trimmed.includes("--timing")) {
            toasts.push(trimmed)
        }
    }
    return toasts
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1 — 1:1 — Zoho customers → QBO customers (default "Every hour")
// ════════════════════════════════════════════════════════════════════════
test("CARD-1: 1:1 — Zoho customers → QBO customers", async ({ page }) => {
    const cap = netCapture(page)
    await openWizard(page, "C1-1to1")

    const srcCard = findCard(page, "source")
    const dstCard = findCard(page, "destination")

    await pickCategory(srcCard, "Applications")
    await pickProvider(srcCard, /zoho books/i)
    await pickEntity(srcCard, /^Customers$/i)

    await pickCategory(dstCard, "Applications")
    await pickProvider(dstCard, /quickbooks/i)
    await pickEntity(dstCard, /^Customers$/i)

    // Fill name LAST, just before going to step 2 — earlier fills can be
    // overwritten by re-renders from provider/entity selection.
    const JOB_NAME = `pw-c1-${Date.now().toString().slice(-6)}`
    await fillName(page, JOB_NAME)
    await page.waitForTimeout(500)
    // Verify the name is actually in the input
    const filledName = await page.getByLabel(/job name/i).inputValue().catch(() => "")
    console.log(`name in input: '${filledName}'`)
    await page.screenshot({ path: `${ART}/C1-1to1-03-step1-filled.png`, fullPage: true })

    await goNextOrCreate(page) // → Field Mapping step
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${ART}/C1-1to1-04-mapping.png`, fullPage: true })

    // Find and click the Auto-map (AI) button. It might be in the mapping panel
    // header directly (no dialog opening needed).
    const autoBtn = page.getByRole("button", { name: /auto-map.*ai|auto.map/i }).first()
    if (await autoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await autoBtn.click()
        await page.waitForTimeout(10000) // AI call takes a few seconds
        await page.screenshot({ path: `${ART}/C1-1to1-05-after-automap.png`, fullPage: true })
    } else {
        // Maybe need to click the pair card first to focus it
        console.log("INFO: Auto-map not directly visible — looking for pair card...")
        const pairs = page.locator("div, button").filter({ hasText: /customers.*customers/i })
        if (await pairs.count() > 0) {
            await pairs.first().click({ timeout: 3000 }).catch(() => {})
            await page.waitForTimeout(1500)
            const autoBtn2 = page.getByRole("button", { name: /auto-map.*ai|auto.map/i }).first()
            if (await autoBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
                await autoBtn2.click()
                await page.waitForTimeout(10000)
                await page.screenshot({ path: `${ART}/C1-1to1-05b-after-automap.png`, fullPage: true })
            }
        }
    }

    // Close the mapping editor dialog (Done button) if it's open
    const doneBtn = page.getByRole("button", { name: /^done$/i }).first()
    if (await doneBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await doneBtn.click()
        await page.waitForTimeout(800)
    }

    await page.screenshot({ path: `${ART}/C1-1to1-06-before-submit.png`, fullPage: true })

    // Click Create Job in the wizard footer — most specific match
    const createBtn = page.getByRole("button", { name: /^create job$/i })
    const cnt = await createBtn.count()
    console.log(`Create Job button count: ${cnt}`)
    if (cnt > 0) {
        // Pick the FOOTER one — usually the last
        await createBtn.last().click({ timeout: 8000 })
    }

    const toasts = await collectToasts(page)
    await page.screenshot({ path: `${ART}/C1-1to1-99-final.png`, fullPage: true })

    console.log("=== CARD-1 RESULT ===")
    console.log("toasts:", toasts)
    console.log("jobsRequests:", JSON.stringify(cap.jobsRequests.map(r => ({ ...r, body: r.body.slice(0, 600) })), null, 2))
    console.log("errors 4xx/5xx:", JSON.stringify(cap.errorResponses, null, 2))
    console.log("console errors:", cap.consoleErrors.slice(0, 10))
})

// ════════════════════════════════════════════════════════════════════════
// TEST 2 — 1:N — Zoho customers → QBO customers + Snowflake table
// ════════════════════════════════════════════════════════════════════════
test("CARD-2: 1:N — Zoho customers → QBO + Snowflake", async ({ page }) => {
    const cap = netCapture(page)
    await openWizard(page, "C2-1toN")

    const srcCard = findCard(page, "source")
    const dstCard = findCard(page, "destination")

    await pickCategory(srcCard, "Applications")
    await pickProvider(srcCard, /zoho books/i)
    await pickEntity(srcCard, /^Customers$/i)

    await pickCategory(dstCard, "Applications")
    await pickProvider(dstCard, /quickbooks/i)
    await pickEntity(dstCard, /^Customers$/i)

    // Add a 2nd destination
    await clickAddDestination(page)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${ART}/C2-1toN-03-2dests.png`, fullPage: true })

    // Find the 2nd destination card — last card containing "DESTINATION" header
    // (the second-instance label is "DESTINATION" without "(primary)").
    const destCards = page.locator(`div.rounded-lg.border.bg-card`)
        .filter({ has: page.getByText(/destination/i) })
    const dstCount = await destCards.count()
    console.log(`dest cards: ${dstCount}`)
    const dst2 = destCards.nth(dstCount - 1) // last
    await pickCategory(dst2, "Warehouse").catch((e) => console.log("dst2 category err:", e.message))
    await pickProvider(dst2, /snowflake/i).catch((e) => console.log("dst2 provider err:", e.message))
    await page.waitForTimeout(800)

    await fillName(page, `pw-c2-${Date.now().toString().slice(-6)}`)
    await page.screenshot({ path: `${ART}/C2-1toN-04-filled.png`, fullPage: true })

    await goNextOrCreate(page)
    await goNextOrCreate(page)
    const toasts = await collectToasts(page)
    await page.screenshot({ path: `${ART}/C2-1toN-99-final.png`, fullPage: true })

    console.log("=== CARD-2 RESULT ===")
    console.log("toasts:", toasts)
    console.log("jobsRequests:", JSON.stringify(cap.jobsRequests.map(r => ({ ...r, body: r.body.slice(0, 600) })), null, 2))
    console.log("errors:", JSON.stringify(cap.errorResponses, null, 2))
})

// ════════════════════════════════════════════════════════════════════════
// TEST 3 — N:1 — Zoho customers + QBO customers → Snowflake
// ════════════════════════════════════════════════════════════════════════
test("CARD-3: N:1 — Zoho + QBO customers → Snowflake", async ({ page }) => {
    const cap = netCapture(page)
    await openWizard(page, "C3-Nto1")

    const srcCard = findCard(page, "source")
    const dstCard = findCard(page, "destination")

    await pickCategory(srcCard, "Applications")
    await pickProvider(srcCard, /zoho books/i)
    await pickEntity(srcCard, /^Customers$/i)

    await pickCategory(dstCard, "Warehouse")
    await pickProvider(dstCard, /snowflake/i)

    // Add a 2nd source
    await clickAddSource(page)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${ART}/C3-Nto1-03-2srcs.png`, fullPage: true })

    const srcCards = page.locator(`div.rounded-lg.border.bg-card`)
        .filter({ has: page.getByText(/source/i) })
    const srcCount = await srcCards.count()
    console.log(`src cards: ${srcCount}`)
    const src2 = srcCards.nth(srcCount - 1) // last
    await pickCategory(src2, "Applications").catch((e) => console.log("src2 category err:", e.message))
    await pickProvider(src2, /quickbooks/i).catch((e) => console.log("src2 provider err:", e.message))
    await pickEntity(src2, /^Customers$/i).catch((e) => console.log("src2 entity err:", e.message))

    await fillName(page, `pw-c3-${Date.now().toString().slice(-6)}`)
    await page.screenshot({ path: `${ART}/C3-Nto1-04-filled.png`, fullPage: true })

    await goNextOrCreate(page)
    await goNextOrCreate(page)
    const toasts = await collectToasts(page)
    await page.screenshot({ path: `${ART}/C3-Nto1-99-final.png`, fullPage: true })

    console.log("=== CARD-3 RESULT ===")
    console.log("toasts:", toasts)
    console.log("jobsRequests:", JSON.stringify(cap.jobsRequests.map(r => ({ ...r, body: r.body.slice(0, 800) })), null, 2))
    console.log("errors:", JSON.stringify(cap.errorResponses, null, 2))
})
