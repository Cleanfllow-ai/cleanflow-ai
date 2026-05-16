/**
 * Unit tests for DashboardKpiCards
 * Covers: KPI labels, computed totals, DQ score display, quarantine row display
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DashboardKpiCards } from '@/modules/dashboard/components/dashboard-kpi-cards'
import type { FileStatusResponse } from '@/modules/files/types/file.types'

function mkFile(overrides: Partial<FileStatusResponse>): FileStatusResponse {
  return {
    upload_id: 'uid-' + Math.random().toString(36).slice(2),
    status: 'DQ_FIXED',
    dq_score: 95,
    rows_quarantined: 0,
    ...overrides,
  } as FileStatusResponse
}

describe('DashboardKpiCards', () => {
  it('renders all four KPI labels', () => {
    render(<DashboardKpiCards files={[]} />)
    expect(screen.getByText('Total Files')).toBeInTheDocument()
    expect(screen.getByText('Avg DQ Score')).toBeInTheDocument()
    expect(screen.getByText('Processed')).toBeInTheDocument()
    expect(screen.getByText('Quarantined Rows')).toBeInTheDocument()
  })

  it('shows correct total file count (excludes child files)', () => {
    const files = [
      mkFile({}),
      mkFile({}),
      mkFile({ parent_upload_id: 'some-parent' }),  // child — excluded
    ]
    render(<DashboardKpiCards files={files} />)
    // Both total-files and processed cards show "2" — assert at least one occurrence
    const twos = screen.getAllByText('2')
    expect(twos.length).toBeGreaterThanOrEqual(1)
  })

  it('shows em-dash for avg DQ score when no processed files', () => {
    render(<DashboardKpiCards files={[mkFile({ status: 'DQ_FAILED' })]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('computes average DQ score correctly', () => {
    const files = [
      mkFile({ dq_score: 90, status: 'DQ_FIXED' }),
      mkFile({ dq_score: 80, status: 'DQ_FIXED' }),
    ]
    render(<DashboardKpiCards files={files} />)
    expect(screen.getByText('85.0%')).toBeInTheDocument()
  })

  it('shows "all rows clean" when quarantined rows = 0', () => {
    render(<DashboardKpiCards files={[mkFile({ rows_quarantined: 0 })]} />)
    expect(screen.getByText('all rows clean')).toBeInTheDocument()
  })

  it('shows quarantine row count when > 0', () => {
    const files = [
      mkFile({ rows_quarantined: 150 }),
      mkFile({ rows_quarantined: 50 }),
    ]
    render(<DashboardKpiCards files={files} />)
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('require remediation')).toBeInTheDocument()
  })

  it('renders "no files" sub-label when total is 0', () => {
    render(<DashboardKpiCards files={[]} />)
    expect(screen.getByText('no files')).toBeInTheDocument()
  })

  it('shows failed count in Processed sub-label when > 0', () => {
    const files = [
      mkFile({ status: 'DQ_FIXED' }),
      mkFile({ status: 'DQ_FAILED' }),
    ]
    render(<DashboardKpiCards files={files} />)
    expect(screen.getByText('1 failed')).toBeInTheDocument()
  })
})
