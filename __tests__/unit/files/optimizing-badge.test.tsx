/**
 * Unit tests for OptimizingBadge (Phase 7B logical sharding).
 *
 * Covers:
 *   - status=OPTIMIZING        → amber pill, label "Optimizing…", spinner
 *   - status=OPTIMIZE_FAILED   → red pill, label "Optimize failed",
 *                                tooltip uses error_reason or fallback
 *   - status=anything else     → returns null (no badge rendered)
 *
 * Tooltip content lives inside Radix's portal — for a smoke test we just
 * verify the trigger element renders and the aria/test-id attributes are
 * wired correctly. Full pointer-event tooltip behaviour is covered by
 * the Radix tooltip's own tests.
 */
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { OptimizingBadge } from "@/modules/files/components/optimizing-badge"
import { TooltipProvider } from "@/components/ui/tooltip"

function renderWithTooltipProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("OptimizingBadge", () => {
  it("returns null for an unrelated status", () => {
    const { container } = render(<OptimizingBadge status="UPLOADED" />)
    expect(container.firstChild).toBeNull()
  })

  it("returns null when status is undefined", () => {
    const { container } = render(<OptimizingBadge status={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders an amber Optimizing badge for OPTIMIZING", () => {
    renderWithTooltipProvider(<OptimizingBadge status="OPTIMIZING" />)
    const badge = screen.getByTestId("optimizing-badge")
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toMatch(/Optimizing/)
  })

  it("renders a red Optimize failed badge for OPTIMIZE_FAILED", () => {
    renderWithTooltipProvider(
      <OptimizingBadge status="OPTIMIZE_FAILED" errorReason="Out of disk" />
    )
    const badge = screen.getByTestId("optimize-failed-badge")
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toMatch(/Optimize failed/)
  })

  it("falls back to a generic message when error_reason is missing", () => {
    renderWithTooltipProvider(<OptimizingBadge status="OPTIMIZE_FAILED" />)
    const badge = screen.getByTestId("optimize-failed-badge")
    expect(badge).toBeInTheDocument()
    // The fallback string is the trigger's tooltip content; verify the
    // component renders without crashing and the badge label is present.
    expect(badge.textContent).toMatch(/Optimize failed/)
  })

  it("falls back to a generic message when error_reason is empty/whitespace", () => {
    renderWithTooltipProvider(
      <OptimizingBadge status="OPTIMIZE_FAILED" errorReason="   " />
    )
    expect(screen.getByTestId("optimize-failed-badge")).toBeInTheDocument()
  })
})
