/**
 * Unit tests for modules/files/api/file-export-api.ts
 * Covers: isValidS3Url, resolveExportDownload, downloadFileFromApi,
 *         exportWithColumns, getFilePreview
 */

// Mock aws-config before any imports
jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

// Mock makeRequest from file-upload-api
jest.mock('@/modules/files/api/file-upload-api', () => ({
  makeRequest: jest.fn(),
}))

import {
  downloadFileFromApi,
  exportWithColumns,
  getFilePreview,
} from '@/modules/files/api/file-export-api'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

// ─── fetch mock ──────────────────────────────────────────────────────────────
const originalFetch = global.fetch

function mockFetch(impl: (...args: any[]) => Promise<Response>) {
  global.fetch = jest.fn(impl) as any
}

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function jsonResponse(body: any, status = 200, headers: Record<string, string> = {}): Response {
  const hdrs = new Headers({ 'Content-Type': 'application/json', ...headers })
  return new Response(JSON.stringify(body), { status, headers: hdrs })
}

function blobResponse(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: new Headers({ 'Content-Type': 'text/csv' }),
  })
}

// ─── downloadFileFromApi ─────────────────────────────────────────────────────
describe('downloadFileFromApi', () => {
  it('returns blob when API responds with non-JSON (direct file)', async () => {
    mockFetch(async () => blobResponse('col1,col2\na,b'))

    const result = await downloadFileFromApi('upload-1', 'csv', 'clean', 'tok-123')
    expect(result.blob).toBeDefined()
    const text = await result.blob!.text()
    expect(text).toBe('col1,col2\na,b')
  })

  it('builds correct URL with all parameters', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('/files/upload-1/export')
      expect(url).toContain('type=csv')
      expect(url).toContain('data=clean')
      expect(url).toContain('erp=Oracle%20Fusion')
      return blobResponse('data')
    })

    await downloadFileFromApi('upload-1', 'csv', 'clean', 'tok-123', 'Oracle Fusion')
  })

  it('sends auth header', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token')
      return blobResponse('data')
    })

    await downloadFileFromApi('upload-1', 'csv', 'clean', 'my-token')
  })

  it('follows presigned URL when API returns JSON with presigned_url and small row_count', async () => {
    let callCount = 0
    mockFetch(async (url: string) => {
      callCount++
      if (callCount === 1) {
        return jsonResponse({
          presigned_url: 'https://bucket.s3.amazonaws.com/file.csv',
          filename: 'test.csv',
          row_count: 50, // small file → use inline blob path
        })
      }
      // Second call is to presigned URL
      return blobResponse('s3-content')
    })

    const result = await downloadFileFromApi('upload-1', 'csv', 'clean', 'tok')
    expect(result.blob).toBeDefined()
    expect(result.filename).toBe('test.csv')
  })

  it('returns downloadUrl when presigned_url is returned without row_count (prepared-export path)', async () => {
    // The prepared-export Lambda returns {presigned_url, filename} with no
    // size hint. JS can\'t read the X-Download-Type header through CORS until
    // expose_headers ships it, so missing row_count is treated as "large".
    let fetchCallCount = 0
    mockFetch(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return jsonResponse({
          presigned_url: 'https://bucket.s3.amazonaws.com/big.csv',
          filename: 'big.csv',
        })
      }
      throw new Error('Should not fetch S3 when row_count is missing')
    })

    const result = await downloadFileFromApi('upload-1', 'csv', 'clean', 'tok')
    expect(fetchCallCount).toBe(1)
    expect(result.downloadUrl).toBe('https://bucket.s3.amazonaws.com/big.csv')
    expect(result.blob).toBeUndefined()
    expect(result.filename).toBe('big.csv')
  })

  it('rejects invalid presigned URL (not S3)', async () => {
    mockFetch(async () => {
      return jsonResponse({ presigned_url: 'https://evil.com/malware.exe', filename: 'bad.csv' })
    })

    await expect(downloadFileFromApi('upload-1', 'csv', 'clean', 'tok')).rejects.toThrow(
      'Invalid presigned URL'
    )
  })

  it('falls back to downloadUrl when S3 fetch fails for a small file', async () => {
    let callCount = 0
    mockFetch(async () => {
      callCount++
      if (callCount === 1) {
        return jsonResponse({
          presigned_url: 'https://bucket.s3.amazonaws.com/file.csv',
          filename: 'f.csv',
          row_count: 50, // small → would use blob path, but fetch fails
        })
      }
      // S3 fetch fails
      throw new Error('Network error')
    })

    const result = await downloadFileFromApi('upload-1', 'csv', 'clean', 'tok')
    expect(result.downloadUrl).toBe('https://bucket.s3.amazonaws.com/file.csv')
    expect(result.filename).toBe('f.csv')
  })

  it('skips S3 blob fetch and returns downloadUrl when row_count exceeds threshold', async () => {
    // Large exports must not buffer into JS heap — browser should stream the
    // download natively. Previously the frontend did `await fetch(url).blob()`
    // for any size, stalling the UI for 30-60s on 100+ MB CSVs.
    let fetchCallCount = 0
    mockFetch(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return jsonResponse({
          presigned_url: 'https://bucket.s3.amazonaws.com/big.csv',
          filename: 'big.csv',
          row_count: 874_811, // ≈ 100 MB CSV
        })
      }
      throw new Error('Should not fetch S3 for large files')
    })

    const result = await downloadFileFromApi('upload-1', 'csv', 'clean', 'tok')
    expect(fetchCallCount).toBe(1) // API call only, no S3 fetch
    expect(result.downloadUrl).toBe('https://bucket.s3.amazonaws.com/big.csv')
    expect(result.blob).toBeUndefined()
    expect(result.filename).toBe('big.csv')
  })

  it('throws on non-OK response', async () => {
    mockFetch(async () => jsonResponse({ error: 'Not found' }, 404))

    await expect(downloadFileFromApi('u1', 'csv', 'clean', 'tok')).rejects.toThrow('Not found')
  })

  it('retries on 202 preparing status', async () => {
    let attempts = 0
    mockFetch(async () => {
      attempts++
      if (attempts <= 2) {
        return jsonResponse({ status: 'preparing', message: 'Wait', retry_after_ms: 10 }, 202)
      }
      return blobResponse('ready-data')
    })

    const result = await downloadFileFromApi('u1', 'csv', 'clean', 'tok')
    expect(attempts).toBe(3)
    expect(result.blob).toBeDefined()
  })

  it('wraps plain JSON body as blob when no presigned_url', async () => {
    mockFetch(async () => jsonResponse({ rows: [1, 2, 3], filename: 'data.json' }))

    const result = await downloadFileFromApi('u1', 'json', 'clean', 'tok')
    expect(result.blob).toBeDefined()
    expect(result.filename).toBe('data.json')
    // Blob.text() may not exist in jsdom — use arrayBuffer fallback or check type
    expect(result.blob).toBeTruthy()
  })
})

