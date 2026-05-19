/**
 * Tests for AugmentationPage — list render, status badges, refresh, row click.
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== 'undefined') {
    if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
    if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
    if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

jest.mock('@/shared/config/aws-config', () => ({
    AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))
jest.mock('@/modules/files/api/file-upload-api', () => ({
    makeRequest: jest.fn(),
}))
jest.mock('@/modules/auth', () => ({
    useAuth: () => ({ idToken: 'tok-123' }),
}))

import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { AugmentationPage } from '@/modules/augmentation/components/augmentation-page'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

const SAMPLE_JOBS = [
    {
        job_id: 'job-001', status: 'SUCCEEDED', template_id: 'tpl-a',
        output_rows_count: 100, cost_actual_usd: 0.1234, created_at: '2026-05-13T10:00:00Z',
    },
    {
        job_id: 'job-002', status: 'FAILED', template_id: 'tpl-b',
        error_message: 'oops', created_at: '2026-05-12T10:00:00Z',
    },
]

afterEach(() => mockMakeRequest.mockReset())

describe('AugmentationPage', () => {
    it('renders the job list when API returns data', async () => {
        mockMakeRequest.mockResolvedValueOnce(SAMPLE_JOBS)
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByText(/AI Data Augmentation/i)).toBeInTheDocument())
        expect(await screen.findByTestId('aug-row-job-001')).toBeInTheDocument()
        expect(screen.getByTestId('aug-row-job-002')).toBeInTheDocument()
    })

    it('renders a status badge per row', async () => {
        mockMakeRequest.mockResolvedValueOnce(SAMPLE_JOBS)
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-status-SUCCEEDED')).toBeInTheDocument())
        expect(screen.getByTestId('aug-status-FAILED')).toBeInTheDocument()
    })

    it('opens the row drawer on click', async () => {
        mockMakeRequest.mockResolvedValueOnce(SAMPLE_JOBS)
        render(<AugmentationPage />)
        const row = await screen.findByTestId('aug-row-job-001')
        fireEvent.click(row)
        // Drawer surfaces the job id as a heading via SheetTitle
        await waitFor(() => {
            const titles = screen.getAllByText('job-001')
            expect(titles.length).toBeGreaterThan(0)
        })
    })

    it('refresh button refetches the list', async () => {
        mockMakeRequest.mockResolvedValue(SAMPLE_JOBS)
        render(<AugmentationPage />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalledTimes(1))
        fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalledTimes(2))
    })

    // Bug 3 regression: raw AWS SigV4 parse error must NEVER reach the DOM.
    it('does not render raw AWS SigV4 error strings in the page (Bug 3)', async () => {
        const awsRawError = "Invalid key=value pair (missing equal-sign) in Authorization header (hashed with SHA-256 and encoded with Base64): 'fyPd...'"
        mockMakeRequest.mockRejectedValueOnce(new Error(awsRawError))
        render(<AugmentationPage />)
        await waitFor(() =>
            expect(screen.getByRole('alert')).toBeInTheDocument()
        )
        // Must show a clean user-facing message, NOT the raw AWS string
        expect(screen.queryByText(/Invalid key=value pair/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/hashed with SHA-256/i)).not.toBeInTheDocument()
        expect(screen.getByRole('alert').textContent).toMatch(/Unable to reach the augmentation service/i)
    })

    // Bug 2 regression: list endpoint (GET /augmentation/jobs) must be called on load.
    it('calls GET /augmentation/jobs (list) on page mount', async () => {
        mockMakeRequest.mockResolvedValueOnce([])
        render(<AugmentationPage />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalledTimes(1))
        const [endpoint, , opts] = mockMakeRequest.mock.calls[0]
        expect(endpoint).toMatch(/\/augmentation\/jobs/)
        expect((opts as { method: string }).method).toBe('GET')
    })

    it('tab navigation: clicking "Prompt templates" tab shows template manager', async () => {
        const user = userEvent.setup()
        mockMakeRequest.mockResolvedValue([])
        render(<AugmentationPage />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalled())
        const templateTab = screen.getByRole('tab', { name: /Prompt templates/i })
        await user.click(templateTab)
        // PromptTemplateManager mounts once the tab is active
        await waitFor(() =>
            expect(screen.getByTestId('prompt-template-manager')).toBeInTheDocument()
        )
        // The register form heading must be rendered
        expect(screen.getByText(/Register new template/i)).toBeInTheDocument()
    })

    it('tab navigation: jobs tab is active by default and shows job table', async () => {
        mockMakeRequest.mockResolvedValueOnce(SAMPLE_JOBS)
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-row-job-001')).toBeInTheDocument())
        // The Jobs tab should be the selected one by default
        const jobsTab = screen.getByRole('tab', { name: /^Jobs$/i })
        expect(jobsTab).toHaveAttribute('data-state', 'active')
    })

    it('Auth error (IAM SigV4 SHA-256 bleed) maps to sign-out message', async () => {
        const iamError = "Authorization header must contain a hashed with SHA-256 Base64 payload"
        mockMakeRequest.mockRejectedValueOnce(new Error(iamError))
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
        expect(screen.queryByText(/hashed with SHA-256/i)).not.toBeInTheDocument()
        expect(screen.getByRole('alert').textContent).toMatch(/sign out and sign in again/i)
    })

    it('shows "No augmentation jobs yet" when the list is empty', async () => {
        mockMakeRequest.mockResolvedValueOnce([])
        render(<AugmentationPage />)
        await waitFor(() =>
            expect(screen.getByText(/No augmentation jobs yet/i)).toBeInTheDocument()
        )
    })

    // Regression: page crash on string-typed cost_actual_usd (DDB Decimal
    // round-trip). The original code used `cost.toFixed()` after a `!= null`
    // guard that lets strings through, throwing TypeError and tripping the
    // global React error boundary on the whole /augmentation page.
    it('does not crash when cost_actual_usd arrives as a string (DDB Decimal regression)', async () => {
        const malformed = [
            // string-typed (the crasher)
            { job_id: 'job-str', status: 'SUCCEEDED', template_id: 't',
              cost_actual_usd: '0.5' as unknown as number, created_at: '2026-05-19T10:00:00Z' },
            // NaN-as-string
            { job_id: 'job-nan', status: 'FAILED', template_id: 't',
              cost_actual_usd: 'NaN' as unknown as number, created_at: '2026-05-19T10:01:00Z' },
            // null (already-handled, kept to lock the easy case)
            { job_id: 'job-null', status: 'RUNNING', template_id: 't',
              cost_actual_usd: null as unknown as number, created_at: '2026-05-19T10:02:00Z' },
            // happy path
            { job_id: 'job-num', status: 'SUCCEEDED', template_id: 't',
              cost_actual_usd: 1.234567, created_at: '2026-05-19T10:03:00Z' },
        ]
        mockMakeRequest.mockResolvedValueOnce(malformed)
        // The bug used to throw synchronously during render → no rows visible.
        render(<AugmentationPage />)
        // Each row must mount — proves no row crashed the render.
        expect(await screen.findByTestId('aug-row-job-str')).toBeInTheDocument()
        expect(screen.getByTestId('aug-row-job-nan')).toBeInTheDocument()
        expect(screen.getByTestId('aug-row-job-null')).toBeInTheDocument()
        expect(screen.getByTestId('aug-row-job-num')).toBeInTheDocument()
        // Happy-path row renders properly formatted cost
        expect(screen.getByTestId('aug-row-job-num').textContent).toContain('$1.2346')
        // Malformed rows render the "—" sentinel, not a stray "$NaN" or crash
        expect(screen.getByTestId('aug-row-job-nan').textContent).not.toContain('NaN')
        expect(screen.getByTestId('aug-row-job-null').textContent).toContain('—')
    })
})
