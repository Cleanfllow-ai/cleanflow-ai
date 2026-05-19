import { test, expect, type Page, type Locator } from "@playwright/test"
import fs from "node:fs"

/**
 * Canvas line-rendering verification.
 *
 * Programmatic check (not just screenshots) for the "lines disappear on
 * scroll" bug in the hierarchical mapper canvas. Playwright reads each
 * SVG <path>'s bbox + getBoundingClientRect at several scroll positions
 * so we can detect clipping deterministically.
 */

const ART = "e2e/.artifacts/canvas-lines"
const CANVAS_SELECTOR = "div.relative.grid.grid-cols-2.gap-x-20"

interface PathSnapshot {
    d: string
    bbox: { x: number; y: number; width: number; height: number }
    rect: { x: number; y: number; width: number; height: number }
}
interface FrameSnapshot {
    scrollTop: number
    container: { clientH: number; scrollH: number; clientW: number; scrollW: number }
    svg: {
        rect: { x: number; y: number; width: number; height: number }
        widthAttr: string | null
        heightAttr: string | null
        overflowAttr: string | null
        styleH: string
        styleW: string
    }
    pathCount: number
    paths: PathSnapshot[]
}

async function captureFrame(page: Page): Promise<FrameSnapshot> {
    return await page.evaluate((selector) => {
        // Find the scrolling canvas — must be the one with max-h and overflow-y-auto
        const candidates = Array.from(
            document.querySelectorAll<HTMLDivElement>(selector),
        )
        const container = candidates.find(
            (el) => el.scrollHeight > el.clientHeight + 5 || el.classList.contains("overflow-y-auto"),
        ) || candidates[0]
        if (!container) throw new Error("canvas container not found")
        // Only direct-child <svg> — avoid grabbing decorative icons
        const svg = container.querySelector(":scope > svg") as SVGSVGElement | null
        if (!svg) throw new Error("svg overlay not found as direct child")
        const paths = Array.from(svg.querySelectorAll("path")) as SVGPathElement[]
        const cb = container.getBoundingClientRect()
        const sb = svg.getBoundingClientRect()
        return {
            scrollTop: container.scrollTop,
            container: {
                clientH: container.clientHeight,
                scrollH: container.scrollHeight,
                clientW: container.clientWidth,
                scrollW: container.scrollWidth,
            },
            svg: {
                rect: { x: sb.x, y: sb.y, width: sb.width, height: sb.height },
                widthAttr: svg.getAttribute("width"),
                heightAttr: svg.getAttribute("height"),
                overflowAttr: svg.getAttribute("overflow"),
                styleH: (svg.style.height || ""),
                styleW: (svg.style.width || ""),
            },
            pathCount: paths.length,
            paths: paths.map((p) => {
                const bb = p.getBBox()
                const r = p.getBoundingClientRect()
                return {
                    d: p.getAttribute("d") || "",
                    bbox: { x: bb.x, y: bb.y, width: bb.width, height: bb.height },
                    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                }
            }),
        }
    }, CANVAS_SELECTOR)
}

async function scrollCanvas(page: Page, targetTop: number) {
    await page.evaluate(({ selector, y }) => {
        const candidates = Array.from(
            document.querySelectorAll<HTMLDivElement>(selector),
        )
        const container = candidates.find(
            (el) => el.scrollHeight > el.clientHeight + 5 || el.classList.contains("overflow-y-auto"),
        ) || candidates[0]
        if (!container) throw new Error("canvas container not found")
        container.scrollTop = y
        container.dispatchEvent(new Event("scroll"))
    }, { selector: CANVAS_SELECTOR, y: targetTop })
    await page.waitForTimeout(500)
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
    await card.page().waitForTimeout(1500)
    const loading = card.getByText(/loading entities/i)
    if (await loading.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loading.waitFor({ state: "hidden", timeout: 30000 })
    }
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
}

