/**
 * Permission-gating tests for JobsList — commit
 * "fix(fe/jobs): gate New Job + per-row mutating actions on Data Steward+ role".
 *
 * Members should NOT see Create, Run Now, Edit, Pause/Resume, or Delete.
 * Data Stewards / Admins / Super Admins should see them.
 */

import "@testing-library/jest-dom"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"

// ─── Polyfills ────────────────────────────────────────────────────────────────
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock("@/shared/config/aws-config", () => ({
    AWS_CONFIG: {
        API_BASE_URL: "https://api.test.com",
        COGNITO: { USER_POOL_ID: "test", CLIENT_ID: "test", REGION: "ap-south-1" },
    },
}))

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock("@/shared/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}))

// ─── useAuth role injection ───────────────────────────────────────────────────
let mockUserRole: string = "Member"

jest.mock("@/modules/auth/providers/auth-provider", () => ({
    useAuth: () => ({
        user: { email: "u@x.com" },
        userRole: mockUserRole,
        permissionsLoaded: true,
        isLoading: false,
        hasPermission: () => true,
    }),
}))

jest.mock("@/modules/auth", () => ({
    useAuth: () => ({ idToken: "tok", user: { email: "u@x.com" } }),
}))

// Stub heavy children
jest.mock("@/modules/jobs/components/job-dialog", () => ({ JobDialog: () => null }))
jest.mock("@/modules/jobs/components/job-runs-explorer", () => ({
    JobRunsExplorer: () => <div data-testid="runs-explorer" />,
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
        job_id: "j-1",
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
    mockListJobs.mockResolvedValue({ jobs: [mkJob()] })
})

describe("JobsList permission gating", () => {
    it("hides 'New Job' button when role is Member", async () => {
        mockUserRole = "Member"
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText("Test Job")).toBeInTheDocument())
        // Member should NOT see the New Job CTA in the header.
        expect(screen.queryByRole("button", { name: /New Job/i })).toBeNull()
    })

    it("shows 'New Job' button when role is Data Steward", async () => {
        mockUserRole = "Data Steward"
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText("Test Job")).toBeInTheDocument())
        expect(screen.getByRole("button", { name: /New Job/i })).toBeInTheDocument()
    })

    it("shows 'New Job' button when role is Super Admin", async () => {
        mockUserRole = "Super Admin"
        render(<JobsList />)
        await waitFor(() => expect(screen.getByText("Test Job")).toBeInTheDocument())
        expect(screen.getByRole("button", { name: /New Job/i })).toBeInTheDocument()
    })
})
