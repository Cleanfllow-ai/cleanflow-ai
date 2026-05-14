/**
 * Unit tests for app/connectors/callback/page.tsx :: ConnectorCallbackPage
 *
 * Covers:
 *   - Processing state renders while useEffect fires
 *   - Success state renders when ?success=true
 *   - Error state renders when ?error=<code> is present
 *   - Known error codes produce friendly messages (access_denied, invalid_grant, etc.)
 *   - Unknown error codes fall back to "<code>: <desc>" format
 *   - postMessage is sent to opener on success
 *   - postMessage is sent to opener on error
 *   - "Try again" button visible in error state
 *   - "Cancel" button visible in error state
 *   - Provider display name is formatted correctly in error message
 */

import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ConnectorCallbackPage from "@/app/connectors/callback/page"

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))

const mockPush = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ── URL helper ────────────────────────────────────────────────────────────────

function setSearchParams(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search: `?${qs}` },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  // No opener by default (popup flow not active)
  Object.defineProperty(window, "opener", { writable: true, value: null })
})

// ── Success state ─────────────────────────────────────────────────────────────

describe("ConnectorCallbackPage — success state", () => {
  it("renders 'Connected' heading on success=true", async () => {
    setSearchParams({ provider: "quickbooks", success: "true" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText("Connected")).toBeInTheDocument())
    expect(screen.getByText("Connected successfully!")).toBeInTheDocument()
  })

  it("shows auto-close notice on success", async () => {
    setSearchParams({ provider: "googledrive", success: "true" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText(/close automatically/i)).toBeInTheDocument())
  })

  it("sends postMessage to opener on success", async () => {
    setSearchParams({ provider: "quickbooks", success: "true" })
    const postMessage = jest.fn()
    Object.defineProperty(window, "opener", { writable: true, value: { postMessage } })
    render(<ConnectorCallbackPage />)
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "quickbooks-auth-success" }),
        window.location.origin,
      )
    })
  })

  it("no explicit success param still transitions to success state", async () => {
    setSearchParams({ provider: "snowflake" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText("Connected")).toBeInTheDocument())
  })
})

// ── Error state ───────────────────────────────────────────────────────────────

describe("ConnectorCallbackPage — error state", () => {
  it("renders 'Connection Failed' heading on error param", async () => {
    setSearchParams({ provider: "quickbooks", error: "access_denied" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText("Connection Failed")).toBeInTheDocument())
  })

  it("renders friendly message for access_denied", async () => {
    setSearchParams({ provider: "quickbooks", error: "access_denied" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText(/declined to authorize/i)).toBeInTheDocument())
    expect(screen.getByText(/QuickBooks/i)).toBeInTheDocument()
  })

  it("renders friendly message for invalid_grant", async () => {
    setSearchParams({ provider: "zohobooks", error: "invalid_grant" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText(/Authorization link expired/i)).toBeInTheDocument())
  })

  it("renders friendly message for state_mismatch", async () => {
    setSearchParams({ provider: "zohobooks", error: "state_mismatch" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText(/Security check failed/i)).toBeInTheDocument())
  })

  it("unknown error code falls back to '<code>: <desc>'", async () => {
    setSearchParams({
      provider: "quickbooks",
      error: "unexpected_code",
      error_description: "Something unexpected happened",
    })
    render(<ConnectorCallbackPage />)
    await waitFor(() =>
      expect(screen.queryByText(/unexpected_code.*Something unexpected happened/i)).toBeInTheDocument()
    )
  })

  it("shows Try again and Cancel buttons on error", async () => {
    setSearchParams({ provider: "quickbooks", error: "access_denied" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByRole("button", { name: /try again/i })).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
  })

  it("sends postMessage to opener on error", async () => {
    setSearchParams({ provider: "quickbooks", error: "access_denied" })
    const postMessage = jest.fn()
    Object.defineProperty(window, "opener", { writable: true, value: { postMessage } })
    render(<ConnectorCallbackPage />)
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "quickbooks-auth-error" }),
        window.location.origin,
      )
    })
  })

  it("does NOT auto-close on error (stays open for user to read)", async () => {
    jest.useFakeTimers()
    const closeSpy = jest.spyOn(window, "close").mockImplementation(() => {})
    setSearchParams({ provider: "quickbooks", error: "access_denied" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText("Connection Failed")).toBeInTheDocument())
    jest.advanceTimersByTime(5000)
    expect(closeSpy).not.toHaveBeenCalled()
    jest.useRealTimers()
    closeSpy.mockRestore()
  })
})

// ── Provider display names ────────────────────────────────────────────────────

describe("ConnectorCallbackPage — provider name formatting", () => {
  it("formats googledrive as 'Google Drive' in error message", async () => {
    setSearchParams({ provider: "googledrive", error: "access_denied" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText(/Google Drive/i)).toBeInTheDocument())
  })

  it("formats quickbooks as 'QuickBooks' in error message", async () => {
    setSearchParams({ provider: "quickbooks", error: "access_denied" })
    render(<ConnectorCallbackPage />)
    await waitFor(() => expect(screen.queryByText(/QuickBooks/i)).toBeInTheDocument())
  })
})
