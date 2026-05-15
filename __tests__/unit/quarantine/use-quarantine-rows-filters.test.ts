/**
 * Unit tests for useQuarantineRows.fetchNext() — verifies that the filters
 * parameter is forwarded to the queryQuarantinedRows API call so that
 * server-side filtering works in the compat-mode lazy-scroll path, not just
 * in the AG Grid virtual datasource path.
 *
 * Fix: plumb filters through fetchNext (commit: fix(quarantine): plumb filters
 * through fetchNext compat path so server-side filter applies in all row-fetch modes)
 */

import { renderHook, act } from "@testing-library/react"

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}))

const toastFn = jest.fn()
jest.mock("@/shared/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastFn }),
}))

const queryQuarantinedRowsMock = jest.fn()
jest.mock("@/modules/files/api", () => ({
  queryQuarantinedRows: (...args: unknown[]) => queryQuarantinedRowsMock(...args),
}))

// suppress error-toast-jsx import (JSX not needed here)
jest.mock("@/lib/error-toast-jsx", () => ({
  toastFromQuarantineError: () => ({ title: "error", description: "", variant: "destructive" }),
}))

import { useQuarantineRows } from "@/modules/files/hooks/use-quarantine-rows"
import type { QuarantineFilters } from "@/modules/files/types"

const CONFIG = { pageSize: 50, maxRowsInMemory: 500 }

beforeEach(() => {
  jest.clearAllMocks()
  queryQuarantinedRowsMock.mockResolvedValue({
    rows: [{ row_id: "1" }],
    next_cursor: null,
  })
})

describe("useQuarantineRows.fetchNext — filter forwarding", () => {
  it("passes filters to queryQuarantinedRows when provided", async () => {
    const filters: QuarantineFilters = {
      columns: { email: { violations: ["R5"] } },
    }

    const { result } = renderHook(() => useQuarantineRows(CONFIG))

    await act(async () => {
      await result.current.fetchNext(
        "upload-abc",
        "tok-xyz",
        "sess-1",
        "base-upload-abc",
        undefined,
        filters
      )
    })

    expect(queryQuarantinedRowsMock).toHaveBeenCalledTimes(1)
    expect(queryQuarantinedRowsMock).toHaveBeenCalledWith(
      "upload-abc",
      "tok-xyz",
      expect.objectContaining({ filters })
    )
  })

  it("omits filters key when no filters are supplied (backwards compat)", async () => {
    const { result } = renderHook(() => useQuarantineRows(CONFIG))

    await act(async () => {
      await result.current.fetchNext(
        "upload-abc",
        "tok-xyz",
        "sess-1",
        "base-upload-abc"
      )
    })

    expect(queryQuarantinedRowsMock).toHaveBeenCalledTimes(1)
    const payload = queryQuarantinedRowsMock.mock.calls[0][2]
    // filters should be undefined (not an empty object) when not supplied
    expect(payload.filters).toBeUndefined()
  })

  it("sends filters alongside cursor on subsequent pages", async () => {
    // Page 1 returns a cursor
    queryQuarantinedRowsMock.mockResolvedValueOnce({
      rows: [{ row_id: "1" }],
      next_cursor: "cursor-page-2",
    })
    // Page 2 response
    queryQuarantinedRowsMock.mockResolvedValueOnce({
      rows: [{ row_id: "2" }],
      next_cursor: null,
    })

    const filters: QuarantineFilters = {
      columns: { phone: { violations: ["R10"] } },
    }

    const { result } = renderHook(() => useQuarantineRows(CONFIG))

    // First fetch
    await act(async () => {
      await result.current.fetchNext("upload-1", "tok-1", "s", "b", undefined, filters)
    })

    // Second fetch with explicit cursor (as lazy-scroll would do)
    await act(async () => {
      await result.current.fetchNext("upload-1", "tok-1", "s", "b", "cursor-page-2", filters)
    })

    expect(queryQuarantinedRowsMock).toHaveBeenCalledTimes(2)
    const [, , page2Payload] = queryQuarantinedRowsMock.mock.calls[1]
    expect(page2Payload.cursor).toBe("cursor-page-2")
    expect(page2Payload.filters).toEqual(filters)
  })
})
