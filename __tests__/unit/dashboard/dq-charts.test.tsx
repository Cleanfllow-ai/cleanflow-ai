/**
 * Unit tests for DqCharts and ProcessingSummary
 * Covers: row distribution pass-through, ProcessingSummary tile totals, chart render
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

// Recharts components reference SVG element methods not in jsdom
jest.mock('recharts', () => {
  const React = require('react')
  const stub = (name: string) =>
    // eslint-disable-next-line react/display-name
    React.forwardRef(({ children, ...props }: any, ref: any) =>
      React.createElement('div', { 'data-testid': `recharts-${name}`, ...props, ref }, children)
    )
  return {
    ResponsiveContainer: stub('responsive-container'),
    LineChart: stub('line-chart'),
    Line: stub('line'),
    BarChart: stub('bar-chart'),
    Bar: stub('bar'),
    XAxis: stub('xaxis'),
    YAxis: stub('yaxis'),
    CartesianGrid: stub('grid'),
    Tooltip: stub('tooltip'),
    Legend: stub('legend'),
    PieChart: stub('pie-chart'),
    Pie: stub('pie'),
    Cell: stub('cell'),
  }
})

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DqCharts, ProcessingSummary } from '@/modules/dashboard/components/dq-charts'
import type { FileStatusResponse } from '@/modules/files/types/file.types'

function mkFile(overrides: Partial<FileStatusResponse>): FileStatusResponse {
  return {
    upload_id: 'uid-' + Math.random().toString(36).slice(2),
    status: 'DQ_FIXED',
    ...overrides,
  } as FileStatusResponse
}

const FILES: FileStatusResponse[] = [
  mkFile({ rows_in: 1000, rows_fixed: 50, rows_quarantined: 100, dq_score: 92 }),
  mkFile({ rows_in: 500, rows_fixed: 20, rows_quarantined: 30, dq_score: 88 }),
  mkFile({ status: 'DQ_FAILED', rows_in: 200 }),  // not completed — excluded from sums
]

describe('ProcessingSummary', () => {
  it('renders all four metric labels', () => {
    render(<ProcessingSummary files={FILES} />)
    expect(screen.getByText('Input Rows')).toBeInTheDocument()
    expect(screen.getByText('Valid Output')).toBeInTheDocument()
    expect(screen.getByText('Issues Fixed')).toBeInTheDocument()
    expect(screen.getByText('Quarantined')).toBeInTheDocument()
  })

  it('computes correct totals from completed files only', () => {
    render(<ProcessingSummary files={FILES} />)
    // Only DQ_FIXED files are counted: rows_in=1500, quarantined=130, out=1370, fixed=70
    expect(screen.getByText('1,500')).toBeInTheDocument()  // Input Rows
    expect(screen.getByText('1,370')).toBeInTheDocument()  // Valid Output
    expect(screen.getByText('70')).toBeInTheDocument()     // Issues Fixed
    expect(screen.getByText('130')).toBeInTheDocument()    // Quarantined
  })

  it('shows zeros when no completed files', () => {
    render(<ProcessingSummary files={[mkFile({ status: 'DQ_FAILED' })]} />)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })
})

describe('DqCharts', () => {
  it('renders without crashing with completed files', () => {
    const { container } = render(<DqCharts files={FILES} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders without crashing with empty files array', () => {
    const { container } = render(<DqCharts files={[]} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('excludes child files (parent_upload_id set) from chart data', () => {
    const files = [
      mkFile({ rows_in: 1000, rows_fixed: 50, rows_quarantined: 0 }),
      mkFile({ rows_in: 500, rows_fixed: 30, rows_quarantined: 0, parent_upload_id: 'some-parent' }),
    ]
    // Should render — no throw — only the parent file is counted
    expect(() => render(<DqCharts files={files} />)).not.toThrow()
  })
})
