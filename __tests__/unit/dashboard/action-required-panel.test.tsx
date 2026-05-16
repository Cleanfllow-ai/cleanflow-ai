/**
 * Unit tests for ActionRequiredPanel
 * Covers: renders null when nothing needs attention, failed/quarantined counts, navigation
 */
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ActionRequiredPanel } from '@/modules/dashboard/components/action-required-panel'
import type { FileStatusResponse } from '@/modules/files/types/file.types'

function mkFile(overrides: Partial<FileStatusResponse>): FileStatusResponse {
  return {
    upload_id: 'uid-' + Math.random().toString(36).slice(2),
    status: 'DQ_FIXED',
    rows_quarantined: 0,
    ...overrides,
  } as FileStatusResponse
}

afterEach(() => mockPush.mockReset())

describe('ActionRequiredPanel', () => {
  it('renders nothing when all files are clean and none processing', () => {
    const { container } = render(
      <ActionRequiredPanel files={[mkFile({ status: 'DQ_FIXED', rows_quarantined: 0 })]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders when there are failed files', () => {
    render(
      <ActionRequiredPanel files={[mkFile({ status: 'DQ_FAILED' })]} />
    )
    expect(screen.getByText(/1 file/i)).toBeInTheDocument()
    expect(screen.getByText(/need attention/i)).toBeInTheDocument()
  })

  it('shows "1 failed" detail for a single failed file', () => {
    render(
      <ActionRequiredPanel files={[mkFile({ status: 'DQ_FAILED' })]} />
    )
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument()
  })

  it('shows "with quarantined rows" detail for DQ_FIXED files with quarantine rows', () => {
    render(
      <ActionRequiredPanel files={[mkFile({ status: 'DQ_FIXED', rows_quarantined: 10 })]} />
    )
    expect(screen.getByText(/with quarantined rows/i)).toBeInTheDocument()
  })

  it('shows processing count when files are running', () => {
    render(
      <ActionRequiredPanel
        files={[
          mkFile({ status: 'DQ_FAILED' }),
          mkFile({ status: 'DQ_RUNNING' }),
        ]}
      />
    )
    expect(screen.getByText(/1 processing/i)).toBeInTheDocument()
  })

  it('clicking View All navigates to /files?status=attention', () => {
    render(
      <ActionRequiredPanel files={[mkFile({ status: 'DQ_FAILED' })]} />
    )
    fireEvent.click(screen.getByRole('button', { name: /view all/i }))
    expect(mockPush).toHaveBeenCalledWith('/files?status=attention')
  })

  it('uses plural "files" when total > 1', () => {
    render(
      <ActionRequiredPanel
        files={[mkFile({ status: 'DQ_FAILED' }), mkFile({ status: 'REJECTED' })]}
      />
    )
    expect(screen.getByText(/2 files/i)).toBeInTheDocument()
  })

  it('uses singular "file" when total = 1', () => {
    render(
      <ActionRequiredPanel files={[mkFile({ status: 'DQ_FAILED' })]} />
    )
    expect(screen.getByText(/1 file\b/i)).toBeInTheDocument()
  })
})
