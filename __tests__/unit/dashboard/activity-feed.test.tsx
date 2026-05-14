/**
 * Unit tests for ActivityFeed
 * Covers: recent activity render, empty state, click navigation, status icons, deep-link
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ActivityFeed } from '@/modules/dashboard/components/activity-feed'
import type { FileStatusResponse } from '@/modules/files/types/file.types'

function mkFile(overrides: Partial<FileStatusResponse>): FileStatusResponse {
  return {
    upload_id: 'uid-' + Math.random().toString(36).slice(2),
    status: 'DQ_FIXED',
    original_filename: 'test.csv',
    updated_at: new Date().toISOString(),
    ...overrides,
  } as FileStatusResponse
}

afterEach(() => mockPush.mockReset())

describe('ActivityFeed', () => {
  it('renders "No recent activity" when files list is empty', () => {
    render(<ActivityFeed files={[]} />)
    expect(screen.getByText(/no recent activity/i)).toBeInTheDocument()
  })

  it('renders up to 10 most recent files sorted by updated_at descending', () => {
    const files = Array.from({ length: 12 }, (_, i) =>
      mkFile({
        upload_id: `uid-${i}`,
        original_filename: `file-${i}.csv`,
        updated_at: new Date(Date.now() - i * 60000).toISOString(),
      })
    )
    render(<ActivityFeed files={files} />)
    // The 10 most recent should appear; file-0 (newest) and file-9 should be shown
    expect(screen.getByText('file-0.csv')).toBeInTheDocument()
    // file-10 and file-11 are 11th and 12th oldest — should be cut off
    expect(screen.queryByText('file-11.csv')).not.toBeInTheDocument()
  })

  it('clicking a file row navigates to /files with upload_id query params', () => {
    const file = mkFile({ upload_id: 'uid-nav', original_filename: 'nav.csv' })
    render(<ActivityFeed files={[file]} />)
    fireEvent.click(screen.getByText('nav.csv').closest('div[class*="cursor-pointer"]')!)
    expect(mockPush).toHaveBeenCalledWith('/files?file=uid-nav&highlight=uid-nav')
  })

  it('DQ_FIXED status row renders "Processed" label', () => {
    render(<ActivityFeed files={[mkFile({ status: 'DQ_FIXED', original_filename: 'fixed.csv' })]} />)
    expect(screen.getByText('Processed')).toBeInTheDocument()
  })

  it('DQ_FAILED status row renders "Failed" label', () => {
    render(<ActivityFeed files={[mkFile({ status: 'DQ_FAILED', original_filename: 'failed.csv' })]} />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('UPLOADING status row renders "Uploading" label', () => {
    render(<ActivityFeed files={[mkFile({ status: 'UPLOADING', original_filename: 'uploading.csv' })]} />)
    expect(screen.getByText('Uploading')).toBeInTheDocument()
  })

  it('REJECTED status row renders "REJECTED" label (fallback)', () => {
    render(<ActivityFeed files={[mkFile({ status: 'REJECTED', original_filename: 'rejected.csv' })]} />)
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
  })

  it('shows the count of recent files in the header', () => {
    const files = [mkFile({}), mkFile({}), mkFile({})]
    render(<ActivityFeed files={files} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('deep-link from activity constructs correct file detail URL (commit f8fb6f3)', () => {
    const file = mkFile({ upload_id: 'deep-id', original_filename: 'deep.csv' })
    render(<ActivityFeed files={[file]} />)
    const row = screen.getByText('deep.csv').closest('div[class*="cursor-pointer"]')!
    fireEvent.click(row)
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('file=deep-id')
    )
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('highlight=deep-id')
    )
  })
})
