/**
 * Unit tests for RejectionReasonBadge (CC2 CSV edge-case rejection reasons).
 *
 * Covers:
 *   1. REJECTED file with reason → reason text appears
 *   2. REJECTED file without reason (legacy data) → "Validation failed" fallback
 *   3. User-friendly hint mapping — known prefixes map to correct hints
 *   4. Unknown reason → no hint, raw reason shown as-is
 *   5. Reason > 200 chars → truncated display, tooltip wraps full text
 */
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import {
  RejectionReasonBadge,
  getRejectionHint,
} from "@/modules/files/components/rejection-reason-badge"
import { TooltipProvider } from "@/components/ui/tooltip"

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// ── getRejectionHint unit tests ──────────────────────────────────────────────

describe("getRejectionHint", () => {
  it("returns hint for 'Empty file' prefix", () => {
    expect(getRejectionHint("Empty file — 0 bytes")).toBe(
      "Your file appears to be empty."
    )
  })

  it("returns hint for 'File has headers but no data rows' prefix", () => {
    expect(
      getRejectionHint("File has headers but no data rows — only 1 row")
    ).toBe("Add at least one data row below your headers.")
  })

  it("returns hint for 'UTF-16 encoding not supported' prefix", () => {
    expect(getRejectionHint("UTF-16 encoding not supported (BOM detected)")).toBe(
      "Save your CSV as UTF-8 (Excel: Save As → CSV UTF-8)."
    )
  })

  it("returns hint for 'Malformed UTF-8' prefix", () => {
    expect(getRejectionHint("Malformed UTF-8 at byte 12847")).toBe(
      "File encoding issue — save as UTF-8 in your editor."
    )
  })

  it("returns hint for 'Unclosed quote' prefix", () => {
    const hint = getRejectionHint("Unclosed quote at line 47, column 3")
    expect(hint).not.toBeNull()
    expect(hint).toMatch(/quote character.*paired/i)
  })

  it("returns hint for 'Could not detect encoding' prefix", () => {
    expect(getRejectionHint("Could not detect encoding after 3 probes")).toBe(
      "Save your file as UTF-8 (most editors offer this option)."
    )
  })

  it("returns null for an unknown reason", () => {
    expect(getRejectionHint("Unexpected column count mismatch on row 5")).toBeNull()
  })

  it("is case-insensitive for prefix matching", () => {
    expect(getRejectionHint("MALFORMED UTF-8 found")).toBe(
      "File encoding issue — save as UTF-8 in your editor."
    )
  })
})

// ── RejectionReasonBadge render tests ───────────────────────────────────────

describe("RejectionReasonBadge", () => {
  it("shows the failure reason when provided", () => {
    renderWithProvider(
      <RejectionReasonBadge failureReason="Unclosed quote at line 47" />
    )
    expect(screen.getByTestId("rejection-reason-text")).toHaveTextContent(
      "Unclosed quote at line 47"
    )
  })

  it("shows a user-friendly hint for known reason patterns", () => {
    renderWithProvider(
      <RejectionReasonBadge failureReason="Unclosed quote at line 47" />
    )
    const hint = screen.getByTestId("rejection-reason-hint")
    expect(hint).toBeInTheDocument()
    expect(hint.textContent).toMatch(/quote character.*paired/i)
  })

  it("shows generic fallback when failure_reason is absent (legacy data)", () => {
    renderWithProvider(<RejectionReasonBadge failureReason={undefined} />)
    expect(screen.getByTestId("rejection-reason-text")).toHaveTextContent(
      "Validation failed"
    )
    expect(screen.queryByTestId("rejection-reason-hint")).not.toBeInTheDocument()
  })

  it("shows generic fallback when failure_reason is null", () => {
    renderWithProvider(<RejectionReasonBadge failureReason={null} />)
    expect(screen.getByTestId("rejection-reason-text")).toHaveTextContent(
      "Validation failed"
    )
  })

  it("shows generic fallback when failure_reason is empty/whitespace", () => {
    renderWithProvider(<RejectionReasonBadge failureReason="   " />)
    expect(screen.getByTestId("rejection-reason-text")).toHaveTextContent(
      "Validation failed"
    )
  })

  it("does not show a hint for unknown reason patterns", () => {
    renderWithProvider(
      <RejectionReasonBadge failureReason="Unexpected column count mismatch" />
    )
    expect(screen.getByTestId("rejection-reason-text")).toHaveTextContent(
      "Unexpected column count mismatch"
    )
    expect(screen.queryByTestId("rejection-reason-hint")).not.toBeInTheDocument()
  })

  it("truncates reason longer than 200 chars in display text", () => {
    const longReason = "Malformed UTF-8 " + "x".repeat(210)
    renderWithProvider(<RejectionReasonBadge failureReason={longReason} />)
    const text = screen.getByTestId("rejection-reason-text").textContent ?? ""
    expect(text.length).toBeLessThanOrEqual(204) // 200 chars + "…" + possible padding
    expect(text).toMatch(/…$/)
  })
})
