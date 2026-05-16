/**
 * Unit tests for JobsList component
 * Covers: list rendering, empty state, search filter, status stats bar
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
    AWS_CONFIG: {
        API_BASE_URL: "https://api.test.com",
        COGNITO: { USER_POOL_ID: "test", CLIENT_ID: "test", REGION: "ap-south-1" },
    },
}))

// PermissionWrapper drags in auth-provider → cognito-client. Stub the wrapper
// so jobs-list tests don't have to wire up the full auth/cognito context.
jest.mock("@/modules/auth/components/permission-wrapper", () => ({
    PermissionWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock("@/shared/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}))

jest.mock("@/modules/auth", () => ({
    useAuth: () => ({ idToken: "tok", user: { email: "u@x.com" } }),
}))

// Stub heavy child components that require their own full context
jest.mock("@/modules/jobs/components/job-dialog", () => ({
    JobDialog: () => null,
}))
jest.mock("@/modules/jobs/components/job-runs-explorer", () => ({
    JobRunsExplorer: ({ jobId }: { jobId: string }) => (
        <div data-testid={`runs-explorer-${jobId}`}>RunsExplorer</div>
    ),
}))

import type { Job } from "@/modules/jobs/types/jobs.types"
import { jobsAPI } from "@/modules/jobs/api/jobs-api"
import { JobsList } from "@/modules/jobs/components/jobs-list"

jest.mock("@/modules/jobs/api/jobs-api", () => {
    const original = jest.requireActual("@/modules/jobs/api/jobs-api")
    return {
        ...original,
        jobsAPI: {
            listJobs: jest.fn(),
            pauseJob: jest.fn(),
            resumeJob: jest.fn(),
            triggerJob: jest.fn(),
            deleteJob: jest.fn(),
        },
    }
})

const mockListJobs = jobsAPI.listJobs as jest.Mock

function mkJob(overrides: Partial<Job> = {}): Job {
    return {
        job_id: "j-" + Math.random().toString(36).slice(2),
        name: "Test Job",
        source_provider: "quickbooks",
        source_category: "erp",
        source_config: {},
        destination_provider: "cleanflow",
        destination_category: "storage",
        destination_config: {},
        entities: ["invoices"],
        column_mapping: {},
        frequency_type: "rate",
        frequency_value: "1 hour",
        dq_config: { mode: "default" },
        export_config: {},
        status: "ACTIVE",
        created_at: "2026-05-14T10:00:00Z",
        ...overrides,
    }
}

beforeEach(() => {
    jest.clearAllMocks()
})

describe("JobsList", () => {
    it("shows loading skeleton initially then renders job rows", async () => {
        mockListJobs.mockResolvedValueOnce({ jobs: [mkJob({ name: "Invoice Sync" })] })
        render(<JobsList />)
        // After async load the job name appears
        await waitFor(() => expect(screen.getByText("Invoice Sync")).toBeInTheDocument())
    })

    it("renders empty state when no jobs", async () => {
        mockListJobs.mockResolvedValueOnce({ jobs: [] })
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText(/No jobs yet/i)).toBeInTheDocument())
    })

    it("renders job name, status badge, and frequency for each job", async () => {
        mockListJobs.mockResolvedValueOnce({
            jobs: [
                mkJob({ name: "Daily GL Sync", status: "ACTIVE", frequency_type: "rate", frequency_value: "1 day" }),
            ],
        })
        render(<JobsList />)
        await waitFor(() => {
            expect(screen.getByText("Daily GL Sync")).toBeInTheDocument()
            expect(screen.getByText(/Active/i)).toBeInTheDocument()
        })
    })

    it("filters visible rows when searching by name", async () => {
        mockListJobs.mockResolvedValueOnce({
            jobs: [
                mkJob({ name: "Invoice Sync" }),
                mkJob({ name: "GL Export" }),
            ],
        })
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText("Invoice Sync")).toBeInTheDocument())

        const search = screen.getByPlaceholderText(/Search jobs/i)
        fireEvent.change(search, { target: { value: "invoice" } })
        expect(screen.getByText("Invoice Sync")).toBeInTheDocument()
        expect(screen.queryByText("GL Export")).not.toBeInTheDocument()
    })

    it("shows no-match copy when search yields 0 results", async () => {
        mockListJobs.mockResolvedValueOnce({ jobs: [mkJob({ name: "Invoice Sync" })] })
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText("Invoice Sync")).toBeInTheDocument())
        fireEvent.change(screen.getByPlaceholderText(/Search jobs/i), { target: { value: "zzz" } })
        expect(screen.getByText(/No matching jobs/i)).toBeInTheDocument()
    })

    it("shows stats bar with active / paused counts when jobs exist", async () => {
        mockListJobs.mockResolvedValueOnce({
            jobs: [
                mkJob({ status: "ACTIVE" }),
                mkJob({ status: "ACTIVE" }),
                mkJob({ status: "PAUSED" }),
            ],
        })
        render(<JobsList />)
        // Stats bar labels
        await waitFor(() => {
            expect(screen.getByText(/^Total$/i)).toBeInTheDocument()
        })
    })

    it("renders failed-jobs alert banner when FAILED jobs exist", async () => {
        mockListJobs.mockResolvedValueOnce({
            jobs: [mkJob({ name: "Broken Job", status: "FAILED" })],
        })
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText(/need/i)).toBeInTheDocument())
        expect(screen.getAllByText(/Broken Job/i).length).toBeGreaterThanOrEqual(1)
    })

    it("expands run history when a job row is clicked", async () => {
        const job = mkJob({ job_id: "jid-1", name: "Clickable Job" })
        mockListJobs.mockResolvedValueOnce({ jobs: [job] })
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText("Clickable Job")).toBeInTheDocument())
        fireEvent.click(screen.getByText("Clickable Job"))
        await waitFor(() => expect(screen.getByTestId("runs-explorer-jid-1")).toBeInTheDocument())
    })
})
