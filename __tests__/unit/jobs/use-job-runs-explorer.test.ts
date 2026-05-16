/**
 * Unit tests for useJobRunsExplorer hook focusing on the silent-swallow fix
 * (commit "fix(fe/jobs): surface getJobRuns + retry failures instead of
 * silent empty") and the race-condition fix (commit "fix(fe/jobs): eliminate
 * refreshLiveSummaries N*M HTTP storm on each poll").
 */

import "@testing-library/jest-dom"
import { renderHook, act, waitFor } from "@testing-library/react"

jest.mock("@/shared/config/aws-config", () => ({
    AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}))

const toastFn = jest.fn()
jest.mock("@/shared/hooks/use-toast", () => ({
    useToast: () => ({ toast: toastFn }),
}))

jest.mock("@/modules/auth", () => ({
    useAuth: () => ({ idToken: "tok" }),
}))

const getJobRunsMock = jest.fn()
const triggerJobMock = jest.fn()
jest.mock("@/modules/jobs/api/jobs-api", () => ({
    jobsAPI: {
        getJobRuns: (...args: unknown[]) => getJobRunsMock(...args),
        triggerJob: (...args: unknown[]) => triggerJobMock(...args),
    },
}))

const getFileStatusMock = jest.fn()
const getFileVersionsMock = jest.fn()
jest.mock("@/modules/files/api/file-management-api", () => ({
    fileManagementAPI: {
        getFileStatus: (...args: unknown[]) => getFileStatusMock(...args),
        getFileVersions: (...args: unknown[]) => getFileVersionsMock(...args),
    },
}))

import { useJobRunsExplorer } from "@/modules/jobs/components/use-job-runs-explorer"

beforeEach(() => {
    jest.clearAllMocks()
    getFileStatusMock.mockResolvedValue({ status: "FIXED", dq_score: 92 })
    getFileVersionsMock.mockResolvedValue({ versions: [], count: 0 })
})

describe("useJobRunsExplorer — error surfacing", () => {
    it("surfaces fetch failures via runsError + toast (not silent empty)", async () => {
        // Persistent rejection — any visibilitychange / poll follow-up should
        // also see the same error rather than crashing on `undefined.runs`.
        getJobRunsMock.mockRejectedValue(new Error("Network broke"))

        const { result } = renderHook(() => useJobRunsExplorer("job-1"))

        await waitFor(() => expect(result.current.loading).toBe(false))
        await waitFor(() => expect(result.current.runsError).toBe("Network broke"))
        // Previously the catch was a silent `setRuns([])` — now it must toast.
        expect(toastFn).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Failed to load runs",
                description: "Network broke",
                variant: "destructive",
            }),
        )
    })

    it("preserves previously-loaded runs on transient fetch error (no reset to [])", async () => {
        // First call succeeds.
        getJobRunsMock.mockResolvedValueOnce({
            runs: [{ run_id: "r1", status: "SUCCESS", started_at: "2026-05-15T00:00:00Z" }],
        })
        const { result } = renderHook(() => useJobRunsExplorer("job-1"))
        await waitFor(() => expect(result.current.runs.length).toBe(1))

        // Manual refresh fails — runs should NOT be wiped.
        getJobRunsMock.mockRejectedValueOnce(new Error("Transient 502"))
        await act(async () => { await result.current.handleRefresh() })

        expect(result.current.runs.length).toBe(1)
        expect(result.current.runsError).toBe("Transient 502")
    })

    it("surfaces retry-trigger failure via toast (not silent)", async () => {
        getJobRunsMock.mockResolvedValueOnce({ runs: [] })
        triggerJobMock.mockRejectedValueOnce(new Error("Quota exceeded"))
        const { result } = renderHook(() => useJobRunsExplorer("job-1"))
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => { await result.current.handleRetry() })

        expect(toastFn).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Retry failed",
                description: "Quota exceeded",
                variant: "destructive",
            }),
        )
    })
})
