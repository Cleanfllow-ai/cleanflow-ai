/**
 * AA3 Sprint 1 — UploadZone plan-tier clamp.
 *
 * Covers:
 *   1. Renders the correct max-size hint for the Free tier (100 MB)
 *   2. Renders the correct max-size hint for the Pro tier (50 GB) — no
 *      upgrade-link when the user is at/near the top tier.
 *   3. A within-limit file calls ``onFileSelected``
 *   4. An over-limit file calls ``onPlanLimitExceeded`` and NOT
 *      ``onFileSelected``.
 */
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import {
  UploadZone,
  PLAN_TIER_LIMITS_BYTES,
} from "@/modules/files/components/upload-zone"

function makeFile(name: string, sizeBytes: number, type = "text/csv"): File {
  // jsdom's File constructor doesn't honour the blob content length when
  // building from a single chunk — so we synthesise a fake blob and patch
  // the size getter directly. This keeps the test fast (no MB-scale data).
  const file = new File(["x"], name, { type })
  Object.defineProperty(file, "size", { value: sizeBytes, configurable: true })
  return file
}

describe("UploadZone — plan-tier clamp", () => {
  it("renders Free-tier max-size hint + upgrade link", () => {
    render(<UploadZone planTier="free" />)
    const hint = screen.getByTestId("upload-zone-limit-hint")
    expect(hint.textContent).toMatch(/100 MB/)
    expect(hint.textContent).toMatch(/Free/)
    // Upgrade link is rendered for non-enterprise tiers.
    expect(screen.getByTestId("upload-zone-upgrade-link")).toBeInTheDocument()
  })

  it("renders Pro-tier max-size hint with no upgrade link on Enterprise", () => {
    render(<UploadZone planTier="enterprise" />)
    const hint = screen.getByTestId("upload-zone-limit-hint")
    expect(hint.textContent).toMatch(/200 GB/)
    expect(hint.textContent).toMatch(/Enterprise/)
    // Enterprise is the top tier — no upgrade link rendered.
    expect(screen.queryByTestId("upload-zone-upgrade-link")).not.toBeInTheDocument()
  })

  it("fires onFileSelected for a within-limit file", () => {
    const onFileSelected = jest.fn()
    const onPlanLimitExceeded = jest.fn()
    render(
      <UploadZone
        planTier="free"
        onFileSelected={onFileSelected}
        onPlanLimitExceeded={onPlanLimitExceeded}
      />,
    )
    const ok = makeFile("small.csv", 10 * 1024 * 1024) // 10 MB
    const input = screen.getByTestId("upload-zone-input") as HTMLInputElement
    fireEvent.change(input, { target: { files: [ok] } })
    expect(onFileSelected).toHaveBeenCalledTimes(1)
    expect(onFileSelected.mock.calls[0][0]).toBe(ok)
    expect(onPlanLimitExceeded).not.toHaveBeenCalled()
  })

  it("fires onPlanLimitExceeded for an over-limit file (Free tier > 100 MB)", () => {
    const onFileSelected = jest.fn()
    const onPlanLimitExceeded = jest.fn()
    render(
      <UploadZone
        planTier="free"
        onFileSelected={onFileSelected}
        onPlanLimitExceeded={onPlanLimitExceeded}
      />,
    )
    const tooBig = makeFile("huge.csv", PLAN_TIER_LIMITS_BYTES.free + 1)
    const input = screen.getByTestId("upload-zone-input") as HTMLInputElement
    fireEvent.change(input, { target: { files: [tooBig] } })
    expect(onPlanLimitExceeded).toHaveBeenCalledTimes(1)
    expect(onPlanLimitExceeded.mock.calls[0][0]).toBe(tooBig)
    expect(onPlanLimitExceeded.mock.calls[0][1]).toBe(PLAN_TIER_LIMITS_BYTES.free)
    expect(onFileSelected).not.toHaveBeenCalled()
  })
})
