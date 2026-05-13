/**
 * Unit tests for async DELETE /uploads/{id} (202 + Location) + polling.
 *
 * Covers four cases:
 *   1. Sync 200 path still works (back-compat) — returns { accepted: false }.
 *   2. 202 response → returns { accepted: true, operation_id }.
 *   3. pollDeleteOperation polls GET /operations/{id} until status=completed.
 *   4. Failed operation status surfaces as a thrown ApiError.
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

import { deleteUpload, pollDeleteOperation } from '@/modules/files/api/file-upload-api'
import { ApiError } from '@/modules/shared/api-error'

const originalFetch = global.fetch
function mockFetch(impl: (...args: any[]) => Promise<Response>) {
  global.fetch = jest.fn(impl) as any
}
afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

describe('deleteUpload — async 202 + Location header', () => {
  it('back-compat: sync 200 returns { accepted: false }', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const result = await deleteUpload('upl-1', 'tok')
    expect(result.accepted).toBe(false)
    expect(result.operation_id).toBeUndefined()
  })

  it('202 → returns { accepted: true, operation_id } parsed from Location header', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({}), {
        status: 202,
        headers: {
          'Content-Type': 'application/json',
          Location: '/operations/op-abc123',
        },
      }),
    )
    const result = await deleteUpload('upl-2', 'tok')
    expect(result.accepted).toBe(true)
    expect(result.operation_id).toBe('op-abc123')
    expect(result.operation_location).toBe('/operations/op-abc123')
  })

  it('pollDeleteOperation: polls until status=completed', async () => {
    const calls: string[] = []
    mockFetch(async (url: string) => {
      calls.push(url)
      const pending = calls.length < 3
      return new Response(
        JSON.stringify({
          operation_id: 'op-1',
          status: pending ? 'pending' : 'completed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    const status = await pollDeleteOperation('op-1', 'tok', {
      intervalMs: 5,
      maxAttempts: 10,
    })
    expect(status.status).toBe('completed')
    expect(calls.length).toBe(3)
    expect(calls[0]).toContain('/operations/op-1')
  })

  it('pollDeleteOperation: throws ApiError when status=failed', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({
          operation_id: 'op-2',
          status: 'failed',
          error: 'bucket gone',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await expect(
      pollDeleteOperation('op-2', 'tok', { intervalMs: 1, maxAttempts: 3 }),
    ).rejects.toThrow(ApiError)
  })
})
