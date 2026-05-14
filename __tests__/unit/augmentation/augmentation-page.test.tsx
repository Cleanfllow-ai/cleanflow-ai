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
        mockMakeRequest.mockResolvedValue([])
        render(<AugmentationPage />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalled())
        const templateTab = screen.getByRole('tab', { name: /Prompt templates/i })
        fireEvent.click(templateTab)
        // PromptTemplateManager renders "Register new template" heading once the tab is active
        await waitFor(() =>
            expect(screen.getByText(/Register new template/i)).toBeInTheDocument()
        )
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
})
