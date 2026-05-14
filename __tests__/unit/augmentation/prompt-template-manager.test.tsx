/**
 * Tests for PromptTemplateManager — list, register, validation, deactivate.
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

import { PromptTemplateManager } from '@/modules/augmentation/components/prompt-template-manager'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

const SAMPLE = [
    { template_id: 'tpl-a', version: 1, is_active: true, prompt_text: 'p',
        cardinality: 'ONE_TO_MANY', expected_input_schema: {}, expected_output_schema: {} },
]

afterEach(() => mockMakeRequest.mockReset())

describe('PromptTemplateManager', () => {
    it('lists active templates returned by the backend', async () => {
        mockMakeRequest.mockResolvedValueOnce(SAMPLE)
        render(<PromptTemplateManager />)
        expect(await screen.findByText('tpl-a')).toBeInTheDocument()
        expect(screen.getByText(/Active templates \(1\)/)).toBeInTheDocument()
    })

    it('shows an empty-state row when no templates exist', async () => {
        mockMakeRequest.mockResolvedValueOnce([])
        render(<PromptTemplateManager />)
        expect(await screen.findByText(/No active templates/i)).toBeInTheDocument()
    })

    it('validates required template_id + prompt_text before POSTing', async () => {
        mockMakeRequest.mockResolvedValueOnce([])
        render(<PromptTemplateManager />)
        await screen.findByText(/No active templates/i)
        fireEvent.click(screen.getByRole('button', { name: /^Register$/i }))
        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toMatch(/required/i)
        })
        // No POST should have happened (only the initial GET).
        expect(mockMakeRequest).toHaveBeenCalledTimes(1)
    })

    it('registers a new template via POST then reloads the list', async () => {
        mockMakeRequest
            .mockResolvedValueOnce([])  // initial GET
            .mockResolvedValueOnce({ template_id: 'tpl-new', version: 1, is_active: true })  // POST
            .mockResolvedValueOnce(SAMPLE)  // GET after success
        render(<PromptTemplateManager />)
        await screen.findByText(/No active templates/i)
        fireEvent.change(screen.getByLabelText(/Template ID/i), { target: { value: 'tpl-new' } })
        fireEvent.change(screen.getByLabelText(/Prompt text/i), { target: { value: 'hello' } })
        fireEvent.click(screen.getByRole('button', { name: /^Register$/i }))
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalledTimes(3))
        const postCall = mockMakeRequest.mock.calls[1]
        expect(postCall[2].method).toBe('POST')
    })

    it('deactivate button calls DELETE for the template/version', async () => {
        mockMakeRequest.mockResolvedValueOnce(SAMPLE)
        render(<PromptTemplateManager />)
        const btn = await screen.findByLabelText(/Deactivate tpl-a v1/)
        mockMakeRequest.mockResolvedValueOnce({})  // DELETE
            .mockResolvedValueOnce([])             // reload
        fireEvent.click(btn)
        await waitFor(() => {
            const deleteCall = mockMakeRequest.mock.calls.find(c => c[2]?.method === 'DELETE')
            expect(deleteCall?.[0]).toBe('/augmentation/prompt-templates/tpl-a/versions/1')
        })
    })
})
