/**
 * Results-view tests for AugmentationPage job table.
 *
 * Covers:
 *  - Row counts shown for SUCCEEDED jobs
 *  - Cost rendered to 4 decimal places
 *  - Download button enabled only for SUCCEEDED, disabled for others
 *  - Download button invokes GET /augmentation/jobs/{id}/output
 *  - Error toast on download failure
 *  - SOX badge visible in the drawer for sox_audit_enabled=true jobs
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== 'undefined') {
    if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
    if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
    if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}
const mockOpen = jest.fn()
Object.defineProperty(window, 'open', { value: mockOpen, writable: true })

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

const SUCCEEDED_JOB = {
    job_id: 'job-s1', status: 'SUCCEEDED', template_id: 'tpl-a',
    output_rows_count: 42_500, cost_actual_usd: 0.0123,
    created_at: '2026-05-13T10:00:00Z', sox_audit_enabled: true,
}
const FAILED_JOB = {
    job_id: 'job-f1', status: 'FAILED', template_id: 'tpl-b',
    error_message: 'eval error', error_code: 'AUG_EVAL_FAILED',
    created_at: '2026-05-13T09:00:00Z',
}
const PENDING_JOB = {
    job_id: 'job-p1', status: 'PENDING', template_id: 'tpl-c',
    created_at: '2026-05-13T08:00:00Z',
}

afterEach(() => { mockMakeRequest.mockReset(); mockOpen.mockReset() })

describe('Results view: row counts + cost rendering', () => {
    it('renders output_rows_count for SUCCEEDED job', async () => {
        mockMakeRequest.mockResolvedValueOnce([SUCCEEDED_JOB])
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-row-job-s1')).toBeInTheDocument())
        expect(screen.getByText('42500')).toBeInTheDocument()
    })

    it('renders cost_actual_usd formatted to 4 decimal places', async () => {
        mockMakeRequest.mockResolvedValueOnce([SUCCEEDED_JOB])
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-row-job-s1')).toBeInTheDocument())
        expect(screen.getByText('$0.0123')).toBeInTheDocument()
    })

    it('renders "—" for missing rows/cost on FAILED job', async () => {
        mockMakeRequest.mockResolvedValueOnce([FAILED_JOB])
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-row-job-f1')).toBeInTheDocument())
        // At least one "—" placeholder should appear for rows/cost
        const dashes = screen.getAllByText('—')
        expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
})

describe('Results view: download button', () => {
    it('download button is enabled only for SUCCEEDED jobs', async () => {
        mockMakeRequest.mockResolvedValueOnce([SUCCEEDED_JOB, FAILED_JOB, PENDING_JOB])
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-row-job-s1')).toBeInTheDocument())

        const dlSucceeded = screen.getByRole('button', { name: /Download job-s1/i })
        expect(dlSucceeded).not.toBeDisabled()

        const dlFailed = screen.getByRole('button', { name: /Download job-f1/i })
        expect(dlFailed).toBeDisabled()

        const dlPending = screen.getByRole('button', { name: /Download job-p1/i })
        expect(dlPending).toBeDisabled()
    })

    it('download button calls GET /augmentation/jobs/{id}/output and opens presigned URL', async () => {
        mockMakeRequest.mockResolvedValueOnce([SUCCEEDED_JOB])
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-row-job-s1')).toBeInTheDocument())

        // Second call = output endpoint
        mockMakeRequest.mockResolvedValueOnce({ presigned_url: 'https://s3.test/output.parquet', expires_at: 'x' })
        fireEvent.click(screen.getByRole('button', { name: /Download job-s1/i }))

        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalledTimes(2))
        const [outputUrl, , outputOpts] = mockMakeRequest.mock.calls[1]
        expect(outputUrl).toBe('/augmentation/jobs/job-s1/output')
        expect((outputOpts as { method: string }).method).toBe('GET')
        await waitFor(() => expect(mockOpen).toHaveBeenCalledWith(
            'https://s3.test/output.parquet', '_blank', 'noopener,noreferrer'
        ))
    })

    it('download failure surfaces a sanitized error message in the page', async () => {
        mockMakeRequest.mockResolvedValueOnce([SUCCEEDED_JOB])
        render(<AugmentationPage />)
        await waitFor(() => expect(screen.getByTestId('aug-row-job-s1')).toBeInTheDocument())

        mockMakeRequest.mockRejectedValueOnce(new Error('S3 access denied'))
        fireEvent.click(screen.getByRole('button', { name: /Download job-s1/i }))

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
        expect(screen.getByRole('alert').textContent).toMatch(/S3 access denied/)
    })
})

describe('Results view: job drawer detail', () => {
    it('SOX badge is shown in the drawer when sox_audit_enabled is true', async () => {
        mockMakeRequest.mockResolvedValueOnce([SUCCEEDED_JOB])
        render(<AugmentationPage />)
        const row = await screen.findByTestId('aug-row-job-s1')
        fireEvent.click(row)
        await waitFor(() => expect(screen.getByTestId('sox-badge')).toBeInTheDocument())
    })

    it('error_message is rendered in drawer for FAILED job', async () => {
        mockMakeRequest.mockResolvedValueOnce([FAILED_JOB])
        render(<AugmentationPage />)
        const row = await screen.findByTestId('aug-row-job-f1')
        fireEvent.click(row)
        await waitFor(() => expect(screen.getByText('eval error')).toBeInTheDocument())
    })
})
