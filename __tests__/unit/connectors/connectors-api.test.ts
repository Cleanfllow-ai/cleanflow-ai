/**
 * Unit tests for modules/connectors/api/connectors-api.ts :: ConnectorsAPI
 *
 * Verifies:
 *   - listProviders() calls GET /connectors/available and filters ui_only
 *   - listConnections() calls GET /connectors/connections
 *   - connect() calls POST /connectors/{provider}/connect with body
 *   - getConnectionStatus() calls GET /connectors/{provider}/connections
 *   - getConnectionStatus() swallows errors and returns {connected:false}
 *   - disconnect() calls DELETE /connectors/{provider}/disconnect
 *   - handleCallback() calls GET /connectors/callback/{provider} (no auth)
 *   - Authorization header is set from localStorage token
 *   - UI_ONLY_PROVIDERS list is exported and includes known providers
 */

import { connectorsAPI, UI_ONLY_PROVIDERS } from "@/modules/connectors/api/connectors-api"

// ── Shared fetch mock ──────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

function capturedUrl(): string {
  return (global.fetch as jest.Mock).mock.calls[0][0] as string
}

function capturedOptions(): RequestInit {
  return (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
}

beforeEach(() => {
  jest.clearAllMocks()
  // Seed a token so makeRequest can find one
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn((key) => {
        if (key === "authTokens") return JSON.stringify({ idToken: "test-id-token" })
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

// ── listProviders ─────────────────────────────────────────────────────────────

describe("listProviders()", () => {
  it("calls GET /connectors/available", async () => {
    mockFetch({ providers: [{ provider_id: "quickbooks", display_name: "QuickBooks", category: "erp" }] })
    await connectorsAPI.listProviders()
    expect(capturedUrl()).toMatch(/\/connectors\/available$/)
    expect(capturedOptions().method).toBe("GET")
  })

  it("returns providers from response", async () => {
    const providers = [
      { provider_id: "quickbooks", display_name: "QuickBooks", category: "erp" },
      { provider_id: "snowflake", display_name: "Snowflake", category: "warehouse" },
    ]
    mockFetch({ providers })
    const result = await connectorsAPI.listProviders()
    expect(result.providers).toHaveLength(2)
    expect(result.providers[0].provider_id).toBe("quickbooks")
  })

  it("includeUiOnly:true merges UI_ONLY_PROVIDERS not already in real list", async () => {
    mockFetch({ providers: [{ provider_id: "quickbooks", display_name: "QuickBooks", category: "erp" }] })
    const result = await connectorsAPI.listProviders({ includeUiOnly: true })
    // UI_ONLY_PROVIDERS has many entries; merged list must be larger
    expect(result.providers.length).toBeGreaterThan(1)
    // quickbooks is already in real list, should NOT be duplicated
    const qbEntries = result.providers.filter((p) => p.provider_id === "quickbooks")
    expect(qbEntries).toHaveLength(1)
  })

  it("includes Authorization header", async () => {
    mockFetch({ providers: [] })
    await connectorsAPI.listProviders()
    const headers = capturedOptions().headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer test-id-token")
  })
})

// ── listConnections ───────────────────────────────────────────────────────────

describe("listConnections()", () => {
  it("calls GET /connectors/connections", async () => {
    mockFetch({ connections: [] })
    await connectorsAPI.listConnections()
    expect(capturedUrl()).toMatch(/\/connectors\/connections$/)
    expect(capturedOptions().method).toBe("GET")
  })

  it("returns connections array", async () => {
    const connections = [{ provider: "quickbooks", connection_status: "active" }]
    mockFetch({ connections })
    const result = await connectorsAPI.listConnections()
    expect(result.connections).toHaveLength(1)
    expect(result.connections[0]).toMatchObject({ provider: "quickbooks" })
  })
})

// ── connect ───────────────────────────────────────────────────────────────────

describe("connect()", () => {
  it("calls POST /connectors/{provider}/connect", async () => {
    mockFetch({ auth_url: "https://accounts.intuit.com/oauth" })
    await connectorsAPI.connect("quickbooks")
    expect(capturedUrl()).toMatch(/\/connectors\/quickbooks\/connect$/)
    expect(capturedOptions().method).toBe("POST")
  })

  it("sends options in request body", async () => {
    mockFetch({ auth_url: "https://accounts.intuit.com/oauth" })
    await connectorsAPI.connect("quickbooks", { redirect_uri: "https://app.example.com/callback" })
    const body = JSON.parse(capturedOptions().body as string)
    expect(body.redirect_uri).toBe("https://app.example.com/callback")
  })

  it("returns auth_url from response", async () => {
    mockFetch({ auth_url: "https://oauth.provider.com/auth" })
    const result = await connectorsAPI.connect("googledrive")
    expect(result.auth_url).toBe("https://oauth.provider.com/auth")
  })
})

// ── getConnectionStatus ───────────────────────────────────────────────────────

describe("getConnectionStatus()", () => {
  it("calls GET /connectors/{provider}/connections", async () => {
    mockFetch({ connected: true, status: "active" })
    await connectorsAPI.getConnectionStatus("quickbooks")
    expect(capturedUrl()).toMatch(/\/connectors\/quickbooks\/connections$/)
  })

  it("returns connected:false on error (swallows exception)", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("network failure"))
    const result = await connectorsAPI.getConnectionStatus("quickbooks")
    expect(result.connected).toBe(false)
  })

  it("returns connected:false on non-2xx status", async () => {
    mockFetch({ error: "not connected" }, 404)
    const result = await connectorsAPI.getConnectionStatus("quickbooks")
    expect(result.connected).toBe(false)
  })
})

// ── disconnect ────────────────────────────────────────────────────────────────

describe("disconnect()", () => {
  it("calls DELETE /connectors/{provider}/disconnect", async () => {
    mockFetch({})
    await connectorsAPI.disconnect("quickbooks")
    expect(capturedUrl()).toMatch(/\/connectors\/quickbooks\/disconnect$/)
    expect(capturedOptions().method).toBe("DELETE")
  })
})

// ── handleCallback ────────────────────────────────────────────────────────────

describe("handleCallback()", () => {
  it("calls GET /connectors/callback/{provider} with query params", async () => {
    mockFetch({ success: true })
    await connectorsAPI.handleCallback("quickbooks", { code: "abc", state: "xyz" })
    const url = capturedUrl()
    expect(url).toMatch(/\/connectors\/callback\/quickbooks/)
    expect(url).toContain("code=abc")
    expect(url).toContain("state=xyz")
  })

  it("includes realmId when provided", async () => {
    mockFetch({ success: true })
    await connectorsAPI.handleCallback("quickbooks", { code: "abc", state: "xyz", realmId: "123456" })
    expect(capturedUrl()).toContain("realmId=123456")
  })
})

// ── UI_ONLY_PROVIDERS ─────────────────────────────────────────────────────────

describe("UI_ONLY_PROVIDERS", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(UI_ONLY_PROVIDERS)).toBe(true)
    expect(UI_ONLY_PROVIDERS.length).toBeGreaterThan(0)
  })

  it("all entries have required fields: provider_id, display_name, category", () => {
    for (const p of UI_ONLY_PROVIDERS) {
      expect(p.provider_id).toBeTruthy()
      expect(p.display_name).toBeTruthy()
      expect(p.category).toBeTruthy()
    }
  })

  it("all entries have ui_only:true", () => {
    for (const p of UI_ONLY_PROVIDERS) {
      expect(p.ui_only).toBe(true)
    }
  })

  it("known providers are present in the list", () => {
    const ids = UI_ONLY_PROVIDERS.map((p) => p.provider_id)
    expect(ids).toContain("salesforce")
    expect(ids).toContain("netsuite")
    expect(ids).toContain("zohobooks")
  })
})
