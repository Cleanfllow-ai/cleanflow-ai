/**
 * Unit tests for async Find & Replace operations poll wiring.
 *
 * 1) Submit returns 202 + operation_id (synthesised Location)
 * 2) Polling transitions PENDING → COMPLETED
 * 3) Cancel via AbortSignal aborts the poll loop
 * 4) FAILED_TERMINAL surfaces error_msg
 * 5) Skipped-rows tab populates from result
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))
const makeRequest = jest.fn()
jest.mock('@/modules/files/api/file-upload-api', () => ({
  makeRequest: (...a: any[]) => makeRequest(...a),
}))
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/components/ui/select', () => {
  const R = require('react')
  return {
    Select: ({ children }: any) => R.createElement('div', null, children),
    SelectContent: ({ children }: any) => R.createElement('div', null, children),
    SelectItem: ({ children }: any) => R.createElement('div', null, children),
    SelectTrigger: ({ children }: any) => R.createElement('div', null, children),
    SelectValue: ({ placeholder }: any) => R.createElement('span', null, placeholder),
  }
})
jest.mock('@/components/ui/tabs', () => {
  const R = require('react')
  return {
    Tabs: ({ children }: any) => R.createElement('div', null, children),
    TabsList: ({ children }: any) => R.createElement('div', null, children),
    TabsTrigger: ({ children, value }: any) => R.createElement('button', { 'data-tab': value }, children),
    TabsContent: ({ children, value, ...rest }: any) =>
      R.createElement('div', { 'data-tab-content': value, ...rest }, children),
  }
})

import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import { submitFindReplaceAsync } from '@/modules/files/api/file-quarantine-api'
import { useQuarantineFindReplace } from '@/modules/files/hooks/use-quarantine-find-replace'
import { QuarantineFindReplacePanel } from '@/modules/files/components/quarantine-editor/quarantine-find-replace-panel'

const SUBMIT = {
  type: 'find_replace' as const,
  scope: 'ENTIRE_QUARANTINE' as const,
  session_id: 'sess-1',
  find_pattern: 'foo',
  replace_pattern: 'bar',
}
afterEach(() => { makeRequest.mockReset(); jest.useRealTimers() })

it('submit returns 202 + operation_id with synthesised Location', async () => {
  makeRequest.mockResolvedValueOnce({ operation_id: 'op-123', status: 'PENDING', async: true })
  const resp = await submitFindReplaceAsync('upload-1', 'tok', SUBMIT)
  expect(resp.operation_id).toBe('op-123')
  expect(resp.location).toBe('/files/upload-1/quarantined/operations/op-123')
  const [endpoint, _t, opts] = makeRequest.mock.calls[0]
  expect(endpoint).toBe('/files/upload-1/quarantined/find-replace')
  const parsed = JSON.parse(opts.body)
  expect(parsed.scope).toBe('ENTIRE_QUARANTINE')
  expect(parsed.search).toBe('foo')
  expect(parsed.replace).toBe('bar')
})

it('polling transitions PENDING → RUNNING → COMPLETED', async () => {
  jest.useFakeTimers()
  makeRequest
    .mockResolvedValueOnce({ operation_id: 'op-1', status: 'PENDING', async: true })
    .mockResolvedValueOnce({
      operation_id: 'op-1', status: 'RUNNING', kind: 'find_replace',
      progress: { done: 50, total: 100, percent: 50 },
      started_at: 't0', finished_at: null, result: {},
    })
    .mockResolvedValueOnce({
      operation_id: 'op-1', status: 'COMPLETED', kind: 'find_replace',
      progress: { done: 100, total: 100, percent: 100 },
      started_at: 't0', finished_at: 't1',
      result: { applied_count: 100, skipped_count: 3, failed_count: 0 },
    })
  const { result } = renderHook(() => useQuarantineFindReplace({ uploadId: 'u1', authToken: 'tok' }))
  let final: any
  await act(async () => {
    const p = result.current.submitAndPoll(SUBMIT)
    await jest.advanceTimersByTimeAsync(1500)
    await jest.advanceTimersByTimeAsync(1500)
    final = await p
  })
  expect(final.status).toBe('COMPLETED')
  expect(final.progress).toEqual({ applied: 100, total: 100, percent: 100 })
  expect(final.result.applied_count).toBe(100)
  expect(final.result.skipped_count).toBe(3)
})

it('cancel via AbortSignal stops the poll loop', async () => {
  jest.useFakeTimers()
  makeRequest
    .mockResolvedValueOnce({ operation_id: 'op-2', status: 'PENDING', async: true })
    .mockResolvedValueOnce({
      operation_id: 'op-2', status: 'RUNNING', kind: 'find_replace',
      progress: { done: 1, total: 10, percent: 10 },
      started_at: 't0', finished_at: null, result: {},
    })
  const { result } = renderHook(() => useQuarantineFindReplace({ uploadId: 'u1', authToken: 'tok' }))
  const ctrl = new AbortController()
  let final: any
  await act(async () => {
    const p = result.current.submitAndPoll(SUBMIT, { signal: ctrl.signal })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    ctrl.abort()
    await jest.advanceTimersByTimeAsync(1500)
    final = await p
  })
  expect(final.status).toBe('cancelled')
  expect(makeRequest).toHaveBeenCalledTimes(2)
})

it('FAILED_TERMINAL surfaces error_msg', async () => {
  jest.useFakeTimers()
  makeRequest
    .mockResolvedValueOnce({ operation_id: 'op-3', status: 'PENDING', async: true })
    .mockResolvedValueOnce({
      operation_id: 'op-3', status: 'FAILED_TERMINAL', kind: 'find_replace',
      progress: { done: 0, total: 0, percent: 0 },
      started_at: 't0', finished_at: 't1',
      result: { error_msg: 'shard 7 timed out' },
    })
  const { result } = renderHook(() => useQuarantineFindReplace({ uploadId: 'u1', authToken: 'tok' }))
  let final: any
  await act(async () => {
    const p = result.current.submitAndPoll(SUBMIT)
    await jest.advanceTimersByTimeAsync(1500)
    final = await p
  })
  expect(final.status).toBe('FAILED_TERMINAL')
  expect(final.error).toBe('shard 7 timed out')
})

it('skipped-rows tab populates from result', async () => {
  jest.useFakeTimers()
  makeRequest
    .mockResolvedValueOnce({ operation_id: 'op-4', status: 'PENDING', async: true })
    .mockResolvedValueOnce({
      operation_id: 'op-4', status: 'COMPLETED', kind: 'find_replace',
      progress: { done: 5, total: 5, percent: 100 },
      started_at: 't0', finished_at: 't1',
      result: {
        applied_count: 5, skipped_count: 2, failed_count: 0,
        skipped_rows: [
          { row_id: 'r-001', reason: 'locked' },
          { row_id: 'r-042', reason: 'locked' },
        ],
      },
    })
  const noop = () => undefined
  render(
    <QuarantineFindReplacePanel
      searchTerm="foo" replaceTerm="bar" column={null} matchCase={false}
      totalMatches={5} currentIndex={0} truncated={false} loading={false}
      columns={['name', 'email']}
      onSearchTermChange={noop} onReplaceTermChange={noop} onColumnChange={noop}
      onMatchCaseChange={noop} onNext={noop} onPrevious={noop}
      onReplaceCurrent={noop}
      onReplaceAll={async () => ({ replaced: 0, skipped: 0 })}
      onClose={noop}
      uploadId="u1" authToken="tok" sessionId="sess-1"
      asyncScope="ENTIRE_QUARANTINE"
    />
  )
  await act(async () => {
    screen.getByTestId('replace-all-btn').click()
    await jest.advanceTimersByTimeAsync(1500)
  })
  await waitFor(() => expect(screen.getByTestId('skipped-rows-tab')).toBeInTheDocument())
  const tab = screen.getByTestId('skipped-rows-tab')
  expect(tab.textContent).toContain('r-001')
  expect(tab.textContent).toContain('r-042')
})
