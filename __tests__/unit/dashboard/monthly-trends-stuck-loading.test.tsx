/**
 * Unit test for MonthlyTrendsCompact — fix(fe/dashboard): don't sit on the
 * loading spinner forever when idToken is null on mount.
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

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth'
import { fileManagementAPI } from '@/modules/files'
import { MonthlyTrendsCompact } from '@/modules/dashboard/components/monthly-trends-compact'

const mockUseAuth = useAuth as jest.Mock
const mockReport = (fileManagementAPI as any).downloadOverallDqReport as jest.Mock

afterEach(() => jest.clearAllMocks())

describe('MonthlyTrendsCompact', () => {
  it('does NOT hang on the spinner when idToken is missing', async () => {
    mockUseAuth.mockReturnValue({ idToken: null })
    render(<MonthlyTrendsCompact files={[]} />)
    // After the effect runs, loading must be false. Component should
    // either render the chart or the empty-state, never an indefinite
    // Loader2 spinner.
    await waitFor(() => {
      // Empty state appears when no data — verifies loading=false reached.
      expect(screen.getByTestId('trends-empty')).toBeInTheDocument()
    })
    expect(mockReport).not.toHaveBeenCalled()
  })

  it('shows empty-state copy when no files and report is null', async () => {
    mockUseAuth.mockReturnValue({ idToken: 'tok' })
    mockReport.mockResolvedValue(null)
    render(<MonthlyTrendsCompact files={[]} />)
    await waitFor(() => expect(screen.getByTestId('trends-empty')).toBeInTheDocument())
  })
})
