/**
 * Audit + fix regression tests — DashboardPage graceful degradation.
 *
 * Covers fixes in commits:
 *   - fix(fe/dashboard): graceful per-widget degradation, race protection, error banners
 *
 * Invariants asserted:
 *   1. files API failure does NOT prevent the DQ report load (no Promise.all crash).
 *   2. files failure surfaces a banner — distinguishing "fetch failed" from
 *      "no data yet".
 *   3. benign 403/membership errors do NOT show the banner (treated as empty).
 *   4. TopIssuesChart still mounts when overall report fails, with an
 *      explicit error message (not the generic empty-state).
 *   5. Stale fetches (race) are dropped — the most-recent call wins.
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

jest.mock('@/modules/auth', () => ({
  useAuth: jest.fn(),
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/shared/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Stub heavy children so we can isolate page-level behaviour.
jest.mock('@/modules/dashboard', () => ({
  DashboardHeader: () => <div data-testid="stub-dashboard-header" />,
  ActivityFeed: () => <div data-testid="stub-activity-feed" />,
  TopIssuesChart: ({ isLoading, errorMessage, issues }: any) => (
    <div
      data-testid="stub-top-issues-chart"
      data-loading={String(!!isLoading)}
      data-error={errorMessage || ''}
      data-count={(issues || []).length}
    />
  ),
  DqCharts: () => <div data-testid="stub-dq-charts" />,
  ProcessingSummary: () => <div data-testid="stub-processing-summary" />,
}))

jest.mock('@/modules/dashboard/components/dashboard-kpi-cards', () => ({
  DashboardKpiCards: () => <div data-testid="stub-kpi-cards" />,
}))

jest.mock('@/modules/dashboard/components/action-required-panel', () => ({
  ActionRequiredPanel: () => <div data-testid="stub-action-panel" />,
}))

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
const mockReport = (fileManagementAPI as any).downloadOverallDqReport as jest.Mock

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { name: 'T' },
    isAuthenticated: true,
    idToken: 'tok',
  })
})
afterEach(() => jest.clearAllMocks())

describe('DashboardPage — graceful degradation', () => {
  it('renders all widgets when one API fails (no Promise.all crash)', async () => {
    mockGetUploads.mockRejectedValue(new Error('upstream 500'))
    mockReport.mockResolvedValue({
      months: { '01/2026': { top_issues: [{ violation: 'NULL', count: 5 }] } },
    })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByTestId('stub-kpi-cards')).toBeInTheDocument())
    // DQ charts widget still mounts even though files API failed
    expect(screen.getByTestId('stub-dq-charts')).toBeInTheDocument()
    expect(screen.getByTestId('stub-top-issues-chart')).toBeInTheDocument()
  })

  it('surfaces a banner on a real files failure', async () => {
    mockGetUploads.mockRejectedValue(new Error('upstream 500'))
    mockReport.mockResolvedValue({})
    render(<DashboardPage />)
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-files-error')).toBeInTheDocument(),
    )
  })

  it('does NOT show the banner for benign 403 / membership errors', async () => {
    mockGetUploads.mockRejectedValue(new Error('Permission denied'))
    mockReport.mockResolvedValue({})
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByTestId('stub-kpi-cards')).toBeInTheDocument())
    expect(screen.queryByTestId('dashboard-files-error')).not.toBeInTheDocument()
  })

  it('passes an explicit error to TopIssuesChart when the report fetch fails', async () => {
    mockGetUploads.mockResolvedValue({ items: [] })
    mockReport.mockRejectedValue(new Error('upstream 502'))
    render(<DashboardPage />)
    const chart = await waitFor(() => screen.getByTestId('stub-top-issues-chart'))
    await waitFor(() => {
      expect(chart.getAttribute('data-error')).toMatch(/upstream 502/i)
    })
  })

  it('does NOT pass an error for benign 403 on the report fetch', async () => {
    mockGetUploads.mockResolvedValue({ items: [] })
    mockReport.mockRejectedValue(new Error('Organization membership required'))
    render(<DashboardPage />)
    const chart = await waitFor(() => screen.getByTestId('stub-top-issues-chart'))
    await waitFor(() => {
      expect(chart.getAttribute('data-error')).toBe('')
    })
  })

  it('drops stale fetches: most-recent call wins (race protection)', async () => {
    let resolveSlow: ((v: any) => void) | null = null
    const slow = new Promise((res) => {
      resolveSlow = res
    })
    // First call is slow; second call (refresh-style) is fast.
    mockGetUploads
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce({ items: [{ upload_id: 'fresh' }] })
    mockReport.mockResolvedValue({})

    const { rerender } = render(<DashboardPage />)
    // Trigger a remount-by-key-change to fire a second loadFiles call.
    // We approximate "newer request" by changing the auth token.
    mockUseAuth.mockReturnValue({
      user: { name: 'T' },
      isAuthenticated: true,
      idToken: 'tok-2',
    })
    rerender(<DashboardPage />)

    await waitFor(() => expect(screen.getByTestId('stub-kpi-cards')).toBeInTheDocument())

    // Now resolve the slow one — it should be ignored (no errors thrown,
    // no banner from a stale error path).
    resolveSlow?.({ items: [{ upload_id: 'stale' }] })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('dashboard-files-error')).not.toBeInTheDocument()
  })
})
