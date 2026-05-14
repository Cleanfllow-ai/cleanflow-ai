/** AA4 Phase 1 — CustomerUsageDashboard rendering tests (4 states). */
import { act, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { DashboardSummaryResponse } from "@/modules/dashboard/types/dashboard-summary.types"

jest.mock("@/modules/auth", () => ({ useAuth: () => ({ idToken: "test-token" }) }))
jest.mock("recharts", () => ({
    ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-mock">{children}</div>,
    LineChart: ({ children }: any) => <div>{children}</div>,
    Line: () => null, XAxis: () => null, YAxis: () => null,
    Tooltip: () => null, CartesianGrid: () => null,
}))
const mockGetSummary = jest.fn()
jest.mock("@/modules/dashboard/api/dashboard-api", () => ({
    dashboardAPI: { getSummary: (t: string) => mockGetSummary(t) },
}))

import { CustomerUsageDashboard } from "@/modules/dashboard"
import { _clearDashboardSummaryCache } from "@/modules/dashboard/hooks/use-dashboard-summary"

const flush = async () => {
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

beforeEach(() => { mockGetSummary.mockReset(); _clearDashboardSummaryCache() })

const fullPayload: DashboardSummaryResponse = {
    topbar: {
        rows_processed_mtd: 12_345, files_completed_mtd: 7,
        last_file: { upload_id: "u-last", original_filename: "october-invoices.csv", status: "DQ_FIXED" },
    },
    recent_files: [
        { upload_id: "u1", original_filename: "a.csv", status: "DQ_FIXED", dq_score: 92, total_size: 2048 },
        { upload_id: "u2", original_filename: "b.csv", status: "DQ_FIXED", dq_score: 88, total_size: 5120 },
    ],
    dq_score_trend: [
        { date: "2026-05-12", avg_dq_score: 88, file_count: 1 },
        { date: "2026-05-13", avg_dq_score: 92, file_count: 1 },
    ],
    recent_augmentations: [
        { job_id: "j-1", prompt_template_id: "rightrev-A", status: "SUCCEEDED", cost_actual_usd: 0.42 },
    ],
}

describe("CustomerUsageDashboard", () => {
    it("renders topbar metrics + all 3 tiles when data loads", async () => {
        mockGetSummary.mockResolvedValueOnce(fullPayload)
        render(<CustomerUsageDashboard />); await flush()

        expect(screen.getByTestId("dashboard-topbar")).toBeInTheDocument()
        expect(screen.getByText("12,345")).toBeInTheDocument()
        expect(screen.getByText("october-invoices.csv")).toBeInTheDocument()
        expect(screen.getByTestId("recent-files-tile")).toBeInTheDocument()
        expect(screen.getByTestId("dq-trend-tile")).toBeInTheDocument()
        expect(screen.getByTestId("recent-augmentations-tile")).toBeInTheDocument()
        expect(screen.getByText("a.csv")).toBeInTheDocument()
        expect(screen.getByText("rightrev-A")).toBeInTheDocument()
        expect(screen.queryByTestId("recent-files-empty")).not.toBeInTheDocument()
    })

    it("renders empty-state CTAs for each tile when payload is empty", async () => {
        mockGetSummary.mockResolvedValueOnce({
            topbar: { rows_processed_mtd: 0, files_completed_mtd: 0, last_file: null },
            recent_files: [], dq_score_trend: [], recent_augmentations: [],
        } satisfies DashboardSummaryResponse)
        render(<CustomerUsageDashboard />); await flush()

        expect(screen.getByTestId("recent-files-empty")).toBeInTheDocument()
        expect(screen.getByText(/Upload your first file/i)).toBeInTheDocument()
        expect(screen.getByTestId("dq-trend-empty")).toBeInTheDocument()
        expect(screen.getByText(/No DQ runs in the last 30 days/i)).toBeInTheDocument()
        expect(screen.getByTestId("recent-augmentations-empty")).toBeInTheDocument()
        expect(screen.getByText(/Scenario A/i)).toBeInTheDocument()
        expect(screen.getByText(/Scenario B/i)).toBeInTheDocument()
        expect(screen.getByText(/Scenario C/i)).toBeInTheDocument()
    })

    it("renders a skeleton while the summary request is in flight", () => {
        mockGetSummary.mockImplementationOnce(() => new Promise(() => undefined))
        render(<CustomerUsageDashboard />)
        const skel = screen.getByTestId("dashboard-loading")
        expect(skel).toBeInTheDocument()
        expect(skel).toHaveAttribute("aria-busy", "true")
        expect(screen.queryByTestId("recent-files-tile")).not.toBeInTheDocument()
    })

    it("renders an error banner when the API call rejects", async () => {
        mockGetSummary.mockRejectedValueOnce(new Error("Network down"))
        render(<CustomerUsageDashboard />); await flush()
        const err = screen.getByTestId("dashboard-error")
        expect(err).toHaveAttribute("role", "alert")
        expect(screen.getByText(/Failed to load dashboard/i)).toBeInTheDocument()
        expect(screen.getByText(/Network down/i)).toBeInTheDocument()
        expect(screen.queryByTestId("recent-files-tile")).not.toBeInTheDocument()
    })
})
