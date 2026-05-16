/**
 * Unit tests for ProfessionalChartsCarousel — verifies the carousel
 * consumes the BE `processing_trend` envelope and no longer fabricates
 * data via `buildSyntheticTrendData` / `Math.sin` noise.
 *
 * Critical assertion: when the BE returns all-zero buckets, the chart
 * shows the empty-state, NOT a synthetic trend.
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

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
    Area: stub('area'),
    AreaChart: stub('area-chart'),
    ComposedChart: stub('composed-chart'),
  }
})

const mockUseDashboardSummary = jest.fn()
jest.mock('@/modules/dashboard/hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => mockUseDashboardSummary(),
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ProfessionalChartsCarousel } from '@/modules/dashboard/components/professional-charts-carousel'
import type { ProcessingTrend } from '@/modules/dashboard/types/dashboard-summary.types'

const EMPTY_TREND: ProcessingTrend = {
  day: Array.from({ length: 8 }, (_, i) => ({
    key: `${i * 3}`.padStart(2, '0'),
    period: `${i * 3} AM`,
    clean: 0,
    fixed: 0,
    quarantined: 0,
  })),
  week: Array.from({ length: 7 }, (_, i) => ({
    key: `2026-05-${String(i + 8).padStart(2, '0')}`,
    period: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    clean: 0,
    fixed: 0,
    quarantined: 0,
  })),
  month: Array.from({ length: 6 }, (_, i) => ({
    key: `2026-${String(i + 1).padStart(2, '0')}`,
    period: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
    clean: 0,
    fixed: 0,
    quarantined: 0,
  })),
}

const REAL_TREND: ProcessingTrend = {
  ...EMPTY_TREND,
  month: [
    ...EMPTY_TREND.month.slice(0, 5),
    { key: '2026-06', period: 'Jun', clean: 800, fixed: 150, quarantined: 50 },
  ],
}

afterEach(() => jest.clearAllMocks())

describe('ProfessionalChartsCarousel', () => {
  it('shows the loading state while the dashboard summary is fetching', () => {
    mockUseDashboardSummary.mockReturnValue({ data: null, isLoading: true, error: null, refresh: jest.fn() })
    render(<ProfessionalChartsCarousel files={[]} />)
    expect(screen.getByTestId('processing-trend-loading')).toBeInTheDocument()
  })

  it('shows the error state when the dashboard summary fetch fails', () => {
    mockUseDashboardSummary.mockReturnValue({ data: null, isLoading: false, error: new Error('boom'), refresh: jest.fn() })
    render(<ProfessionalChartsCarousel files={[]} />)
    expect(screen.getByTestId('processing-trend-error')).toBeInTheDocument()
  })

  it('shows the empty-state (NOT synthetic data) when all BE buckets are zero', () => {
    mockUseDashboardSummary.mockReturnValue({
      data: { topbar: { rows_processed_mtd: 0, files_completed_mtd: 0, last_file: null },
              recent_files: [], dq_score_trend: [], recent_augmentations: [],
              processing_trend: EMPTY_TREND },
      isLoading: false, error: null, refresh: jest.fn(),
    })
    render(<ProfessionalChartsCarousel files={[]} />)
    expect(screen.getByTestId('processing-trend-empty')).toBeInTheDocument()
    // The synthetic-data code is gone — assert the empty state is visible
    // and the recharts container is NOT rendered.
    expect(screen.queryByTestId('recharts-composed-chart')).not.toBeInTheDocument()
  })

  it('renders the chart when the BE returns at least one non-zero bucket', () => {
    mockUseDashboardSummary.mockReturnValue({
      data: { topbar: { rows_processed_mtd: 1000, files_completed_mtd: 1, last_file: null },
              recent_files: [], dq_score_trend: [], recent_augmentations: [],
              processing_trend: REAL_TREND },
      isLoading: false, error: null, refresh: jest.fn(),
    })
    render(<ProfessionalChartsCarousel files={[]} />)
    expect(screen.getByTestId('recharts-composed-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('processing-trend-empty')).not.toBeInTheDocument()
  })

  it('accepts a direct processingTrend prop for test/Storybook injection', () => {
    // The hook is wired but the override takes precedence — useful for visual
    // regression suites that don't want the auth/network harness.
    mockUseDashboardSummary.mockReturnValue({ data: null, isLoading: true, error: null, refresh: jest.fn() })
    render(<ProfessionalChartsCarousel files={[]} processingTrend={REAL_TREND} />)
    expect(screen.getByTestId('recharts-composed-chart')).toBeInTheDocument()
  })
})
