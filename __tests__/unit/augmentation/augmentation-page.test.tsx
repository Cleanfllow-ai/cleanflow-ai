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
})
