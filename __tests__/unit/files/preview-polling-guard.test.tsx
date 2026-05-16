/**
 * Tests for Bug 1 (runaway preview polling on non-ready files) and
 * Bug 4 (stale closure / status-blind DQ report fetch).
 *
 * Bug 1: useFileDetails must NOT call loadPreview (getFilePreview) when
 *   file.status is not in READY_FOR_PREVIEW.  After a terminal error kind
 *   (uploading / rejected / not_found) is set, no further automatic fetch
 *   should fire — the user must click Refresh manually.
 *
 * Bug 4: useFileDetails must NOT call loadDqReport (downloadDqReport) when
 *   file.status is not in READY_FOR_REPORT.  The effect must gate on the
 *   file status, not just on !dqReport && !dqReportLoading.
 */

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: { API_BASE_URL: "https://api.test.com/" },
}))

// Silence toast usage inside the hook (not under test here).
jest.mock("@/shared/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

import { renderHook, act, waitFor } from "@testing-library/react"
import { useFileDetails } from "@/modules/files/hooks/use-file-details"
import type { FileStatusResponse } from "@/modules/files/api/file-management-api"

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildFile(overrides: Partial<FileStatusResponse> = {}): FileStatusResponse {
  return {
    upload_id: "upl-abc-123",
    status: "DQ_FIXED",
    original_filename: "test.csv",
    filename: "test.csv",
    rows_in: 100,
    rows_quarantined: 0,
    dq_score: 95,
    uploaded_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  }
}

// Mock fileManagementAPI at module level.
let mockGetFilePreview: jest.Mock
let mockDownloadDqReport: jest.Mock
let mockGetFileStatus: jest.Mock
let mockGetFileVersions: jest.Mock

jest.mock("@/modules/files/api/file-management-api", () => ({
  fileManagementAPI: {
    getFilePreview: (...args: any[]) => mockGetFilePreview(...args),
    downloadDqReport: (...args: any[]) => mockDownloadDqReport(...args),
    getFileStatus: (...args: any[]) => mockGetFileStatus(...args),
    getFileVersions: (...args: any[]) => mockGetFileVersions(...args),
  },
}))

// Provide a token so the hook doesn't bail out early.
const mockAuthTokens = JSON.stringify({ idToken: "tok-xyz" })

beforeEach(() => {
  mockGetFilePreview = jest.fn().mockResolvedValue({
    headers: ["a", "b"],
    sample_data: [{ a: "1", b: "2" }],
    total_rows: 1,
  })
  mockDownloadDqReport = jest.fn().mockResolvedValue({
    hybrid_summary: { outstanding_issues: [], outstanding_issues_total: 0 },
    violation_counts: {},
  })
  mockGetFileStatus = jest.fn().mockImplementation((id: string) =>
    Promise.resolve(buildFile({ upload_id: id }))
  )
  mockGetFileVersions = jest.fn().mockResolvedValue({ versions: [], count: 0 })

  // Provide authTokens in localStorage
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => (key === "authTokens" ? mockAuthTokens : null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  })
})

afterEach(() => {
  jest.clearAllMocks()
})

// ── Bug 1: no preview fetch for non-ready statuses ───────────────────────────

