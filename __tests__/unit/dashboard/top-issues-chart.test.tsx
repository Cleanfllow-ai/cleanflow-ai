/**
 * Unit tests for TopIssuesChart
 * Covers: top-5 bar render, empty state, loading state, percentage computation
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TopIssuesChart } from '@/modules/dashboard/components/top-issues-chart'
import type { TopIssue } from '@/modules/files'

const ISSUES: TopIssue[] = [
  { violation: 'NULL_VALUE', count: 400 },
  { violation: 'INVALID_EMAIL', count: 300 },
  { violation: 'DUPLICATE_ROW', count: 200 },
  { violation: 'SQL_INJECTION', count: 100 },
  { violation: 'WHITESPACE_ONLY', count: 50 },
  { violation: 'EXTRA_ISSUE', count: 10 },  // 6th — should be excluded
]

describe('TopIssuesChart', () => {
  it('renders the "Top DQ Issues" heading', () => {
    render(<TopIssuesChart issues={ISSUES} />)
    expect(screen.getByText(/top dq issues/i)).toBeInTheDocument()
  })

  it('renders at most 5 issue rows', () => {
    render(<TopIssuesChart issues={ISSUES} />)
    // Issue names are displayed with underscores replaced by spaces
    expect(screen.getByText('NULL VALUE')).toBeInTheDocument()
    expect(screen.getByText('INVALID EMAIL')).toBeInTheDocument()
    expect(screen.getByText('DUPLICATE ROW')).toBeInTheDocument()
    expect(screen.getByText('SQL INJECTION')).toBeInTheDocument()
    expect(screen.getByText('WHITESPACE ONLY')).toBeInTheDocument()
    // 6th issue should be excluded
    expect(screen.queryByText('EXTRA ISSUE')).not.toBeInTheDocument()
  })

  it('shows the total count in the header', () => {
    render(<TopIssuesChart issues={ISSUES.slice(0, 5)} />)
    // total = 400+300+200+100+50 = 1050
    expect(screen.getByText('1,050')).toBeInTheDocument()
  })

  it('renders empty state when no issues provided', () => {
    render(<TopIssuesChart issues={[]} />)
    expect(screen.getByText(/no dq issues recorded yet/i)).toBeInTheDocument()
  })

  it('renders empty state when issues is undefined', () => {
    render(<TopIssuesChart />)
    expect(screen.getByText(/no dq issues recorded yet/i)).toBeInTheDocument()
  })

  it('renders loading skeleton when isLoading=true and no data', () => {
    render(<TopIssuesChart isLoading={true} />)
    // Loading label appears in the header
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders data even when isLoading=true (data takes precedence)', () => {
    render(<TopIssuesChart issues={ISSUES.slice(0, 2)} isLoading={true} />)
    expect(screen.getByText('NULL VALUE')).toBeInTheDocument()
    expect(screen.getByText('INVALID EMAIL')).toBeInTheDocument()
  })

  it('filters out issues with count=0', () => {
    const withZero: TopIssue[] = [
      { violation: 'NULL_VALUE', count: 100 },
      { violation: 'ZERO_COUNT', count: 0 },
    ]
    render(<TopIssuesChart issues={withZero} />)
    expect(screen.getByText('NULL VALUE')).toBeInTheDocument()
    expect(screen.queryByText('ZERO COUNT')).not.toBeInTheDocument()
  })
})
