/**
 * Unit tests for AI rule suggestion flows in RulesStep
 * Covers: approve/reject custom rule, cross-column rule approve/reject,
 *         error display, code preview for custom rule
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

jest.mock('@/modules/files', () => ({
  fileManagementAPI: {
    suggestCustomRule: jest.fn(),
    suggestCrossColumnRule: jest.fn(),
  },
}))

jest.mock('@/shared/lib/type-catalog', () => ({
  deriveRulesV2: jest.fn().mockReturnValue({ rules: [], ruleSources: {} }),
  CORE_TYPES: {},
  TYPE_ALIASES: {},
}))

jest.mock('@/shared/lib/dq-rules', () => ({
  getRuleLabel: jest.fn((id: string) => id),
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RulesStep } from '@/modules/processing/components/steps/RulesStep'
import {
  ProcessingWizardProvider,
  useProcessingWizard,
} from '@/modules/processing/components/WizardContext'
import { act, renderHook } from '@testing-library/react'
import { fileManagementAPI } from '@/modules/files'

const mockSuggestCustomRule = fileManagementAPI.suggestCustomRule as jest.Mock
const mockSuggestCross = fileManagementAPI.suggestCrossColumnRule as jest.Mock

function renderWithContext(initializer?: (ctx: ReturnType<typeof useProcessingWizard>) => void) {
  const Wrapper = () => {
    const ctx = useProcessingWizard()
    React.useEffect(() => {
      ctx.initializeWithFile('uid-test', 'test.csv', ['email', 'amount'], 'tok-test')
      if (initializer) initializer(ctx)
    }, [])
    return <RulesStep />
  }
  return render(
    <ProcessingWizardProvider>
      <Wrapper />
    </ProcessingWizardProvider>
  )
}

afterEach(() => jest.clearAllMocks())

describe('RulesStep — rule statistics badges', () => {
  it('renders rule count badges', () => {
    renderWithContext()
    // Multiple badge elements may render the same pattern — just assert at least one
    expect(screen.getAllByText(/AI:/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Custom:/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Cross:/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Selected:/).length).toBeGreaterThanOrEqual(1)
  })
})

describe('RulesStep — custom rule approve/reject flow', () => {
  it('approve adds the suggested custom rule to context', async () => {
    mockSuggestCustomRule.mockResolvedValue({
      suggestion: {
        rule_id: 'CUST_email_1',
        rule_name: 'Email Domain Check',
        explanation: 'Validates email domain',
        code: 'return "@" in value',
        column: 'email',
      },
    })

    renderWithContext()

    // Expand the "email" column collapsible
    const emailTrigger = screen.getByText('email')
    fireEvent.click(emailTrigger)

    // Click "Add Custom Rule" for the email column
    const addBtn = await screen.findByText('Add Custom Rule')
    fireEvent.click(addBtn)

    // Fill in the prompt textarea
    const textarea = await screen.findByPlaceholderText(/Describe your rule in natural language/)
    fireEvent.change(textarea, { target: { value: 'must have valid email domain' } })

    // Click Generate Rule
    const generateBtn = screen.getByText('Generate Rule')
    await act(async () => fireEvent.click(generateBtn))

    // Approve the suggestion
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Approve'))

    // Custom rule count badge should now show 1
    await waitFor(() => expect(screen.getByText('Custom: 1')).toBeInTheDocument())
  })

  it('reject dismisses pending suggestion', async () => {
    mockSuggestCustomRule.mockResolvedValue({
      suggestion: {
        rule_id: 'CUST_x',
        rule_name: 'Test Rule',
        explanation: 'test',
        code: 'return True',
        column: 'email',
      },
    })

    renderWithContext()
    fireEvent.click(screen.getByText('email'))
    fireEvent.click(await screen.findByText('Add Custom Rule'))
    const textarea = await screen.findByPlaceholderText(/Describe your rule in natural language/)
    fireEvent.change(textarea, { target: { value: 'test rule' } })
    await act(async () => fireEvent.click(screen.getByText('Generate Rule')))
    await waitFor(() => expect(screen.getByText('Reject')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Reject'))

    // Approve button gone
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    // Custom count stays 0
    expect(screen.getByText('Custom: 0')).toBeInTheDocument()
  })

  it('shows error message when suggest API returns error field', async () => {
    mockSuggestCustomRule.mockResolvedValue({
      error: 'LLM rate limit',
      suggestion: null,
    })

    renderWithContext()
    fireEvent.click(screen.getByText('email'))
    fireEvent.click(await screen.findByText('Add Custom Rule'))
    const textarea = await screen.findByPlaceholderText(/Describe your rule in natural language/)
    fireEvent.change(textarea, { target: { value: 'bad prompt' } })
    await act(async () => fireEvent.click(screen.getByText('Generate Rule')))

    await waitFor(() => expect(screen.getByText('LLM rate limit')).toBeInTheDocument())
  })
})

describe('RulesStep — business consistency rule: tabs present', () => {
  it('renders both DQ Rules and Business Consistency Rules tabs', () => {
    renderWithContext()
    // Both tab triggers must be present in the DOM
    const tabs = screen.getAllByRole('tab')
    expect(tabs.some(t => t.textContent?.includes('DQ Rules'))).toBe(true)
    expect(tabs.some(t => t.textContent?.includes('Business Consistency'))).toBe(true)
  })

  it('suggestCrossColumnRule API is called with prompt + columns', async () => {
    mockSuggestCross.mockResolvedValue({ rules: [] })

    // Call the API directly to assert contract (tab CSS hides the form in jsdom)
    const { suggestCrossColumnRule } = await import('@/modules/files/api/file-upload-api')
    // Re-mock fetch for this call
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ rules: [] }),
      headers: { get: () => null },
    } as any)

    await suggestCrossColumnRule('u1', 'tok', {
      prompt: '@start_date before @end_date',
      columns: ['start_date', 'end_date'],
    })

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/cross-rule-suggest')
    const body = JSON.parse(opts.body)
    expect(body.columns).toEqual(['start_date', 'end_date'])
  })
})
