/**
 * Unit test for DashboardHeader — fix(fe/dashboard): don't export literal
 * "null" when the DQ report API returns nothing.
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

const mockToast = jest.fn()
jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth'
import { fileManagementAPI } from '@/modules/files'
import { DashboardHeader } from '@/modules/dashboard/components/dashboard-header'

const mockUseAuth = useAuth as jest.Mock
const mockReport = (fileManagementAPI as any).downloadOverallDqReport as jest.Mock

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { name: 'Test' },
    isAuthenticated: true,
    idToken: 'tok',
  })
  mockToast.mockClear()
  mockReport.mockClear()
  // Mock URL.createObjectURL — jsdom does not implement it.
  ;(URL as any).createObjectURL = jest.fn(() => 'blob:mock')
  ;(URL as any).revokeObjectURL = jest.fn()
})

describe('DashboardHeader — export guard', () => {
  it('shows a toast (not a literal null download) when the report is null', async () => {
    mockReport.mockResolvedValue(null)
    render(<DashboardHeader />)
    fireEvent.click(screen.getByRole('button', { name: /download report/i }))
    await waitFor(() => expect(mockReport).toHaveBeenCalled())
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/nothing to export/i),
        }),
      ),
    )
    expect((URL as any).createObjectURL).not.toHaveBeenCalled()
  })

  it('downloads the JSON blob when the report is non-null', async () => {
    mockReport.mockResolvedValue({ months: {}, generated_at: '2026-05-15' })
    render(<DashboardHeader />)
    fireEvent.click(screen.getByRole('button', { name: /download report/i }))
    await waitFor(() => expect((URL as any).createObjectURL).toHaveBeenCalled())
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/exported/i) }),
      ),
    )
  })
})