test("CANVAS LINES: stay attached + non-zero at every scroll position", async ({ page }) => {
    test.setTimeout(300000)

    fs.mkdirSync(ART, { recursive: true })

    await page.goto("/jobs", { waitUntil: "domcontentloaded", timeout: 120000 })
    // Dev mode: the page initially shows a loading spinner while the auth
    // tokens are picked up and the page hydrates. Wait for either the
    // dashboard heading OR the "New job" button — the loader resolves first.
    await page.getByRole("button", { name: /new job/i }).first().waitFor({ timeout: 90000 })
    const acc = page.getByRole("button", { name: /accept all/i }).first()
    if (await acc.isVisible({ timeout: 1500 }).catch(() => false)) await acc.click().catch(() => {})

    await page.getByRole("button", { name: /new job/i }).first().click()
    await page.waitForURL(/jobs\/create/, { timeout: 15000 })
    await page.getByRole("heading", { name: /create job/i }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(4000)

    const src = findCard(page, "source")
    const dst = findCard(page, "destination")
    await pickCategory(src, /^Applications$/i)
    await pickProvider(src, /zoho books/i)
    await pickEntity(src, /^Customers$/i)
    await pickCategory(dst, /^Applications$/i)
    await pickProvider(dst, /quickbooks/i)
    await pickEntity(dst, /^Customers$/i)

    await fillName(page, `pw-canvas-${Date.now().toString().slice(-6)}`)
    await page.screenshot({ path: `${ART}/01-step1.png`, fullPage: true })

    // Next → step 2 (per-pair accordion view by default)
    await page.getByRole("button", { name: /^next/i }).last().click()
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${ART}/02-step2-accordion.png`, fullPage: true })

    // In the per-pair (accordion) view, find and click "Auto-map (AI)" to
    // populate the column_mapping for the customers→customers pair. This
    // gives us many lines to verify in the Canvas view.
    const automap = page.getByRole("button", { name: /auto-?map.*ai/i }).first()
    if (await automap.isVisible({ timeout: 6000 }).catch(() => false)) {
        await automap.click({ timeout: 5000 })
        // Wait for the AI request to return + mappings to commit
        await page.waitForTimeout(12000)
    } else {
        // If the pair section is collapsed, expand it first
        const pairToggle = page.getByText(/customers.*customers/i).first()
        await pairToggle.click().catch(() => {})
        await page.waitForTimeout(800)
        const automap2 = page.getByRole("button", { name: /auto-?map.*ai/i }).first()
        await automap2.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(12000)
    }
    await page.screenshot({ path: `${ART}/03-after-automap.png`, fullPage: true })

    // Switch to Canvas view
    await page.getByRole("button", { name: /^canvas$/i }).first().click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${ART}/04-canvas-loaded.png`, fullPage: true })

    // Try to drag source customers row onto dest customers row — this
    // triggers bulkAutoPair which expandEntity()s BOTH sides and creates
    // 26 field lines. Best case: 26 lines to verify. Fallback case: still
    // 1 entity-summary line (sufficient to verify the SVG clipping fix).
    const canvas = page.locator(CANVAS_SELECTOR).first()
    const srcCustomerHeader = canvas.locator(
        "div.cursor-grab",
    ).filter({ hasText: /^customers/i }).first()
    const dstCustomerHeader = canvas.locator(
        ".cursor-pointer",
    ).filter({ hasText: /^customers/i }).last()
    if (
        await srcCustomerHeader.isVisible({ timeout: 2000 }).catch(() => false)
        && await dstCustomerHeader.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
        const sb = await srcCustomerHeader.boundingBox()
        const db = await dstCustomerHeader.boundingBox()
        if (sb && db) {
            await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
            await page.mouse.down()
            // Move in steps to trigger drag.active = true
            for (let i = 1; i <= 10; i++) {
                const t = i / 10
                await page.mouse.move(
                    sb.x + (db.x - sb.x) * t + db.width / 2,
                    sb.y + (db.y - sb.y) * t + db.height / 2,
                    { steps: 3 },
                )
                await page.waitForTimeout(80)
            }
            await page.mouse.up()
            await page.waitForTimeout(4000)
        }
    }

    const expandResult = await page.evaluate((selector) => {
        const candidates = Array.from(
            document.querySelectorAll<HTMLDivElement>(selector),
        )
        const container = candidates.find(
            (el) => el.scrollHeight > el.clientHeight + 5 || el.classList.contains("overflow-y-auto"),
        ) || candidates[0]
        if (!container) return { expanded: 0, total: 0 }
        const labelSpans = Array.from(
            container.querySelectorAll<HTMLSpanElement>("span.text-xs.font-medium"),
        ).filter((s) => (s.textContent || "").trim().toLowerCase() === "customers")
        let expanded = 0
        for (const labelSpan of labelSpans) {
            const headerRow = labelSpan.parentElement
            if (!headerRow) continue
            const chevronSpan = headerRow.querySelector(
                'span[data-stop-entity-drag="1"]',
            ) as HTMLElement | null
            if (!chevronSpan) continue
            const isCollapsed = !!chevronSpan.querySelector("svg.lucide-chevron-right")
            if (!isCollapsed) continue
            // Dispatch the full event sequence React expects.
            const rect = chevronSpan.getBoundingClientRect()
            const x = rect.left + rect.width / 2
            const y = rect.top + rect.height / 2
            const opts = {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                button: 0,
                buttons: 1,
                pointerType: "mouse",
                pointerId: 1,
                isPrimary: true,
            }
            chevronSpan.dispatchEvent(new PointerEvent("pointerdown", opts))
            chevronSpan.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 }))
            chevronSpan.dispatchEvent(new MouseEvent("click", opts as any))
            expanded++
        }
        return { expanded, total: labelSpans.length }
    }, CANVAS_SELECTOR)
    console.log(`expand result: ${JSON.stringify(expandResult)}`)
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${ART}/05-canvas-expanded.png`, fullPage: true })

    // ── Capture frames at multiple scroll positions ────────────────────────────
    const frames: FrameSnapshot[] = []

    await scrollCanvas(page, 0)
    frames.push(await captureFrame(page))
    await page.screenshot({ path: `${ART}/05-frame-0.png`, fullPage: true })

    const f0 = frames[0]
    const maxScroll = Math.max(0, f0.container.scrollH - f0.container.clientH)
    console.log(`f0: scrollH=${f0.container.scrollH} clientH=${f0.container.clientH} maxScroll=${maxScroll}`)
    console.log(`f0 svg: w=${f0.svg.widthAttr} h=${f0.svg.heightAttr} overflow=${f0.svg.overflowAttr} styleH=${f0.svg.styleH}`)

    await scrollCanvas(page, Math.floor(maxScroll / 3))
    frames.push(await captureFrame(page))
    await page.screenshot({ path: `${ART}/06-frame-1.png`, fullPage: true })

    await scrollCanvas(page, Math.floor((maxScroll * 2) / 3))
    frames.push(await captureFrame(page))
    await page.screenshot({ path: `${ART}/07-frame-2.png`, fullPage: true })

    await scrollCanvas(page, maxScroll)
    frames.push(await captureFrame(page))
    await page.screenshot({ path: `${ART}/08-frame-3.png`, fullPage: true })

    fs.writeFileSync(`${ART}/frames.json`, JSON.stringify(frames, null, 2))

    console.log("=== CANVAS FRAME ANALYSIS ===")
    for (let i = 0; i < frames.length; i++) {
        const f = frames[i]
        const zeroBboxCount = f.paths.filter(p => p.bbox.width < 1 || p.bbox.height < 1).length
        const zeroRectCount = f.paths.filter(p => p.rect.width < 1 || p.rect.height < 1).length
        console.log(`Frame ${i} scrollTop=${f.scrollTop}:`)
        console.log(`  container clientH=${f.container.clientH} scrollH=${f.container.scrollH}`)
        console.log(`  svg overflow=${f.svg.overflowAttr} styleH=${f.svg.styleH} rect h=${f.svg.rect.height.toFixed(0)}`)
        console.log(`  paths total=${f.pathCount} zeroBbox=${zeroBboxCount} zeroRect=${zeroRectCount}`)
        if (zeroBboxCount > 0 || zeroRectCount > 0) {
            const bad = f.paths.filter(p => p.bbox.width < 1 || p.bbox.height < 1 || p.rect.width < 1 || p.rect.height < 1)
            console.log(`  bad paths (first 3):`, bad.slice(0, 3).map(b => ({ d: b.d.slice(0, 80), bbox: b.bbox, rect: b.rect })))
        }
    }

    // ── Assertions ───────────────────────────────────────────────────────────
    expect(frames[0].svg.overflowAttr, "SVG overflow attribute should be 'visible'").toBe("visible")

    const counts = frames.map(f => f.pathCount)
    expect(new Set(counts).size, `path count varied across scroll: ${counts.join(",")}`).toBe(1)
    expect(counts[0], "should have at least one mapping line").toBeGreaterThan(0)

    // A line has length: max(bbox.width, bbox.height) > 1. A perfectly
    // horizontal line has bbox.height = 0 — that's fine. The actual failure
    // mode the user reported ("lines disappearing") would manifest as a
    // path whose bbox is collapsed (both width AND height ~ 0).
    for (let i = 0; i < frames.length; i++) {
        const f = frames[i]
        const bad = f.paths.filter(p =>
            Math.max(p.bbox.width, p.bbox.height) < 1
            || Math.max(p.rect.width, p.rect.height) < 1,
        )
        expect(
            bad.length,
            `Frame ${i}: ${bad.length} path(s) collapsed (no width/height in bbox or rendered rect)`,
        ).toBe(0)
    }
})
