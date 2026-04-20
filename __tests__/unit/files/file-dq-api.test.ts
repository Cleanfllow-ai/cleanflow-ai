/**
 * Unit tests for modules/files/api/file-dq-api.ts
 * Covers: downloadDqReport, downloadOverallDqReport, getFileIssues, getDQMatrix
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

jest.mock('@/modules/files/api/file-upload-api', () => ({
  makeRequest: jest.fn(),
}))

import {
  downloadDqReport,
  downloadOverallDqReport,
  getFileIssues,
  getDQMatrix,
} from '@/modules/files/api/file-dq-api'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

const originalFetch = global.fetch
function mockFetch(impl: (...args: any[]) => Promise<Response>) {
  global.fetch = jest.fn(impl) as any
}
afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
  mockMakeRequest.mockReset()
})

// ─── downloadDqReport ────────────────────────────────────────────────────────
describe('downloadDqReport', () => {
  it('parses plain JSON response', async () => {
    const report = { score: 85, issues: [] }
    mockFetch(async () => new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }))

    const result = await downloadDqReport('upload-1', 'tok')
    expect(result).toEqual(report)
  })

  it('handles JSON envelope with base64 body', async () => {
    const inner = { score: 90, issues: ['missing'] }
    const base64Body = btoa(JSON.stringify(inner))
    const envelope = { body: base64Body }
    mockFetch(async () => new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }))

    const result = await downloadDqReport('upload-1', 'tok')
    expect(result).toEqual(inner)
  })

  it('follows presigned URL for large reports', async () => {
    const report = { score: 75, issues: ['type_mismatch'] }
    let callCount = 0
    mockFetch(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ presigned_url: 'https://bucket.s3.amazonaws.com/report.json' }),
          { status: 200, headers: { 'Content-Type': 'text/plain' } }
        )
      }
      return new Response(JSON.stringify(report), { status: 200 })
    })

    const result = await downloadDqReport('upload-1', 'tok')
    expect(callCount).toBe(2)
    expect(result).toEqual(report)
  })

  it('follows download_url key as presigned URL', async () => {
    const report = { score: 60 }
    let callCount = 0
    mockFetch(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ download_url: 'https://bucket.s3.ap-south-1.amazonaws.com/report.json' }),
          { status: 200, headers: { 'Content-Type': 'text/plain' } }
        )
      }
      return new Response(JSON.stringify(report), { status: 200 })
    })

    const result = await downloadDqReport('upload-1', 'tok')
    expect(result).toEqual(report)
  })

  it('falls through to JSON parsing when presigned URL is invalid (DEF-007)', async () => {
    // Note: This is a known defect — invalid presigned URLs don't throw because
    // the error is caught in a try-catch and falls through to JSON parsing.
    // The function returns the raw payload instead of rejecting.
    mockFetch(async () => new Response(
      JSON.stringify({ presigned_url: 'https://evil.com/steal.json' }),
      { status: 200, headers: { 'Content-Type': 'text/plain' } }
    ))

    const result = await downloadDqReport('u1', 'tok')
    // Falls through to treating payload itself as report JSON
    expect(result).toEqual({ presigned_url: 'https://evil.com/steal.json' })
  })

  it('handles plain base64 string response', async () => {
    const inner = { score: 95 }
    const base64 = btoa(JSON.stringify(inner))
    mockFetch(async () => new Response(base64, { status: 200 }))

    const result = await downloadDqReport('u1', 'tok')
    expect(result).toEqual(inner)
  })

  it('throws on non-OK response', async () => {
    mockFetch(async () => new Response('', { status: 500, statusText: 'Internal Server Error' }))

    await expect(downloadDqReport('u1', 'tok')).rejects.toThrow('DQ report download failed')
  })

  it('sends correct auth header', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token')
      return new Response(JSON.stringify({ score: 80 }), { status: 200 })
    })

    await downloadDqReport('u1', 'my-token')
  })
})

// ─── downloadOverallDqReport ─────────────────────────────────────────────────
describe('downloadOverallDqReport', () => {
  it('returns parsed JSON on success', async () => {
    const report = { total_files: 10, avg_score: 85 }
    mockFetch(async () => new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }))

    const result = await downloadOverallDqReport('tok')
    expect(result).toEqual(report)
  })

  it('returns null on 404 (new user, no reports)', async () => {
    mockFetch(async () => new Response('', { status: 404, statusText: 'Not Found' }))

    const result = await downloadOverallDqReport('tok')
    expect(result).toBeNull()
  })

  it('returns null on 401 (unauthorized)', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))

    const result = await downloadOverallDqReport('tok')
    expect(result).toBeNull()
  })

  it('returns null on 403 (permission denied)', async () => {
    mockFetch(async () => new Response(JSON.stringify({ message: 'Permission denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }))

    const result = await downloadOverallDqReport('tok')
    expect(result).toBeNull()
  })

  it('returns null when error contains "organization membership required"', async () => {
    mockFetch(async () => new Response(
      JSON.stringify({ error: 'Organization membership required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    ))

    const result = await downloadOverallDqReport('tok')
    expect(result).toBeNull()
  })

  it('throws on other error statuses (e.g. 500)', async () => {
    mockFetch(async () => new Response(JSON.stringify({}), {
      status: 500,
      statusText: 'Internal Server Error',
    }))

    await expect(downloadOverallDqReport('tok')).rejects.toThrow('Overall DQ report download failed')
  })

  it('handles base64-encoded envelope response', async () => {
    const inner = { total_files: 5, avg_score: 92 }
    const envelope = { body: btoa(JSON.stringify(inner)) }
    mockFetch(async () => new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }))

    const result = await downloadOverallDqReport('tok')
    expect(result).toEqual(inner)
  })
})

// ─── getFileIssues ───────────────────────────────────────────────────────────
describe('getFileIssues', () => {
  it('calls makeRequest with correct endpoint', async () => {
    mockMakeRequest.mockResolvedValue({ issues: [], total: 0 })

    await getFileIssues('upload-1', 'tok')

    expect(mockMakeRequest).toHaveBeenCalledWith(
      '/files/upload-1/issues',
      'tok',
      { method: 'GET' }
    )
  })

  it('passes offset and limit as query params', async () => {
    mockMakeRequest.mockResolvedValue({ issues: [], total: 0 })

    await getFileIssues('u1', 'tok', { offset: 10, limit: 25 })

    const calledEndpoint = mockMakeRequest.mock.calls[0][0]
    expect(calledEndpoint).toContain('offset=10')
    expect(calledEndpoint).toContain('limit=25')
  })

  it('passes violations as comma-separated param', async () => {
    mockMakeRequest.mockResolvedValue({ issues: [], total: 0 })

    await getFileIssues('u1', 'tok', { violations: ['R1', 'R2'] })

    const calledEndpoint = mockMakeRequest.mock.calls[0][0]
    expect(calledEndpoint).toContain('violations=R1%2CR2')
  })

  it('omits empty params', async () => {
    mockMakeRequest.mockResolvedValue({ issues: [], total: 0 })

    await getFileIssues('u1', 'tok', {})

    const calledEndpoint = mockMakeRequest.mock.calls[0][0]
    expect(calledEndpoint).toBe('/files/u1/issues')
  })

  it('omits violations when empty array', async () => {
    mockMakeRequest.mockResolvedValue({ issues: [], total: 0 })

    await getFileIssues('u1', 'tok', { violations: [] })

    const calledEndpoint = mockMakeRequest.mock.calls[0][0]
    expect(calledEndpoint).not.toContain('violations')
  })
})

// ─── getDQMatrix ─────────────────────────────────────────────────────────────
describe('getDQMatrix', () => {
  it('calls makeRequest with no params by default', async () => {
    mockMakeRequest.mockResolvedValue({ results: [], total_results: 0 })

    await getDQMatrix('u1', 'tok')

    expect(mockMakeRequest).toHaveBeenCalledWith(
      '/files/u1/dq-matrix',
      'tok',
      { method: 'GET' }
    )
  })

  it('passes limit and offset', async () => {
    mockMakeRequest.mockResolvedValue({ results: [] })

    await getDQMatrix('u1', 'tok', { limit: 50, offset: 100 })

    const endpoint = mockMakeRequest.mock.calls[0][0]
    expect(endpoint).toContain('limit=50')
    expect(endpoint).toContain('offset=100')
  })

  it('passes start and end range params', async () => {
    mockMakeRequest.mockResolvedValue({ results: [] })

    await getDQMatrix('u1', 'tok', { start: 200, end: 300 })

    const endpoint = mockMakeRequest.mock.calls[0][0]
    expect(endpoint).toContain('start=200')
    expect(endpoint).toContain('end=300')
  })

  it('passes all four params together', async () => {
    mockMakeRequest.mockResolvedValue({ results: [] })

    await getDQMatrix('u1', 'tok', { limit: 10, offset: 0, start: 5, end: 15 })

    const endpoint = mockMakeRequest.mock.calls[0][0]
    expect(endpoint).toContain('limit=10')
    expect(endpoint).toContain('offset=0')
    expect(endpoint).toContain('start=5')
    expect(endpoint).toContain('end=15')
  })
})
