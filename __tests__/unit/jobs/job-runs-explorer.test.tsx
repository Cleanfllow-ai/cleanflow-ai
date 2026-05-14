/**
 * Unit tests for JobRunsExplorer component
 * Covers: run list render, error_code compact badge, status filter, empty states
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

jest.mock("@/modules/auth", () => ({
    useAuth: () => ({ idToken: "tok", user: { email: "u@x.com" } }),
}))

jest.mock("@/modules/files/api/file-management-api", () => ({
    fileManagementAPI: {
        getFileStatus: jest.fn().mockResolvedValue({ dq_score: 95, status: "DQ_FIXED", rows_clean: 100, rows_quarantined: 0 }),
        getFileVersions: jest.fn().mockResolvedValue({ versions: [], count: 0 }),
    },
}))

// Stub detail modal & file viewer — they have their own test suites
jest.mock("@/modules/jobs/components/job-run-detail-modal", () => ({
    JobRunDetailModal: ({ open }: { open: boolean }) =>
        open ? <div data-testid="detail-modal-open" /> : null,
}))
jest.mock("@/modules/jobs/components/job-run-file-viewer", () => ({
    JobRunFileViewer: () => null,
}))

import type { JobRun } from "@/modules/jobs/types/jobs.types"
import { jobsAPI } from "@/modules/jobs/api/jobs-api"
import { JobRunsExplorer } from "@/modules/jobs/components/job-runs-explorer"

jest.mock("@/modules/jobs/api/jobs-api", () => {
    const original = jest.requireActual("@/modules/jobs/api/jobs-api")
    return {
        ...original,
        jobsAPI: {
            getJobRuns: jest.fn(),
            triggerJob: jest.fn(),
        },
    }
})

const mockGetJobRuns = jobsAPI.getJobRuns as jest.Mock

function mkRun(overrides: Partial<JobRun> = {}): JobRun {
    return {
        run_id: "run-" + Math.random().toString(36).slice(2),
        status: "SUCCESS",
        started_at: "2026-05-14T09:00:00Z",
        duration_ms: 5000,
        total_imported: 100,
        total_exported: 100,
        total_quarantined: 0,
        entity_results: {},
        pipeline_logs: [],
        ...overrides,
    }
}

beforeEach(() => {
    jest.clearAllMocks()
})

describe("JobRunsExplorer", () => {
    it("renders 'No runs yet' when API returns empty list", async () => {
        mockGetJobRuns.mockResolvedValueOnce({ runs: [] })
        render(<JobRunsExplorer jobId="j-1" />)
        await waitFor(() => expect(screen.getByText(/No runs yet/i)).toBeInTheDocument())
    })

    it("renders run rows with status badge and started timestamp", async () => {
        mockGetJobRuns.mockResolvedValueOnce({
            runs: [mkRun({ run_id: "r-abc", status: "SUCCESS", started_at: "2026-05-14T09:00:00Z" })],
        })
        render(<JobRunsExplorer jobId="j-1" />)
        await waitFor(() => expect(screen.getByText("SUCCESS")).toBeInTheDocument())
        // Timestamp should appear
        expect(screen.getByText(/May 14/i)).toBeInTheDocument()
    })

    it("renders compact error code badge when run has error_code (CC12 pattern)", async () => {
        mockGetJobRuns.mockResolvedValueOnce({
            runs: [mkRun({ status: "FAILED", error_code: "JOB_RETRIES_EXHAUSTED" })],
        })
        render(<JobRunsExplorer jobId="j-1" />)
        await waitFor(() => {
            // compact JobErrorBanner shows the error code token in text
            expect(screen.getByText(/RETRIES EXHAUSTED/i)).toBeInTheDocument()
        })
    })

    it("shows error badge for JOB_CRON_INVALID code", async () => {
        mockGetJobRuns.mockResolvedValueOnce({
            runs: [mkRun({ status: "FAILED", error_code: "JOB_CRON_INVALID" })],
        })
        render(<JobRunsExplorer jobId="j-1" />)
        await waitFor(() => {
            expect(screen.getByText(/CRON INVALID/i)).toBeInTheDocument()
        })
    })

    it("search filter narrows visible runs by status text", async () => {
        mockGetJobRuns.mockResolvedValueOnce({
            runs: [
                mkRun({ run_id: "r1", status: "SUCCESS" }),
                mkRun({ run_id: "r2", status: "FAILED" }),
            ],
        })
        render(<JobRunsExplorer jobId="j-1" />)
        await waitFor(() => expect(screen.getByText("SUCCESS")).toBeInTheDocument())

        // Type "failed" in the search box — run_id / status both searched
        const searchBox = screen.getByPlaceholderText(/Search runs/i)
        fireEvent.change(searchBox, { target: { value: "failed" } })

        await waitFor(() => {
            expect(screen.getByText("FAILED")).toBeInTheDocument()
            expect(screen.queryByText("SUCCESS")).not.toBeInTheDocument()
        })
    })

    it("shows run count in header", async () => {
        mockGetJobRuns.mockResolvedValueOnce({
            runs: [mkRun(), mkRun(), mkRun()],
        })
        render(<JobRunsExplorer jobId="j-1" />)
        await waitFor(() => expect(screen.getByText(/3 runs/i)).toBeInTheDocument())
    })

    it("opens detail modal when a run row is clicked", async () => {
        mockGetJobRuns.mockResolvedValueOnce({
            runs: [mkRun({ run_id: "r-click", status: "SUCCESS" })],
        })
        render(<JobRunsExplorer jobId="j-1" />)
        await waitFor(() => expect(screen.getByText("SUCCESS")).toBeInTheDocument())
        // Click the row itself to open the detail modal
        fireEvent.click(screen.getByText("SUCCESS"))
        await waitFor(() => expect(screen.getByTestId("detail-modal-open")).toBeInTheDocument())
    })
})
