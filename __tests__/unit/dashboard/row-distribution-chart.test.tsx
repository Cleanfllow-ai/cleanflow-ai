/**
 * Unit tests for RowDistributionChart — fix(fe/dashboard): clamp negative
 * pie values so recharts doesn't crash.
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RowDistributionChart } from '@/modules/dashboard/components/charts/row-distribution-chart'

describe('RowDistributionChart', () => {
  it('renders without crashing when rows_fixed > rows_out (negative validated)', () => {
    // validatedRaw = 50 - 200 = -150 → should be clamped to 0 and the slice
    // dropped by the `value > 0` filter; recharts must not see a negative.
    expect(() => {
      render(
        <RowDistributionChart
          totalRowsOut={50}
          totalRowsFixed={200}
          totalRowsQuarantined={10}
        />,
      )
    }).not.toThrow()
  })

  it('renders empty-state copy when all values clamp to zero', () => {
    render(
      <RowDistributionChart
        totalRowsOut={0}
        totalRowsFixed={0}
        totalRowsQuarantined={0}
      />,
    )
    expect(screen.getByText(/no records available/i)).toBeInTheDocument()
  })

  it('renders the chart when at least one slice is positive', () => {
    render(
      <RowDistributionChart
        totalRowsOut={100}
        totalRowsFixed={20}
        totalRowsQuarantined={5}
      />,
    )
    // Empty-state copy must NOT be visible.
    expect(screen.queryByText(/no records available/i)).not.toBeInTheDocument()
  })
})