// ─── exportWithColumns ───────────────────────────────────────────────────────
describe('exportWithColumns', () => {
  it('sends POST with columns array', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(opts.method).toBe('POST')
      expect(body.columns).toEqual(['name', 'email'])
      expect(body.format).toBe('csv')
      expect(body.data).toBe('clean')
      return blobResponse('col-data')
    })

    await exportWithColumns('u1', 'tok', { format: 'csv', data: 'clean', columns: ['name', 'email'] })
  })

  it('converts "original" data type to "raw"', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.data).toBe('raw')
      return blobResponse('data')
    })

    await exportWithColumns('u1', 'tok', { format: 'csv', data: 'original' })
  })

  it('omits columns when empty array', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.columns).toBeUndefined()
      return blobResponse('data')
    })

    await exportWithColumns('u1', 'tok', { format: 'csv', data: 'clean', columns: [] })
  })

  it('includes columnMapping when provided', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.column_mapping).toEqual({ old_name: 'new_name' })
      return blobResponse('data')
    })

    await exportWithColumns('u1', 'tok', {
      format: 'csv',
      data: 'clean',
      columnMapping: { old_name: 'new_name' },
    })
  })

  it('includes erp and entity when provided', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.erp).toBe('Oracle')
      expect(body.entity).toBe('Invoices')
      return blobResponse('data')
    })

    await exportWithColumns('u1', 'tok', {
      format: 'csv',
      data: 'clean',
      erp: 'Oracle',
      entity: 'Invoices',
    })
  })

  it('omits empty columnMapping', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.column_mapping).toBeUndefined()
      return blobResponse('data')
    })

    await exportWithColumns('u1', 'tok', { format: 'csv', data: 'clean', columnMapping: {} })
  })
})

// ─── getFilePreview ──────────────────────────────────────────────────────────
describe('getFilePreview', () => {
  it('returns headers, sample_data, and total_rows', async () => {
    mockMakeRequest.mockResolvedValue({
      headers: ['name', 'age'],
      sample_data: [{ name: 'Alice', age: 30 }],
      total_rows: 100,
    })

    const result = await getFilePreview('u1', 'tok')
    expect(result.headers).toEqual(['name', 'age'])
    expect(result.sample_data).toHaveLength(1)
    expect(result.total_rows).toBe(100)
  })

  it('defaults to empty arrays when fields are missing', async () => {
    mockMakeRequest.mockResolvedValue({})

    const result = await getFilePreview('u1', 'tok')
    expect(result.headers).toEqual([])
    expect(result.sample_data).toEqual([])
    expect(result.total_rows).toBe(0)
  })

  it('re-throws errors for caller to handle', async () => {
    mockMakeRequest.mockRejectedValue(new Error('Network error'))

    await expect(getFilePreview('u1', 'tok')).rejects.toThrow('Network error')
  })
})
