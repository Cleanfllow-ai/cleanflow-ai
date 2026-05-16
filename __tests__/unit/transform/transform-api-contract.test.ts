/**
 * Unit tests for ERPTransformAPI (erp-transform-api.ts)
 * Asserts: correct URL paths, HTTP methods, FormData field names, JSON headers
 *
 * Note: NEXT_PUBLIC_API_BASE_URL is baked in at module load time from the jest
 * test environment (.env.test / next.config defaults). We therefore assert on
 * the URL *path suffix* (expect.stringContaining) rather than the full URL —
 * this correctly validates the API contract (the path) while being agnostic to
 * which base URL the test env injects.
 */

// Polyfill AbortSignal.timeout for jsdom
if (!(AbortSignal as any).timeout) {
  ;(AbortSignal as any).timeout = (ms: number) => {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), ms)
    return ctrl.signal
  }
}

import { erpTransformAPI } from '@/modules/transform/api/erp-transform-api'

// Minimal fetch mock — reusable
function mockFetchOk(body: any) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
  })
}

function mockFetchError(status = 400, detail = 'bad request') {
  return jest.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ detail }),
    text: () => Promise.resolve(detail),
  })
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ERPTransformAPI — URL path contracts', () => {
  it('getHealth calls GET /health', async () => {
    const fetchMock = mockFetchOk({ status: 'ok', engine: 'polars' })
    global.fetch = fetchMock
    await erpTransformAPI.getHealth()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('getEntities calls GET /entities', async () => {
    const fetchMock = mockFetchOk(['sales_orders', 'customers'])
    global.fetch = fetchMock
    await erpTransformAPI.getEntities()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/entities'),
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('getERPs calls GET /erps', async () => {
    const fetchMock = mockFetchOk(['NetSuite', 'SAP ERP'])
    global.fetch = fetchMock
    await erpTransformAPI.getERPs()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/erps'),
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('getFormats calls GET /formats', async () => {
    const fetchMock = mockFetchOk(['json', 'csv'])
    global.fetch = fetchMock
    await erpTransformAPI.getFormats()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/formats'),
      expect.objectContaining({ signal: expect.anything() })
    )
  })
})

describe('ERPTransformAPI — POST methods + FormData', () => {
  it('transformFile calls POST /llm_pure/transform/file', async () => {
    const fetchMock = mockFetchOk({ success: true, data: [], row_count: 0, processing_time_ms: 10 })
    global.fetch = fetchMock
    const file = new File(['col1,col2\n1,2'], 'data.csv', { type: 'text/csv' })
    await erpTransformAPI.transformFile(file, { erp: 'NetSuite', entity: 'sales_orders' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/llm_pure/transform/file'),
      expect.objectContaining({ method: 'POST' })
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeInstanceOf(FormData)
    const fd = init.body as FormData
    expect(fd.get('erp')).toBe('NetSuite')
    expect(fd.get('entity')).toBe('sales_orders')
  })

  it('analyzeFile calls POST /analyze with FormData containing the file', async () => {
    const fetchMock = mockFetchOk({ column_info: { columns: [], column_count: 0, row_count: 0 }, erp_entity_suggestions: [] })
    global.fetch = fetchMock
    const file = new File(['id,name\n1,foo'], 'test.csv', { type: 'text/csv' })
    await erpTransformAPI.analyzeFile(file)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/analyze'),
      expect.objectContaining({ method: 'POST' })
    )
    const fd = fetchMock.mock.calls[0][1].body as FormData
    expect(fd.get('file')).toBe(file)
  })

  it('validateFile calls POST /validate with FormData', async () => {
    const fetchMock = mockFetchOk({ valid: true, file_format: 'csv', column_info: {}, message: 'ok' })
    global.fetch = fetchMock
    const file = new File(['id\n1'], 'f.csv', { type: 'text/csv' })
    await erpTransformAPI.validateFile(file)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/validate'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('transformJSON calls POST /llm_pure/transform with JSON Content-Type', async () => {
    const fetchMock = mockFetchOk({ success: true, data: [], row_count: 0 })
    global.fetch = fetchMock
    await erpTransformAPI.transformJSON({ data: [{ id: 1 }], auto_select_erp: true })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/llm_pure/transform'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })
})

describe('ERPTransformAPI — template endpoints', () => {
  it('getTemplate builds URL with /template/erp/{erp}/entity/{entity}', async () => {
    const fetchMock = mockFetchOk({ erp: 'NetSuite', entity: 'sales_orders', mapping: {}, cdf_schema: [] })
    global.fetch = fetchMock
    await erpTransformAPI.getTemplate('NetSuite', 'sales_orders')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/template/erp/NetSuite/entity/sales_orders')
    )
  })

  it('getEntitySchema builds URL with /template/entity/{entity}/schema', async () => {
    const fetchMock = mockFetchOk({ entity: 'customers', cdf_schema: [], field_count: 0 })
    global.fetch = fetchMock
    await erpTransformAPI.getEntitySchema('customers')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/template/entity/customers/schema')
    )
  })
})

describe('ERPTransformAPI — error propagation', () => {
  it('getHealth throws "API server is not available" on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'))
    await expect(erpTransformAPI.getHealth()).rejects.toThrow('API server is not available')
  })

  it('transformFile throws with detail message on non-ok response', async () => {
    global.fetch = mockFetchError(422, 'unsupported entity type')
    const file = new File(['data'], 'data.csv', { type: 'text/csv' })
    await expect(erpTransformAPI.transformFile(file)).rejects.toThrow('unsupported entity type')
  })

  it('transformJSON throws with detail message on non-ok response', async () => {
    global.fetch = mockFetchError(500, 'internal transform error')
    await expect(erpTransformAPI.transformJSON({ data: [] })).rejects.toThrow('internal transform error')
  })
})
