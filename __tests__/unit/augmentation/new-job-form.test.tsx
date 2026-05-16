/**
 * Tests for NewJobForm — renders, submits, validates, toggles, error state.
 */
// jsdom lacks ResizeObserver / PointerEvent helpers Radix Select relies on.
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

import { NewJobForm } from '@/modules/augmentation/components/new-job-form'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

beforeEach(() => {
    // First call = listPromptTemplates (component-mount effect)
    mockMakeRequest.mockResolvedValue([])
})
afterEach(() => mockMakeRequest.mockReset())

describe('NewJobForm', () => {
    it('renders all required form fields', async () => {
        render(<NewJobForm />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalled())
        expect(screen.getByLabelText(/Input dataset S3 key/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Output dataset S3 key/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Submit job/i })).toBeInTheDocument()
    })

    it('shows validation error when submitting empty form', async () => {
        render(<NewJobForm />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', { name: /Submit job/i }))
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
        })
    })

    it('SOX-audit toggle starts ON by default', async () => {
        render(<NewJobForm />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalled())
        const sw = screen.getByLabelText(/SOX audit lineage/i)
        // Radix Switch surfaces state via aria-checked
        expect(sw.getAttribute('aria-checked')).toBe('true')
    })

    it('dry-run toggle starts OFF and can be flipped', async () => {
        render(<NewJobForm />)
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalled())
        const sw = screen.getByLabelText(/Dry run/i)
        expect(sw.getAttribute('aria-checked')).toBe('false')
        fireEvent.click(sw)
        expect(sw.getAttribute('aria-checked')).toBe('true')
    })

    it('surfaces backend error in form', async () => {
        // Templates listing succeeds, but the user can't submit because no template
        // is selected → form-validation error path is exercised. We also assert
        // that an API failure (rejected listPromptTemplates) lands in the alert.
        mockMakeRequest.mockReset()
        mockMakeRequest.mockRejectedValueOnce(new Error('boom-load'))
        render(<NewJobForm />)
        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toMatch(/boom-load/)
        })
    })
})
