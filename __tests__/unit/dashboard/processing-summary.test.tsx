/**
 * Unit tests for ProcessingSummary — fix(fe/dashboard): exclude augmentation
 * children + clamp negative rows-out.
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ProcessingSummary } from '@/modules/dashboard/components/processing-summary'
import type { FileStatusResponse } from '@/modules/files'

const file = (over: Partial<FileStatusResponse>): FileStatusResponse =>
  ({
    upload_id: over.upload_id || Math.random().toString(36),
    status: 'DQ_FIXED',
    rows_in: 0,
    rows_fixed: 0,
    rows_quarantined: 0,
    ...over,
  } as FileStatusResponse)

describe('ProcessingSummary', () => {
  it('excludes augmentation children (parent_upload_id set) from totals', () => {
    const files: FileStatusResponse[] = [
      file({ upload_id: 'p1', rows_in: 100, rows_fixed: 10, rows_quarantined: 5 }),
      file({
        upload_id: 'c1',
        parent_upload_id: 'p1',
        rows_in: 999,
        rows_fixed: 999,
        rows_quarantined: 999,
      }),
    ]
    render(<ProcessingSummary files={files} />)
    // Input Rows should be 100 (parent only) — NOT 1099.
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.queryByText('1,099')).not.toBeInTheDocument()
  })

  it('clamps negative rows-out to zero when quarantined > rows_in', () => {
    const files = [file({ rows_in: 10, rows_fixed: 0, rows_quarantined: 100 })]
    render(<ProcessingSummary files={files} />)
    // Valid Output cell shouldn't be a negative number.
    const negativeMatches = screen.queryAllByText(/^-\d/)
    expect(negativeMatches.length).toBe(0)
  })

  it('renders zero values without crashing when no completed files', () => {
    render(<ProcessingSummary files={[]} />)
    // Four zeros — Input Rows, Valid Output, Issues Fixed, Quarantined
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })
})
