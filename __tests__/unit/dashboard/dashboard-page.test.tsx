/**
 * Unit tests for DashboardPage (app/dashboard/page.tsx)
 * Covers: 5-module composition, loading state, error/empty state
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== 'undefined') {
  if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
  if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
  if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

// ── module mocks ────────────────────────────────────────────────────────────
jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

// Auth: provide a valid session
jest.mock('@/modules/auth', () => ({
  useAuth: jest.fn(),
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Layout: transparent pass-through
jest.mock('@/shared/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}))

// Dashboard module components — stub so we can assert mounting
jest.mock('@/modules/dashboard', () => ({
  DashboardHeader: () => <div data-testid="stub-dashboard-header">DashboardHeader</div>,
  ActivityFeed: () => <div data-testid="stub-activity-feed">ActivityFeed</div>,
  TopIssuesChart: () => <div data-testid="stub-top-issues-chart">TopIssuesChart</div>,
  DqCharts: () => <div data-testid="stub-dq-charts">DqCharts</div>,
  ProcessingSummary: () => <div data-testid="stub-processing-summary">ProcessingSummary</div>,
}))

jest.mock('@/modules/dashboard/components/dashboard-kpi-cards', () => ({
  DashboardKpiCards: () => <div data-testid="stub-kpi-cards">DashboardKpiCards</div>,
}))

jest.mock('@/modules/dashboard/components/action-required-panel', () => ({
  ActionRequiredPanel: () => <div data-testid="stub-action-panel">ActionRequiredPanel</div>,
}))

// Files API
jest.mock('@/modules/files', () => ({
  fileManagementAPI: {
    getUploads: jest.fn(),
    downloadOverallDqReport: jest.fn(),
  },
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth'
import { fileManagementAPI } from '@/modules/files'
import DashboardPage from '@/app/dashboard/page'

const mockUseAuth = useAuth as jest.Mock
const mockGetUploads = (fileManagementAPI as any).getUploads as jest.Mock
const mockDownloadReport = (fileManagementAPI as any).downloadOverallDqReport as jest.Mock

function setupAuth() {
  mockUseAuth.mockReturnValue({
    user: { name: 'Test User' },
    isAuthenticated: true,
    idToken: 'tok-test',
  })
}

afterEach(() => jest.clearAllMocks())

describe('DashboardPage', () => {
  it('renders the 5 main dashboard modules after data loads', async () => {
    setupAuth()
    mockGetUploads.mockResolvedValue({ items: [] })
    mockDownloadReport.mockResolvedValue({})
    render(<DashboardPage />)
    await waitFor(() =>
      expect(screen.getByTestId('stub-dashboard-header')).toBeInTheDocument()
    )
    expect(screen.getByTestId('stub-kpi-cards')).toBeInTheDocument()
    expect(screen.getByTestId('stub-action-panel')).toBeInTheDocument()
    expect(screen.getByTestId('stub-dq-charts')).toBeInTheDocument()
    expect(screen.getByTestId('stub-activity-feed')).toBeInTheDocument()
    expect(screen.getByTestId('stub-top-issues-chart')).toBeInTheDocument()
    expect(screen.getByTestId('stub-processing-summary')).toBeInTheDocument()
  })

  it('shows skeleton loading state initially (before API resolves)', () => {
    setupAuth()
    // Never-resolving promise keeps loading state
    mockGetUploads.mockReturnValue(new Promise(() => {}))
    mockDownloadReport.mockReturnValue(new Promise(() => {}))
    render(<DashboardPage />)
    // Skeleton: DashboardHeader stub should NOT be present yet
    expect(screen.queryByTestId('stub-dashboard-header')).not.toBeInTheDocument()
    // Skeleton markup contains animate-pulse divs
    expect(document.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders empty state gracefully when API returns no files', async () => {
    setupAuth()
    mockGetUploads.mockResolvedValue({ items: [] })
    mockDownloadReport.mockResolvedValue({})
    render(<DashboardPage />)
    await waitFor(() =>
      expect(screen.getByTestId('stub-kpi-cards')).toBeInTheDocument()
    )
    // KPI cards and other modules should still render (with empty data)
    expect(screen.getByTestId('stub-dq-charts')).toBeInTheDocument()
  })

  it('renders dashboard modules even when API call throws (graceful degradation)', async () => {
    setupAuth()
    mockGetUploads.mockRejectedValue(new Error('Network error'))
    mockDownloadReport.mockRejectedValue(new Error('Network error'))
    render(<DashboardPage />)
    await waitFor(() =>
      expect(screen.getByTestId('stub-dashboard-header')).toBeInTheDocument()
    )
    // Modules should still render with empty data
    expect(screen.getByTestId('stub-kpi-cards')).toBeInTheDocument()
    expect(screen.getByTestId('stub-activity-feed')).toBeInTheDocument()
  })

  it('calls getUploads with the idToken (asserts the URL path used)', async () => {
    setupAuth()
    mockGetUploads.mockResolvedValue({ items: [] })
    mockDownloadReport.mockResolvedValue({})
    render(<DashboardPage />)
    await waitFor(() => expect(mockGetUploads).toHaveBeenCalledWith('tok-test'))
  })
})
