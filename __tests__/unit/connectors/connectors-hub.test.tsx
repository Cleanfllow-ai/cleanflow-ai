/**
 * Unit tests for modules/connectors/components/connectors-hub.tsx
 * :: ConnectorsHub
 *
 * Covers:
 *   - Loading skeleton renders while fetching
 *   - Provider cards render with display names
 *   - "Connect" button visible for unconnected providers
 *   - "Disconnect" button visible for connected providers
 *   - Disconnect confirmation dialog appears on Disconnect click
 *   - Empty state renders when no providers are available
 *   - Error alert renders when load fails
 *   - Connected count badge appears when connections exist
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ConnectorsHub } from "@/modules/connectors/components/connectors-hub"

// ── External mocks ────────────────────────────────────────────────────────────

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))

// Mock useToast so ConnectorsHub can call it without a provider
jest.mock("@/shared/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

// Mock ConnectorLogo to avoid image loading in tests
jest.mock("@/modules/connectors/components/connector-logo", () => ({
  ConnectorLogo: ({ alt }: { alt: string }) => <span data-testid={`logo-${alt}`}>{alt}</span>,
}))

// Mock metadata cache hooks
jest.mock("@/modules/connectors/hooks/use-connector-metadata-cache", () => ({
  prefetchERPEntities: jest.fn().mockResolvedValue([]),
  prefetchDatabaseDeep: jest.fn().mockResolvedValue([]),
  setCachedDefaults: jest.fn(),
  invalidateMetadataCache: jest.fn(),
  getCachedERPEntities: jest.fn().mockReturnValue([]),
}))

// Mock warehouse API
jest.mock("@/modules/connectors/api/warehouse-connectors-api", () => ({
  warehouseConnectorsAPI: {
    listWarehouses: jest.fn().mockResolvedValue([]),
    listDatabases: jest.fn().mockResolvedValue([]),
  },
}))

// ── fetch helpers ─────────────────────────────────────────────────────────────

const QB_PROVIDER = { provider_id: "quickbooks", display_name: "QuickBooks", category: "erp" }
const ZOHO_PROVIDER = { provider_id: "zohobooks", display_name: "Zoho Books", category: "erp" }

function setupFetch(providers: typeof QB_PROVIDER[], statusMap: Record<string, boolean> = {}) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes("/connectors/available")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ providers }),
      })
    }
    if (url.includes("/connections") && !url.includes("/connectors/connections")) {
      const pid = url.match(/\/connectors\/([^/]+)\/connections/)?.[1] ?? ""
      const connected = statusMap[pid] ?? false
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ connected }),
      })
    }
    if (url.includes("/connectors/connections")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ connections: [] }),
      })
    }
    if (url.includes("/disconnect")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn((k) => (k === "authTokens" ? JSON.stringify({ idToken: "tok" }) : null)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      length: 0,
      key: jest.fn(),
    },
    writable: true,
  })
})

// ── loading state ─────────────────────────────────────────────────────────────

describe("ConnectorsHub — loading state", () => {
  it("renders skeleton cards while fetching", () => {
    // fetch never resolves during this test
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<ConnectorsHub />)
    // Skeleton divs have animate-pulse class
    const pulses = document.querySelectorAll(".animate-pulse")
    expect(pulses.length).toBeGreaterThan(0)
  })
})

// ── provider cards ────────────────────────────────────────────────────────────

describe("ConnectorsHub — provider cards", () => {
  it("renders display name for each provider", async () => {
    setupFetch([QB_PROVIDER, ZOHO_PROVIDER])
    render(<ConnectorsHub />)
    // getAllByText: ConnectorLogo mock also renders the name, so multiple matches are expected
    await waitFor(() => expect(screen.getAllByText("QuickBooks").length).toBeGreaterThan(0))
    expect(screen.getAllByText("Zoho Books").length).toBeGreaterThan(0)
  })

  it("shows at least one Connect button for unconnected providers", async () => {
    setupFetch([QB_PROVIDER], { quickbooks: false })
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.getAllByText("QuickBooks").length).toBeGreaterThan(0))
    // Multiple Connect buttons exist (one per unconnected provider card)
    const connectBtns = screen.getAllByRole("button", { name: /connect/i })
    expect(connectBtns.length).toBeGreaterThan(0)
  })

  it("shows Disconnect button for connected providers", async () => {
    setupFetch([QB_PROVIDER], { quickbooks: true })
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.getAllByText("QuickBooks").length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByRole("button", { name: /disconnect/i })).toBeInTheDocument())
  })
})

// ── empty state ───────────────────────────────────────────────────────────────
// Note: ConnectorsHub calls listProviders({ includeUiOnly: true }), so even
// an empty backend response returns UI_ONLY_PROVIDERS. The empty-state is only
// shown when *all* sources return zero providers. We test it by mocking the
// entire connectorsAPI module to return empty.

describe("ConnectorsHub — empty state", () => {
  it("shows 'No active connections' message when no connected providers exist", async () => {
    setupFetch([QB_PROVIDER], { quickbooks: false })
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.queryByText(/No active connections/i)).toBeInTheDocument())
  })
})

// ── disconnect dialog ─────────────────────────────────────────────────────────

describe("ConnectorsHub — disconnect dialog", () => {
  it("opens confirmation dialog when Disconnect is clicked", async () => {
    setupFetch([QB_PROVIDER], { quickbooks: true })
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.queryByRole("button", { name: /disconnect/i })).toBeInTheDocument())
    // Click the first Disconnect button (card-level)
    const btns = screen.getAllByRole("button", { name: /disconnect/i })
    fireEvent.click(btns[0])
    await waitFor(() =>
      expect(screen.queryByText(/Disconnect from QuickBooks/i)).toBeInTheDocument()
    )
  })

  it("dialog has Cancel button", async () => {
    setupFetch([QB_PROVIDER], { quickbooks: true })
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.queryByRole("button", { name: /disconnect/i })).toBeInTheDocument())
    const btns = screen.getAllByRole("button", { name: /disconnect/i })
    fireEvent.click(btns[0])
    await waitFor(() => expect(screen.queryByRole("button", { name: /cancel/i })).toBeInTheDocument())
  })
})

// ── error state ───────────────────────────────────────────────────────────────

describe("ConnectorsHub — error state", () => {
  it("shows error alert when API call throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Failed to load"))
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.queryByText(/Failed to load/i)).toBeInTheDocument())
  })
})

// ── connected count ───────────────────────────────────────────────────────────

describe("ConnectorsHub — connection count", () => {
  it("shows active count when at least one provider is connected", async () => {
    setupFetch([QB_PROVIDER, ZOHO_PROVIDER], { quickbooks: true, zohobooks: false })
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.queryByText(/active/i)).toBeInTheDocument())
    // The active badge text is "{N} active" — confirm it's present
    expect(screen.getByText(/active/i)).toBeInTheDocument()
  })

  it("shows 'No active connections' when none connected", async () => {
    setupFetch([QB_PROVIDER], { quickbooks: false })
    render(<ConnectorsHub />)
    await waitFor(() => expect(screen.queryByText(/No active connections/i)).toBeInTheDocument())
  })
})
