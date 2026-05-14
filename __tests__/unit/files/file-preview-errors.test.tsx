/**
 * Unit tests for file preview error hardening (battle-test 2026-05-14).
 *
 * Covers the 6 failure modes documented in the battle-test spec:
 *   1. UPLOADING / not-ready  → "uploading" kind, Refresh CTA
 *   2. REJECTED               → "rejected" kind, no retry CTA
 *   3. Timeout > 5s           → "timeout" kind, Retry + Open Editor CTAs
 *   4. Server error (500)     → "server_error" kind, Retry CTA
 *   5. Deleted (404)          → "not_found" kind, Refresh List CTA
 *   6. 0 data rows            → header-only empty state (no crash)
 *
 * Also covers classifyPreviewError() via the PreviewErrorState test-ids.
 */
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { FilePreviewTab } from "@/modules/files/components/file-details/file-preview-tab"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { PreviewErrorKind } from "@/modules/files/hooks/use-file-details"
import type { FilePreviewData } from "@/modules/files/types"

function renderTab(props: Partial<React.ComponentProps<typeof FilePreviewTab>>) {
  return render(
    <TooltipProvider>
      <FilePreviewTab
        previewLoading={false}
        previewError={null}
        previewData={null}
        {...props}
      />
    </TooltipProvider>
  )
}

// ── Failure mode 1: UPLOADING / not-ready ───────────────────────────────────

describe("Preview error — uploading / not ready", () => {
  it("renders uploading state with Refresh button", () => {
    const onRetry = jest.fn()
    renderTab({
      previewError: "File is still processing. Try again in a moment.",
      previewErrorKind: "uploading" as PreviewErrorKind,
      onRetry,
    })
    expect(screen.getByTestId("preview-error-uploading")).toBeInTheDocument()
    expect(screen.getByText("File Still Processing")).toBeInTheDocument()
    const btn = screen.getByTestId("preview-retry-btn")
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("does not show Open Editor button for uploading state", () => {
    const onOpenEditor = jest.fn()
    renderTab({
      previewError: "File is still processing. Try again in a moment.",
      previewErrorKind: "uploading" as PreviewErrorKind,
      onOpenEditor,
    })
    expect(screen.queryByTestId("preview-open-editor-btn")).not.toBeInTheDocument()
  })
})

// ── Failure mode 2: REJECTED ────────────────────────────────────────────────

describe("Preview error — rejected", () => {
  it("renders rejected state without retry CTA", () => {
    const onRetry = jest.fn()
    renderTab({
      previewError: "This file was rejected during validation.",
      previewErrorKind: "rejected" as PreviewErrorKind,
      onRetry,
    })
    expect(screen.getByTestId("preview-error-rejected")).toBeInTheDocument()
    expect(screen.getByText("File Rejected")).toBeInTheDocument()
    // Rejected files cannot be retried — no retry button
    expect(screen.queryByTestId("preview-retry-btn")).not.toBeInTheDocument()
  })
})

// ── Failure mode 3: Timeout ─────────────────────────────────────────────────

describe("Preview error — timeout", () => {
  it("renders timeout state with both Retry and Open Editor buttons", () => {
    const onRetry = jest.fn()
    const onOpenEditor = jest.fn()
    renderTab({
      previewError: "Preview took too long to load.",
      previewErrorKind: "timeout" as PreviewErrorKind,
      onRetry,
      onOpenEditor,
    })
    expect(screen.getByTestId("preview-error-timeout")).toBeInTheDocument()
    expect(screen.getByText("Preview Timed Out")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("preview-retry-btn"))
    expect(onRetry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId("preview-open-editor-btn"))
    expect(onOpenEditor).toHaveBeenCalledTimes(1)
  })

  it("renders timeout without Open Editor button when onOpenEditor not provided", () => {
    renderTab({
      previewError: "Preview took too long to load.",
      previewErrorKind: "timeout" as PreviewErrorKind,
    })
    expect(screen.queryByTestId("preview-open-editor-btn")).not.toBeInTheDocument()
  })
})

// ── Failure mode 4: Server error (500) ──────────────────────────────────────

describe("Preview error — server error", () => {
  it("renders server_error state with Retry button", () => {
    const onRetry = jest.fn()
    renderTab({
      previewError: "Server error generating preview.",
      previewErrorKind: "server_error" as PreviewErrorKind,
      onRetry,
    })
    expect(screen.getByTestId("preview-error-server_error")).toBeInTheDocument()
    expect(screen.getByText("Preview Failed")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("preview-retry-btn"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

// ── Failure mode 5: Deleted (404) ───────────────────────────────────────────

describe("Preview error — not found / deleted", () => {
  it("renders not_found state with Refresh List button", () => {
    const onRefreshList = jest.fn()
    renderTab({
      previewError: "This file was deleted.",
      previewErrorKind: "not_found" as PreviewErrorKind,
      onRefreshList,
    })
    expect(screen.getByTestId("preview-error-not_found")).toBeInTheDocument()
    expect(screen.getByText("File Not Found")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("preview-refresh-list-btn"))
    expect(onRefreshList).toHaveBeenCalledTimes(1)
  })

  it("does not show Retry button for not_found state", () => {
    renderTab({
      previewError: "This file was deleted.",
      previewErrorKind: "not_found" as PreviewErrorKind,
    })
    expect(screen.queryByTestId("preview-retry-btn")).not.toBeInTheDocument()
  })
})

// ── Failure mode 6: Header-only file (0 rows) ────────────────────────────────

describe("Preview — header-only file (0 data rows)", () => {
  const headerOnlyData: FilePreviewData = {
    headers: ["id", "name", "amount"],
    sample_data: [],
    total_rows: 0,
  }

  it("renders 'Headers Only' empty state instead of crashing", () => {
    renderTab({ previewData: headerOnlyData })
    expect(screen.getByTestId("preview-header-only")).toBeInTheDocument()
    expect(screen.getByText("Headers Only")).toBeInTheDocument()
    expect(screen.getByText(/only headers/i)).toBeInTheDocument()
  })

  it("does not render the data table when 0 rows", () => {
    renderTab({ previewData: headerOnlyData })
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})

// ── Generic fallback error ───────────────────────────────────────────────────

describe("Preview error — generic fallback", () => {
  it("renders generic error without CTA buttons", () => {
    renderTab({
      previewError: "Unexpected error occurred.",
      previewErrorKind: "generic" as PreviewErrorKind,
    })
    expect(screen.getByTestId("preview-error-generic")).toBeInTheDocument()
    expect(screen.getByText("Preview Unavailable")).toBeInTheDocument()
    expect(screen.queryByTestId("preview-retry-btn")).not.toBeInTheDocument()
  })
})
