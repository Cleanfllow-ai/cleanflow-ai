/**
 * Unit tests for modules/connectors/hooks/use-available-providers.ts
 *
 * Verifies:
 *   - Hook fetches providers on mount
 *   - Returns flat options list and grouped map
 *   - Module-level cache: second mount skips fetch
 *   - invalidateProviderCache() resets cache so next mount re-fetches
 *   - Error during fetch: hook returns empty list (no crash)
 *   - loading transitions correctly
 */

import { renderHook, act, waitFor } from "@testing-library/react"
import { useAvailableProviders, invalidateProviderCache } from "@/modules/connectors/hooks/use-available-providers"

// ── fetch mock helpers ────────────────────────────────────────────────────────

const MOCK_PROVIDERS = [
  { provider_id: "quickbooks", display_name: "QuickBooks", category: "erp" },
  { provider_id: "zohobooks", display_name: "Zoho Books", category: "erp" },
  { provider_id: "snowflake", display_name: "Snowflake", category: "warehouse" },
  { provider_id: "googledrive", display_name: "Google Drive", category: "storage" },
]

function mockSuccessfulFetch(providers = MOCK_PROVIDERS) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ providers }),
  } as Response)
}

function mockFailedFetch() {
  global.fetch = jest.fn().mockRejectedValue(new Error("Network error"))
}

beforeEach(() => {
  // Reset module-level cache between tests so each test is independent
  invalidateProviderCache()
  jest.clearAllMocks()

  // Seed localStorage token
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn((key) => {
        if (key === "authTokens") return JSON.stringify({ idToken: "test-token" })
        return null
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      length: 0,
      key: jest.fn(),
    },
    writable: true,
  })
})

// ── mount + fetch ─────────────────────────────────────────────────────────────

describe("useAvailableProviders — fetch on mount", () => {
  it("starts in loading state", () => {
    mockSuccessfulFetch()
    const { result } = renderHook(() => useAvailableProviders())
    expect(result.current.loading).toBe(true)
  })

  it("returns providers after fetch resolves", async () => {
    mockSuccessfulFetch()
    const { result } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.providers).toHaveLength(4)
    expect(result.current.providers[0].provider_id).toBe("quickbooks")
  })

  it("calls GET /connectors/available", async () => {
    mockSuccessfulFetch()
    renderHook(() => useAvailableProviders())
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      expect(calls.length).toBeGreaterThan(0)
    })
    const url = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(url).toMatch(/\/connectors\/available/)
  })
})

// ── options + grouped ─────────────────────────────────────────────────────────

describe("useAvailableProviders — derived values", () => {
  it("options list maps providers to label/value/category", async () => {
    mockSuccessfulFetch()
    const { result } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const qb = result.current.options.find((o) => o.value === "quickbooks")
    expect(qb).toBeDefined()
    expect(qb?.label).toBe("QUICKBOOKS") // uppercase per implementation
    expect(qb?.category).toBe("erp")
  })

  it("grouped map organises providers by category", async () => {
    mockSuccessfulFetch()
    const { result } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.grouped["erp"]).toHaveLength(2)
    expect(result.current.grouped["warehouse"]).toHaveLength(1)
    expect(result.current.grouped["storage"]).toHaveLength(1)
  })

  it("groupedOptions has uppercase labels per category", async () => {
    mockSuccessfulFetch()
    const { result } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const storageOptions = result.current.groupedOptions["storage"]
    expect(storageOptions).toBeDefined()
    expect(storageOptions[0].label).toBe("GOOGLE DRIVE")
  })
})

// ── module-level cache ────────────────────────────────────────────────────────

describe("useAvailableProviders — module-level cache", () => {
  it("second hook mount skips fetch (uses cache)", async () => {
    mockSuccessfulFetch()
    const { result: r1 } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(r1.current.loading).toBe(false))
    const firstFetchCount = (global.fetch as jest.Mock).mock.calls.length

    // Second mount — should use cache
    const { result: r2 } = renderHook(() => useAvailableProviders())
    expect(r2.current.loading).toBe(false) // already cached
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(firstFetchCount)
  })

  it("invalidateProviderCache() causes re-fetch on next mount", async () => {
    mockSuccessfulFetch()
    const { result: r1 } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(r1.current.loading).toBe(false))

    act(() => { invalidateProviderCache() })
    mockSuccessfulFetch()

    const { result: r2 } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(r2.current.loading).toBe(false))
    // fetch should have been called a second time after cache bust
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1)
  })
})

// ── error handling ────────────────────────────────────────────────────────────

describe("useAvailableProviders — error handling", () => {
  it("returns empty list when fetch fails (no crash)", async () => {
    mockFailedFetch()
    const { result } = renderHook(() => useAvailableProviders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.providers).toHaveLength(0)
    expect(result.current.options).toHaveLength(0)
  })
})
