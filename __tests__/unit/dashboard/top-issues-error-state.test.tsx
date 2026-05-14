/**
 * Unit tests for TopIssuesChart — fix(fe/dashboard): distinguish error
 * state from empty state.
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TopIssuesChart } from '@/modules/dashboard/components/top-issues-chart'

describe('TopIssuesChart — error vs empty', () => {
  it('renders an explicit error message when errorMessage is set', () => {
    render(<TopIssuesChart issues={[]} errorMessage="fetch failed" />)
    expect(screen.getByTestId('top-issues-error')).toBeInTheDocument()
    expect(screen.queryByTestId('top-issues-empty')).not.toBeInTheDocument()
  })

  it('renders empty state (not error state) when no issues and no error', () => {
    render(<TopIssuesChart issues={[]} />)
    expect(screen.getByTestId('top-issues-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('top-issues-error')).not.toBeInTheDocument()
  })

  it('does NOT show empty/error state while loading skeleton is visible', () => {
    render(<TopIssuesChart isLoading />)
    expect(screen.queryByTestId('top-issues-empty')).not.toBeInTheDocument()
    expect(screen.queryByTestId('top-issues-error')).not.toBeInTheDocument()
  })

  it('hides error state once real data arrives', () => {
    const { rerender } = render(<TopIssuesChart issues={[]} errorMessage="500" />)
    expect(screen.getByTestId('top-issues-error')).toBeInTheDocument()
    rerender(
      <TopIssuesChart
        issues={[{ violation: 'NULL_VALUE', count: 5 }]}
        errorMessage={null}
      />,
    )
    expect(screen.queryByTestId('top-issues-error')).not.toBeInTheDocument()
    expect(screen.getByText('NULL VALUE')).toBeInTheDocument()
  })
})
