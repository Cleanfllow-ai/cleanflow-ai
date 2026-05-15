/**
 * welcome-tour-copy — content contract tests
 *
 * Asserts:
 *   1. Every step's body copy is ≤ 2 sentences.
 *   2. Every non-modal step's body uses "you" / "your" framing.
 *   3. The final ("done") step copy object is marked isModal = true.
 *   4. TOUR_STEPS length matches STEP_COPY keys (no orphaned steps).
 *   5. The final step is "done" (ensures router.push CTA is rendered last).
 */

import { STEP_COPY, TOUR_STEPS, type StepKey } from "@/modules/onboarding/components/welcome-tour"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count sentences in a string.
 * A sentence ends with `.`, `!`, or `?` (followed by space or end-of-string).
 * Handles abbreviations crudely — good enough for copy linting.
 */
function countSentences(text: string): number {
  // Split on '. ', '! ', '? ' or end-of-string after sentence-terminal punctuation
  const matches = text.match(/[^.!?]*[.!?](?:\s|$)/g)
  return matches ? matches.length : 1
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WelcomeTour step copy", () => {
  const stepKeys = Object.keys(STEP_COPY) as StepKey[]

  it("has copy defined for every key", () => {
    expect(stepKeys.length).toBeGreaterThan(0)
    stepKeys.forEach((key) => {
      expect(STEP_COPY[key]).toBeDefined()
      expect(STEP_COPY[key].title).toBeTruthy()
      expect(STEP_COPY[key].body).toBeTruthy()
    })
  })

  it("each step body is ≤ 2 sentences", () => {
    stepKeys.forEach((key) => {
      const sentences = countSentences(STEP_COPY[key].body)
      expect(sentences).toBeLessThanOrEqual(2)
    })
  })

  it("non-modal steps use 'you' or 'your' framing", () => {
    const nonModalKeys = stepKeys.filter((k) => !STEP_COPY[k].isModal)
    nonModalKeys.forEach((key) => {
      const body = STEP_COPY[key].body.toLowerCase()
      const hasYouFraming = body.includes("you") || body.includes("your")
      expect(hasYouFraming).toBe(true)
    })
  })

  it("the 'done' step is marked isModal", () => {
    expect(STEP_COPY["done"].isModal).toBe(true)
  })

  it("the 'welcome' step is marked isModal", () => {
    expect(STEP_COPY["welcome"].isModal).toBe(true)
  })

  it("TOUR_STEPS count matches STEP_COPY entry count", () => {
    expect(TOUR_STEPS.length).toBe(stepKeys.length)
  })

  it("the last TOUR_STEPS entry has content 'done' (CTA step)", () => {
    const lastStep = TOUR_STEPS[TOUR_STEPS.length - 1]
    expect(lastStep.content).toBe("done")
  })

  it("the first TOUR_STEPS entry has content 'welcome'", () => {
    const firstStep = TOUR_STEPS[0]
    expect(firstStep.content).toBe("welcome")
  })
})
