/**
 * Unit tests for modules/files/api/erp-connector-api.ts
 * Covers: ERPConnectorService — listERPs, getConnectionStatus, connect,
 *         exportToERP, importFromERP, disconnect, schemaResolve,
 *         multiExport, multiExportStatus
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

const originalFetch = global.fetch

function mockFetch(impl: (...args: any[]) => Promise<Response>) {
  global.fetch = jest.fn(impl) as any
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
  // Clear localStorage mock
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
  }
})

// Mock localStorage for auth token retrieval
beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn().mockReturnValue(JSON.stringify({ idToken: 'test-token' })),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  })
})

import { erpConnectorAPI } from '@/modules/files/api/erp-connector-api'

// ─── listERPs ────────────────────────────────────────────────────────────────
describe('erpConnectorAPI.listERPs', () => {
  it('calls GET /connectors/erp/mapping/erps', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('/connectors/erp/mapping/erps')
      return jsonResponse({ erps: ['QuickBooks', 'Oracle', 'SAP'], connectors: ['quickbooks'] })
    })

    const result = await erpConnectorAPI.listERPs()
    expect(result.erps).toContain('QuickBooks')
    expect(result.connectors).toContain('quickbooks')
  })

  it('sends auth header from localStorage', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
      return jsonResponse({ erps: [], connectors: [] })
    })

    await erpConnectorAPI.listERPs()
  })
})

// ─── getConnectionStatus ─────────────────────────────────────────────────────
describe('erpConnectorAPI.getConnectionStatus', () => {
  it('returns connected status for a provider', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('/connectors/quickbooks/connections')
      return jsonResponse({ connected: true, provider: 'quickbooks' })
    })

    const result = await erpConnectorAPI.getConnectionStatus('quickbooks')
    expect(result.connected).toBe(true)
  })

  it('returns { connected: false } on error', async () => {
    mockFetch(async () => { throw new Error('Network error') })

    const result = await erpConnectorAPI.getConnectionStatus('oracle')
    expect(result.connected).toBe(false)
    expect(result.provider).toBe('oracle')
  })
})

// ─── connect ─────────────────────────────────────────────────────────────────
describe('erpConnectorAPI.connect', () => {
  it('sends POST and returns auth_url', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/connectors/quickbooks/connect')
      expect(opts.method).toBe('POST')
      return jsonResponse({ auth_url: 'https://oauth.quickbooks.com/authorize?...' })
    })

    const result = await erpConnectorAPI.connect('quickbooks')
    expect(result.auth_url).toContain('oauth.quickbooks.com')
  })
})

// ─── exportToERP ─────────────────────────────────────────────────────────────
describe('erpConnectorAPI.exportToERP', () => {
  it('sends POST with upload_id, entity_type, org_id', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.upload_id).toBe('upload-1')
      expect(body.entity_type).toBe('Invoices')
      expect(body.org_id).toBe('org-1')
      return jsonResponse({ success: true, records_exported: 50 })
    })

    const result = await erpConnectorAPI.exportToERP('quickbooks', 'upload-1', 'Invoices', 'org-1')
    expect(result.success).toBe(true)
    expect(result.records_exported).toBe(50)
  })

  it('includes column_mapping when provided', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.column_mapping).toEqual({ name: 'DisplayName' })
      return jsonResponse({ success: true })
    })

    await erpConnectorAPI.exportToERP('quickbooks', 'u1', 'Customers', undefined, { name: 'DisplayName' })
  })
})

// ─── importFromERP ───────────────────────────────────────────────────────────
describe('erpConnectorAPI.importFromERP', () => {
  it('sends POST with entity_type and filters', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/connectors/erp/quickbooks/import')
      const body = JSON.parse(opts.body as string)
      expect(body.entity_type).toBe('Customers')
      expect(body.filters).toEqual({ max_records: 100 })
      return jsonResponse({ upload_id: 'new-upload' })
    })

    const result = await erpConnectorAPI.importFromERP('quickbooks', 'Customers', { max_records: 100 })
    expect(result).toEqual({ upload_id: 'new-upload' })
  })

  it('sends empty filters by default', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.filters).toEqual({})
      return jsonResponse({})
    })

    await erpConnectorAPI.importFromERP('quickbooks', 'Invoices')
  })
})

// ─── disconnect ──────────────────────────────────────────────────────────────
describe('erpConnectorAPI.disconnect', () => {
  it('sends DELETE to disconnect endpoint', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/connectors/quickbooks/disconnect')
      expect(opts.method).toBe('DELETE')
      return jsonResponse({})
    })

    await erpConnectorAPI.disconnect('quickbooks')
  })
})

// ─── schemaResolve ───────────────────────────────────────────────────────────
describe('erpConnectorAPI.schemaResolve', () => {
  it('sends POST with provider and columns', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.provider).toBe('oracle')
      expect(body.columns).toEqual(['name', 'email', 'phone'])
      return jsonResponse({
        resolutions: [
          { column: 'name', entity: 'Customer', cdf_field: 'display_name', confidence: 0.95 },
        ],
        entities_needed: ['Customer'],
        unmapped: ['phone'],
        total: 3,
        mapped: 2,
      })
    })

    const result = await erpConnectorAPI.schemaResolve('oracle', ['name', 'email', 'phone'])
    expect(result.resolutions).toHaveLength(1)
    expect(result.unmapped).toContain('phone')
    expect(result.mapped).toBe(2)
  })
})

// ─── multiExport ─────────────────────────────────────────────────────────────
describe('erpConnectorAPI.multiExport', () => {
  it('sends POST with column resolutions', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.provider).toBe('quickbooks')
      expect(body.upload_id).toBe('upload-1')
      expect(body.column_resolutions).toHaveLength(1)
      return jsonResponse({ status: 'processing' })
    })

    const result = await erpConnectorAPI.multiExport(
      'quickbooks',
      'upload-1',
      [{ column: 'name', entity: 'Customer', cdf_field: 'DisplayName' }]
    )
    expect(result.status).toBe('processing')
  })
})

// ─── multiExportStatus ───────────────────────────────────────────────────────
describe('erpConnectorAPI.multiExportStatus', () => {
  it('calls GET with provider and upload_id params', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('provider=quickbooks')
      expect(url).toContain('upload_id=upload-1')
      return jsonResponse({
        provider: 'quickbooks',
        status: 'done',
        entities: [{ entity: 'Customer', status: 'done', success: 50, failed: 0 }],
      })
    })

    const result = await erpConnectorAPI.multiExportStatus('quickbooks', 'upload-1')
    expect(result.status).toBe('done')
    expect(result.entities).toHaveLength(1)
  })
})

// ─── Error handling & retries ────────────────────────────────────────────────
describe('ERPConnectorService — error handling', () => {
  it('throws on non-OK response with error message', async () => {
    mockFetch(async () => jsonResponse({ error: 'Provider not found' }, 404))

    await expect(erpConnectorAPI.listERPs()).rejects.toThrow('Provider not found')
  })

  it('throws with HTTP status when no error field', async () => {
    mockFetch(async () => jsonResponse({}, 500))

    await expect(erpConnectorAPI.listERPs()).rejects.toThrow('HTTP 500')
  })

  it('has 60s timeout via AbortController', async () => {
    // We can't easily test the timeout fires, but we can verify AbortSignal is passed
    mockFetch(async (_url: string, opts: RequestInit) => {
      expect(opts.signal).toBeDefined()
      return jsonResponse({ erps: [], connectors: [] })
    })

    await erpConnectorAPI.listERPs()
  })
})
