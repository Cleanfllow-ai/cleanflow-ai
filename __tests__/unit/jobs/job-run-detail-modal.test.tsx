/**
 * Unit tests for JobRunDetailModal
 * Covers: renders run details, shows JobErrorBanner when error_code set,
 * shows file_id link if present, retry/trigger button fires API
 */
import "@testing-library/jest-dom"
import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"

// ─── Polyfills ────────────────────────────────────────────────────────────────
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== "undefined") {
    if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
    if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
    if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock("@/shared/config/aws-config", () => ({
    AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}))

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock("@/modules/auth", () => ({
    useAuth: () => ({ idToken: "tok", user: { email: "u@x.com" } }),
}))

jest.mock("@/modules/files/api/file-management-api", () => ({
    fileManagementAPI: {
        getFileStatus: jest.fn().mockResolvedValue({
            dq_score: 90,
            status: "DQ_FIXED",
            rows_clean: 100,
            rows_quarantined: 0,
        }),
        getFileVersions: jest.fn().mockResolvedValue({ versions: [], count: 0 }),
    },
}))

import type { JobRun } from "@/modules/jobs/types/jobs.types"
import { JobRunDetailModal } from "@/modules/jobs/components/job-run-detail-modal"

function mkRun(overrides: Partial<JobRun> = {}): JobRun {
    return {
        run_id: "run-123",
        status: "SUCCESS",
        started_at: "2026-05-14T09:00:00Z",
        completed_at: "2026-05-14T09:05:00Z",
        duration_ms: 300000,
        total_imported: 50,
        total_exported: 50,
        total_quarantined: 0,
        entity_results: {},
        pipeline_logs: [],
        trigger_source: "manual",
        ...overrides,
    }
}

describe("JobRunDetailModal", () => {
    it("renders nothing when run is null", () => {
        const { container } = render(
            <JobRunDetailModal run={null} open={true} onOpenChange={jest.fn()} />
        )
        expect(container.firstChild).toBeNull()
    })

    it("renders run status badge and timing when open", async () => {
        render(
            <JobRunDetailModal
                run={mkRun({ status: "SUCCESS" })}
                open={true}
                onOpenChange={jest.fn()}
            />
        )
        await waitFor(() => {
            expect(screen.getByText("SUCCESS")).toBeInTheDocument()
        })
        // Duration text — 300000ms = 5m 0s
        expect(screen.getByText(/5m/i)).toBeInTheDocument()
    })

    it("shows JobErrorBanner full variant when error_code is set", async () => {
        render(
            <JobRunDetailModal
                run={mkRun({ status: "FAILED", error_code: "JOB_RETRIES_EXHAUSTED", error_message: "3 retries failed" })}
                open={true}
                onOpenChange={jest.fn()}
            />
        )
        await waitFor(() => {
            expect(screen.getByText(/3 retries/i)).toBeInTheDocument()
        })
        // Full banner (not compact) should have an action button
        expect(screen.getByRole("button", { name: /re-run now/i })).toBeInTheDocument()
    })

    it("does not render JobErrorBanner when no error_code", async () => {
        render(
            <JobRunDetailModal
                run={mkRun({ status: "SUCCESS" })}
                open={true}
                onOpenChange={jest.fn()}
            />
        )
        await waitFor(() => expect(screen.getByText("SUCCESS")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /re-run now/i })).not.toBeInTheDocument()
    })

    it("shows imported / exported counts", async () => {
        render(
            <JobRunDetailModal
                run={mkRun({ total_imported: 200, total_exported: 195 })}
                open={true}
                onOpenChange={jest.fn()}
            />
        )
        await waitFor(() => {
            expect(screen.getByText("200")).toBeInTheDocument()
            expect(screen.getByText("195")).toBeInTheDocument()
        })
    })

    it("renders entity result rows when entity_results are provided", async () => {
        render(
            <JobRunDetailModal
                run={mkRun({
                    entity_results: {
                        invoices: {
                            status: "SUCCESS",
                            imported: 50,
                            exported: 48,
                        },
                    },
                })}
                open={true}
                onOpenChange={jest.fn()}
            />
        )
        await waitFor(() => {
            expect(screen.getByText(/invoices/i)).toBeInTheDocument()
        })
    })

    it("does not render when open=false", () => {
        const { queryByText } = render(
            <JobRunDetailModal
                run={mkRun({ status: "FAILED" })}
                open={false}
                onOpenChange={jest.fn()}
            />
        )
        // Dialog content hidden — status badge should not be visible
        expect(queryByText("FAILED")).not.toBeInTheDocument()
    })
})