describe("Bug 1 — preview polling guard", () => {
  const NON_READY_STATUSES = [
    "VALIDATED",
    "UPLOADING",
    "UPLOADED",
    "DQ_DISPATCHED",
    "DQ_RUNNING",
  ]

  for (const status of NON_READY_STATUSES) {
    it(`does NOT call getFilePreview when file.status = ${status}`, async () => {
      const file = buildFile({ status })

      const { result } = renderHook(() =>
        useFileDetails(file, /* open */ true, "preview")
      )

      // Switch to preview tab
      act(() => {
        result.current.setActiveTab("preview")
      })

      // Wait for any async effects to settle
      await waitFor(() => {
        expect(result.current.previewLoading).toBe(false)
      })

      // getFilePreview must never be called for non-ready files
      expect(mockGetFilePreview).not.toHaveBeenCalled()
    })
  }

  it("sets previewErrorKind=uploading immediately for VALIDATED file (no API call)", async () => {
    const file = buildFile({ status: "VALIDATED" })

    const { result } = renderHook(() =>
      useFileDetails(file, true, "preview")
    )

    act(() => {
      result.current.setActiveTab("preview")
    })

    await waitFor(() => {
      expect(result.current.previewErrorKind).toBe("uploading")
    })

    expect(result.current.previewError).toMatch(/still processing/i)
    expect(mockGetFilePreview).not.toHaveBeenCalled()
  })

  it("does NOT retry after terminal uploading error (no re-poll on re-render)", async () => {
    const file = buildFile({ status: "VALIDATED" })

    const { result, rerender } = renderHook(
      ({ f }) => useFileDetails(f, true, "preview"),
      { initialProps: { f: file } }
    )

    act(() => {
      result.current.setActiveTab("preview")
    })

    await waitFor(() => {
      expect(result.current.previewErrorKind).toBe("uploading")
    })

    // Force multiple re-renders that would have triggered polling before the fix
    rerender({ f: { ...file, updated_at: "2025-01-02T00:00:00Z" } })
    rerender({ f: { ...file, updated_at: "2025-01-03T00:00:00Z" } })

    await waitFor(() => {
      // Still no API call
      expect(mockGetFilePreview).not.toHaveBeenCalled()
    })
  })

  it("DOES call getFilePreview when file.status = DQ_FIXED", async () => {
    const file = buildFile({ status: "DQ_FIXED" })

    const { result } = renderHook(() =>
      useFileDetails(file, true, "preview")
    )

    act(() => {
      result.current.setActiveTab("preview")
    })

    // Wait for the API to be called (proves the guard lets DQ_FIXED through)
    await waitFor(() => {
      expect(mockGetFilePreview).toHaveBeenCalledTimes(1)
    })

    // previewData is set asynchronously — wait for it
    await waitFor(() => {
      expect(result.current.previewData).not.toBeNull()
    })
  })
})

// ── Bug 4: no DQ report fetch for non-ready statuses ─────────────────────────

describe("Bug 4 — DQ report fetch guard", () => {
  const NON_REPORT_STATUSES = [
    "VALIDATED",
    "DQ_DISPATCHED",
    "DQ_RUNNING",
    "UPLOADED",
  ]

  for (const status of NON_REPORT_STATUSES) {
    it(`does NOT call downloadDqReport when file.status = ${status}`, async () => {
      const file = buildFile({ status })

      const { result } = renderHook(() =>
        useFileDetails(file, true, "preview")
      )

      act(() => {
        result.current.setActiveTab("preview")
      })

      await waitFor(() => {
        expect(result.current.previewLoading).toBe(false)
      })

      expect(mockDownloadDqReport).not.toHaveBeenCalled()
    })
  }

  it("DOES call downloadDqReport when file.status = DQ_FIXED", async () => {
    const file = buildFile({ status: "DQ_FIXED" })

    const { result } = renderHook(() =>
      useFileDetails(file, true, "preview")
    )

    act(() => {
      result.current.setActiveTab("preview")
    })

    await waitFor(() => {
      expect(mockDownloadDqReport).toHaveBeenCalledTimes(1)
    })
  })

  it("uses the current selectedUploadId (not a stale closure) after version switch", async () => {
    const fileV1 = buildFile({ upload_id: "upl-v1", status: "DQ_FIXED" })

    const { result } = renderHook(
      ({ f }) => useFileDetails(f, true, "dq-report"),
      { initialProps: { f: fileV1 } }
    )

    // Wait for the initial v1 report fetch to complete
    await waitFor(() => {
      expect(mockDownloadDqReport).toHaveBeenCalledWith("upl-v1", expect.any(String))
    })

    // Simulate version switch: v2 selected
    mockDownloadDqReport.mockClear()
    mockGetFileStatus.mockResolvedValue(buildFile({ upload_id: "upl-v2", status: "DQ_FIXED" }))

    act(() => {
      result.current.setSelectedVersionUploadId("upl-v2")
    })

    // After version switch, the hook fetches the report for v2 (not stale v1)
    await waitFor(() => {
      expect(mockDownloadDqReport).toHaveBeenCalledWith("upl-v2", expect.any(String))
    })
    // Crucially, it should NOT re-fetch with the old v1 id
    expect(mockDownloadDqReport).not.toHaveBeenCalledWith("upl-v1", expect.any(String))
  })
})
