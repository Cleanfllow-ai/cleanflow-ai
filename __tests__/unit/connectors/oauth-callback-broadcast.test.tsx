/**
 * Tests for the cross-window OAuth signalling enhancements:
 *   - BroadcastChannel emission on success/error
 *   - localStorage fallback emission on success/error
 *
 * Why: Strict COOP / cross-origin-opener-policy isolation can sever
 * `window.opener` so `postMessage` silently drops, leaving the parent
 * window spinning. The callback page must emit on BroadcastChannel and
 * localStorage as fallbacks. See modules/connectors/api/base.ts.
 */

import { render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ConnectorCallbackPage from "@/app/connectors/callback/page"

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

function setSearchParams(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search: `?${qs}` },
  })
}

describe("ConnectorCallbackPage — BroadcastChannel fallback", () => {
  let posted: unknown[] = []
  let originalBC: typeof BroadcastChannel

  beforeEach(() => {
    posted = []
    originalBC = (global as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel
    class FakeBC {
      name: string
      constructor(name: string) { this.name = name }
      postMessage(data: unknown) { posted.push(data) }
      close() { /* noop */ }
      onmessage: ((ev: { data: unknown }) => void) | null = null
    }
    ;(global as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel =
      FakeBC as unknown as typeof BroadcastChannel
    Object.defineProperty(window, "opener", { writable: true, value: null })
    window.localStorage.clear()
  })

  afterEach(() => {
    ;(global as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel = originalBC
  })

  it("emits a success message on BroadcastChannel when opener is null", async () => {
    setSearchParams({ provider: "googledrive", success: "true" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => {
      expect(posted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "googledrive-auth-success" }),
        ]),
      )
    })
  })

  it("emits an error message on BroadcastChannel when error code present", async () => {
    setSearchParams({ provider: "quickbooks", error: "access_denied" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => {
      expect(posted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "quickbooks-auth-error", code: "access_denied" }),
        ]),
      )
    })
  })

  it("writes a signal to localStorage under the provider-scoped key", async () => {
    setSearchParams({ provider: "snowflake", success: "true" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => {
      const stored = window.localStorage.getItem("cleanflowai-oauth:snowflake")
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored as string)
      expect(parsed.type).toBe("snowflake-auth-success")
      expect(parsed._nonce).toMatch(/-/)
    })
  })

  it("storage signals include a unique nonce so consecutive writes still fire events", async () => {
    setSearchParams({ provider: "zohobooks", success: "true" })
    const { unmount } = render(<ConnectorCallbackPage />)
    let first: string | null = null
    await waitFor(() => {
      first = window.localStorage.getItem("cleanflowai-oauth:zohobooks")
      expect(first).toBeTruthy()
    })
    unmount()
    // Render again — different nonce.
    render(<ConnectorCallbackPage />)
    await waitFor(() => {
      const second = window.localStorage.getItem("cleanflowai-oauth:zohobooks")
      expect(second).toBeTruthy()
      expect(JSON.parse(second as string)._nonce).not.toEqual(
        JSON.parse(first as string)._nonce,
      )
    })
  })
})
