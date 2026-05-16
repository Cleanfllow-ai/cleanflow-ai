/**
 * Unit tests for CustomerUsageDashboard — fix(fe/dashboard): don't leak raw
 * server error messages; render empty-state instead of `null`.
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

const mockUseSummary = jest.fn()
jest.mock('@/modules/dashboard/hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => mockUseSummary(),
}))

jest.mock('@/modules/dashboard/components/tiles/dashboard-tiles', () => ({
  RecentFilesTile: () => <div data-testid="tile-files" />,
  DqTrendTile: () => <div data-testid="tile-trend" />,
  RecentAugmentationsTile: () => <div data-testid="tile-augmentations" />,
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CustomerUsageDashboard } from '@/modules/dashboard/components/customer-usage-dashboard'

afterEach(() => mockUseSummary.mockReset())

describe('CustomerUsageDashboard', () => {
  it('renders loading skeleton with role=status', () => {
    mockUseSummary.mockReturnValue({ data: null, isLoading: true, error: null })
    render(<CustomerUsageDashboard />)
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
  })

  it('does NOT leak raw error.message on a real failure', () => {
    mockUseSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Stack trace: at line 42 of secret_module.py'),
    })
    render(<CustomerUsageDashboard />)
    const alert = screen.getByTestId('dashboard-error')
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).not.toMatch(/secret_module/i)
    expect(alert.textContent).toMatch(/please refresh/i)
  })

  it('renders an access-denied message for benign 403', () => {
    mockUseSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Permission denied'),
    })
    render(<CustomerUsageDashboard />)
    const alert = screen.getByTestId('dashboard-error')
    expect(alert.textContent).toMatch(/dashboard unavailable/i)
  })

  it('renders empty-state instead of `null` when data is missing', () => {
    mockUseSummary.mockReturnValue({ data: null, isLoading: false, error: null })
    render(<CustomerUsageDashboard />)
    expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument()
  })

  it('renders all 3 tiles when data resolves', () => {
    mockUseSummary.mockReturnValue({
      data: {
        topbar: { rows_processed_mtd: 0, files_completed_mtd: 0, last_file: null },
        recent_files: [],
        dq_score_trend: [],
        recent_augmentations: [],
      },
      isLoading: false,
      error: null,
    })
    render(<CustomerUsageDashboard />)
    expect(screen.getByTestId('tile-files')).toBeInTheDocument()
    expect(screen.getByTestId('tile-trend')).toBeInTheDocument()
    expect(screen.getByTestId('tile-augmentations')).toBeInTheDocument()
  })
})
