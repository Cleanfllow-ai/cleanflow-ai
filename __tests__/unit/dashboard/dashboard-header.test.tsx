/**
 * Unit tests for DashboardHeader
 * Covers: welcome greeting, refresh button, export button, unauthenticated fallback
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/modules/auth', () => ({
  useAuth: jest.fn(),
}))
jest.mock('@/modules/files', () => ({
  fileManagementAPI: {
    downloadOverallDqReport: jest.fn(),
  },
}))
jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth'
import { fileManagementAPI } from '@/modules/files'
import { DashboardHeader } from '@/modules/dashboard/components/dashboard-header'

const mockUseAuth = useAuth as jest.Mock
const mockApi = fileManagementAPI as { downloadOverallDqReport: jest.Mock }

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { name: 'Alice Johnson' },
    isAuthenticated: true,
    idToken: 'tok-abc',
  })
})

afterEach(() => jest.clearAllMocks())

describe('DashboardHeader', () => {
  it('renders personalised welcome with first name when authenticated', () => {
    render(<DashboardHeader />)
    expect(screen.getByText(/Welcome back, Alice/i)).toBeInTheDocument()
  })

  it('renders generic "Dashboard" title when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, idToken: null })
    render(<DashboardHeader />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('refresh button is present and calls onRefresh callback', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined)
    render(<DashboardHeader onRefresh={onRefresh} />)
    const btn = screen.getByRole('button', { name: /refresh/i })
    expect(btn).toBeInTheDocument()
    await act(async () => { fireEvent.click(btn) })
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  })

  it('download report button is present', () => {
    render(<DashboardHeader />)
    expect(screen.getByRole('button', { name: /download report/i })).toBeInTheDocument()
  })

  it('download report calls fileManagementAPI.downloadOverallDqReport with the idToken', async () => {
    mockApi.downloadOverallDqReport.mockResolvedValue({ top_issues: [] })
    // jsdom doesn't provide URL.createObjectURL — define stubs directly on globalThis
    const origCreate = (globalThis as any).URL?.createObjectURL
    const origRevoke = (globalThis as any).URL?.revokeObjectURL
    ;(globalThis as any).URL = (globalThis as any).URL || {}
    ;(globalThis as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:test')
    ;(globalThis as any).URL.revokeObjectURL = jest.fn()
    render(<DashboardHeader />)
    const btn = screen.getByRole('button', { name: /download report/i })
    await act(async () => { fireEvent.click(btn) })
    await waitFor(() =>
      expect(mockApi.downloadOverallDqReport).toHaveBeenCalledWith('tok-abc')
    )
    ;(globalThis as any).URL.createObjectURL = origCreate
    ;(globalThis as any).URL.revokeObjectURL = origRevoke
  })
})
