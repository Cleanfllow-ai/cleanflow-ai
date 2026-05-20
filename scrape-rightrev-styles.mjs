/**
 * scrape-rightrev-styles.mjs
 * Extracts gradient colors, background patterns, and text animations from rightrev.com
 * Usage: node scrape-rightrev-styles.mjs
 */

import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "scrape-output")
mkdirSync(OUT_DIR, { recursive: true })

async function shot(page, name) {
  const file = join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`  ✓ ${name}.png`)
}

;(async () => {
  console.log("=== Scraping rightrev.com styles ===\n")

  const browser = await chromium.launch({ headless: false, slowMo: 100 })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await page.goto("https://www.rightrev.com/", { waitUntil: "networkidle", timeout: 30000 })
  await page.waitForTimeout(2000)
  await shot(page, "01-homepage")

  // ─── Extract hero section styles ─────────────────────────────────────
  const heroStyles = await page.evaluate(() => {
    const results = {}

    // Find all elements with gradient backgrounds
    const allEls = document.querySelectorAll("*")
    const gradientEls = []
    const animatedTextEls = []
    const patternEls = []

    allEls.forEach((el) => {
      const cs = window.getComputedStyle(el)
      const bg = cs.backgroundImage
      const color = cs.color
      const animation = cs.animation
      const bgColor = cs.backgroundColor

      // Capture gradient backgrounds
      if (bg && (bg.includes("linear-gradient") || bg.includes("radial-gradient") || bg.includes("conic-gradient"))) {
        const tag = el.tagName.toLowerCase()
        const classes = el.className?.toString?.()?.substring(0, 120) || ""
        const text = el.innerText?.substring(0, 80) || ""
        gradientEls.push({
          tag,
          classes,
          text,
          backgroundImage: bg,
          backgroundColor: bgColor,
          color,
          width: cs.width,
          height: cs.height,
          animation,
        })
      }

      // Capture animated text (color animations, gradient text)
      if (animation && animation !== "none" && animation.length > 4) {
        const tag = el.tagName.toLowerCase()
        const classes = el.className?.toString?.()?.substring(0, 120) || ""
        const text = el.innerText?.substring(0, 80) || ""
        if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "span" || tag === "p") {
          animatedTextEls.push({
            tag,
            classes,
            text,
            animation,
            color,
            backgroundImage: bg,
            webkitBackgroundClip: cs.webkitBackgroundClip,
            webkitTextFillColor: cs.webkitTextFillColor,
          })
        }
      }

      // Pattern backgrounds (SVG patterns, repeating gradients)
      if (bg && (bg.includes("repeating") || bg.includes("svg") || bg.includes("url("))) {
        const tag = el.tagName.toLowerCase()
        const classes = el.className?.toString?.()?.substring(0, 120) || ""
        patternEls.push({
          tag,
          classes,
          backgroundImage: bg.substring(0, 300),
          backgroundSize: cs.backgroundSize,
          backgroundRepeat: cs.backgroundRepeat,
        })
      }
    })

    results.gradients = gradientEls.slice(0, 30)
    results.animatedText = animatedTextEls.slice(0, 20)
    results.patterns = patternEls.slice(0, 20)
    return results
  })

  // ─── Extract hero heading specifically ───────────────────────────────
  const headingStyles = await page.evaluate(() => {
    const headings = document.querySelectorAll("h1, h2")
    const out = []
    headings.forEach((h) => {
      const cs = window.getComputedStyle(h)
      // Also check child spans
      const spans = h.querySelectorAll("span")
      const spanData = []
      spans.forEach((s) => {
        const sc = window.getComputedStyle(s)
        spanData.push({
          text: s.innerText?.substring(0, 80),
          color: sc.color,
          backgroundImage: sc.backgroundImage,
          backgroundClip: sc.backgroundClip,
          webkitBackgroundClip: sc.webkitBackgroundClip,
          webkitTextFillColor: sc.webkitTextFillColor,
          animation: sc.animation,
          filter: sc.filter,
          textShadow: sc.textShadow,
          classes: s.className?.toString?.()?.substring(0, 200),
        })
      })
      out.push({
        text: h.innerText?.substring(0, 120),
        color: cs.color,
        backgroundImage: cs.backgroundImage,
        backgroundClip: cs.backgroundClip,
        webkitBackgroundClip: cs.webkitBackgroundClip,
        webkitTextFillColor: cs.webkitTextFillColor,
        animation: cs.animation,
        filter: cs.filter,
        textShadow: cs.textShadow,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        classes: h.className?.toString?.()?.substring(0, 200),
        spans: spanData,
      })
    })
    return out
  })

  // ─── Extract all CSS keyframe animations ─────────────────────────────
  const keyframes = await page.evaluate(() => {
    const rules = []
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE) {
            rules.push({
              name: rule.name,
              cssText: rule.cssText.substring(0, 800),
            })
          }
          // Also grab rules with gradient or animation
          if (rule.type === CSSRule.STYLE_RULE) {
            const text = rule.cssText || ""
            if (
              text.includes("gradient") ||
              text.includes("animation") ||
              text.includes("background-clip") ||
              text.includes("-webkit-text-fill")
            ) {
              rules.push({ selector: rule.selectorText?.substring(0, 100), cssText: text.substring(0, 500) })
            }
          }
        }
      } catch (e) {
        // cross-origin sheet, skip
      }
    }
    return rules.slice(0, 60)
  })

  // ─── Extract hero section background ─────────────────────────────────
  const sectionStyles = await page.evaluate(() => {
    // Look for the main hero/banner section
    const sections = document.querySelectorAll("section, [class*='hero'], [class*='banner'], [class*='header'], main > div")
    const out = []
    sections.forEach((s) => {
      const cs = window.getComputedStyle(s)
      if (cs.backgroundImage !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
        out.push({
          tag: s.tagName.toLowerCase(),
          classes: s.className?.toString?.()?.substring(0, 200),
          backgroundColor: cs.backgroundColor,
          backgroundImage: cs.backgroundImage.substring(0, 400),
          backgroundSize: cs.backgroundSize,
          backgroundPosition: cs.backgroundPosition,
        })
      }
    })
    return out.slice(0, 15)
  })

  // ─── Get SVG/canvas background elements ──────────────────────────────
  const svgBgs = await page.evaluate(() => {
    const svgs = document.querySelectorAll("svg")
    const out = []
    svgs.forEach((svg) => {
      const cs = window.getComputedStyle(svg)
      const parent = svg.parentElement
      const pcs = parent ? window.getComputedStyle(parent) : null
      out.push({
        classes: svg.className?.toString?.()?.substring(0, 150),
        viewBox: svg.getAttribute("viewBox"),
        width: cs.width,
        height: cs.height,
        position: cs.position,
        innerHTML: svg.innerHTML.substring(0, 500),
        parentClasses: parent?.className?.toString?.()?.substring(0, 100),
        parentBg: pcs?.backgroundImage?.substring(0, 200),
      })
    })
    return out.slice(0, 10)
  })

  // ─── Scroll and capture more sections ────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await shot(page, "02-hero-top")

  // Zoom into hero heading area
  await page.evaluate(() => {
    const h1 = document.querySelector("h1")
    if (h1) h1.scrollIntoView({ behavior: "smooth", block: "center" })
  })
  await page.waitForTimeout(800)
  await shot(page, "03-hero-heading")

  // ─── Write results ────────────────────────────────────────────────────
  const report = {
    headings: headingStyles,
    gradients: heroStyles.gradients,
    animatedText: heroStyles.animatedText,
    patterns: heroStyles.patterns,
    keyframes,
    sections: sectionStyles,
    svgBackgrounds: svgBgs,
  }

  const outFile = join(OUT_DIR, "styles-report.json")
  writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(`\n✅ Styles report saved to: ${outFile}`)
  console.log(`   Screenshots saved to: ${OUT_DIR}`)

  // ─── Print key findings to console ───────────────────────────────────
  console.log("\n─── HEADINGS ───────────────────────────────────────")
  headingStyles.forEach((h, i) => {
    console.log(`\n[H${i + 1}] "${h.text?.substring(0, 60)}"`)
    console.log(`  color: ${h.color}`)
    console.log(`  backgroundImage: ${h.backgroundImage?.substring(0, 100)}`)
    console.log(`  webkitTextFillColor: ${h.webkitTextFillColor}`)
    console.log(`  webkitBackgroundClip: ${h.webkitBackgroundClip}`)
    console.log(`  animation: ${h.animation?.substring(0, 80)}`)
    console.log(`  filter: ${h.filter}`)
    if (h.spans?.length) {
      h.spans.forEach((s) => {
        console.log(`  [span] "${s.text?.substring(0, 50)}"`)
        console.log(`    color: ${s.color}`)
        console.log(`    bg: ${s.backgroundImage?.substring(0, 100)}`)
        console.log(`    webkitTextFillColor: ${s.webkitTextFillColor}`)
        console.log(`    webkitBackgroundClip: ${s.webkitBackgroundClip}`)
        console.log(`    animation: ${s.animation?.substring(0, 80)}`)
        console.log(`    filter: ${s.filter}`)
      })
    }
  })

  console.log("\n─── KEYFRAME ANIMATIONS ────────────────────────────")
  keyframes.filter(k => k.name).forEach((k) => {
    console.log(`\n@keyframes ${k.name}`)
    console.log(k.cssText.substring(0, 400))
  })

  console.log("\n─── GRADIENT BACKGROUNDS (top 10) ─────────────────")
  heroStyles.gradients.slice(0, 10).forEach((g) => {
    console.log(`\n[${g.tag}] "${g.text?.substring(0, 40)}"`)
    console.log(`  bg: ${g.backgroundImage?.substring(0, 150)}`)
  })

  await browser.close()
})()
