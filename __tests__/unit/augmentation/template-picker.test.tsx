/**
 * Template-picker tests for PromptTemplateManager.
 *
 * Covers:
 *  - All 3 RightRev cardinality scenarios render (ONE_TO_MANY, MANY_TO_ONE, MANY_TO_MANY)
 *  - Cardinality SELECT contains all 3 options
 *  - Selecting a different cardinality updates the form value
 *  - POST body contains the chosen cardinality value
 *  - Version badge renders "v{N}" format
 *  - Register POST body is well-shaped: template_id, cardinality, prompt_text, schemas
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

// Three RightRev templates — one per cardinality scenario
const THREE_TEMPLATES = [
    {
        template_id: 'rightrev-scenario-a', version: 1, is_active: true,
        prompt_text: 'Scenario A: 1 invoice → N revenue lines',
        cardinality: 'ONE_TO_MANY',
        expected_input_schema: { invoice_id: 'string' },
        expected_output_schema: { revenue_line: 'string' },
    },
    {
        template_id: 'rightrev-scenario-b', version: 2, is_active: true,
        prompt_text: 'Scenario B: N invoices → 1 annual summary',
        cardinality: 'MANY_TO_ONE',
        expected_input_schema: { invoice_id: 'string' },
        expected_output_schema: { annual_summary: 'string' },
    },
    {
        template_id: 'rightrev-scenario-c', version: 1, is_active: true,
        prompt_text: 'Scenario C: M invoices → M×K enriched records',
        cardinality: 'MANY_TO_MANY',
        expected_input_schema: { invoice_id: 'string' },
        expected_output_schema: { enriched: 'string' },
    },
]

afterEach(() => mockMakeRequest.mockReset())

describe('PromptTemplateManager: 3 RightRev template cardinality scenarios', () => {
    it('renders all 3 templates (ONE_TO_MANY, MANY_TO_ONE, MANY_TO_MANY)', async () => {
        mockMakeRequest.mockResolvedValueOnce(THREE_TEMPLATES)
        render(<PromptTemplateManager />)
        expect(await screen.findByText('rightrev-scenario-a')).toBeInTheDocument()
        expect(screen.getByText('rightrev-scenario-b')).toBeInTheDocument()
        expect(screen.getByText('rightrev-scenario-c')).toBeInTheDocument()
        expect(screen.getAllByText('ONE_TO_MANY').length).toBeGreaterThan(0)
        expect(screen.getAllByText('MANY_TO_ONE').length).toBeGreaterThan(0)
        expect(screen.getAllByText('MANY_TO_MANY').length).toBeGreaterThan(0)
    })

    it('renders version badges in "v{N}" format for each template', async () => {
        mockMakeRequest.mockResolvedValueOnce(THREE_TEMPLATES)
        render(<PromptTemplateManager />)
        await screen.findByText('rightrev-scenario-a')
        // Two templates use v1, one uses v2
        expect(screen.getAllByText('v1').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('v2').length).toBeGreaterThanOrEqual(1)
    })

    it('active template count header shows correct number', async () => {
        mockMakeRequest.mockResolvedValueOnce(THREE_TEMPLATES)
        render(<PromptTemplateManager />)
        await screen.findByText(/Active templates \(3\)/)
    })
})

describe('PromptTemplateManager: cardinality SELECT in register form', () => {
    it('cardinality SELECT has all 3 options (ONE_TO_MANY, MANY_TO_ONE, MANY_TO_MANY)', async () => {
        mockMakeRequest.mockResolvedValueOnce([])
        render(<PromptTemplateManager />)
        await screen.findByText(/No active templates/i)
        // Open the Select
        const trigger = screen.getByRole('combobox')
        fireEvent.click(trigger)
        await waitFor(() => {
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
                expect.arrayContaining(['ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'])
            )
        })
    })

    it('POST body contains chosen cardinality when registering', async () => {
        mockMakeRequest
            .mockResolvedValueOnce([])  // initial GET
            .mockResolvedValueOnce({ template_id: 'tpl-new', version: 1, is_active: true })  // POST
            .mockResolvedValueOnce([])  // reload GET
        render(<PromptTemplateManager />)
        await screen.findByText(/No active templates/i)

        // Fill required fields
        fireEvent.change(screen.getByLabelText(/Template ID/i), { target: { value: 'tpl-many-one' } })
        fireEvent.change(screen.getByLabelText(/Prompt text/i), { target: { value: 'many to one prompt' } })

        // Change cardinality to MANY_TO_ONE
        const trigger = screen.getByRole('combobox')
        fireEvent.click(trigger)
        const option = await screen.findByRole('option', { name: 'MANY_TO_ONE' })
        fireEvent.click(option)

        fireEvent.click(screen.getByRole('button', { name: /^Register$/i }))
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalledTimes(3))

        const postCall = mockMakeRequest.mock.calls[1]
        const body = JSON.parse(postCall[2].body)
        expect(body.template_id).toBe('tpl-many-one')
        expect(body.cardinality).toBe('MANY_TO_ONE')
        expect(body.prompt_text).toBe('many to one prompt')
    })
})

describe('PromptTemplateManager: register form body shape', () => {
    it('POST body includes expected_input_schema + expected_output_schema as parsed JSON', async () => {
        mockMakeRequest
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce({ template_id: 'tpl-schema', version: 1, is_active: true })
            .mockResolvedValueOnce([])
        render(<PromptTemplateManager />)
        await screen.findByText(/No active templates/i)

        fireEvent.change(screen.getByLabelText(/Template ID/i), { target: { value: 'tpl-schema' } })
        fireEvent.change(screen.getByLabelText(/Prompt text/i), { target: { value: 'test prompt' } })
        fireEvent.change(screen.getByLabelText(/Input schema/i), {
            target: { value: '{"invoice_id":"string"}' },
        })
        fireEvent.change(screen.getByLabelText(/Output schema/i), {
            target: { value: '{"revenue_line":"string"}' },
        })

        fireEvent.click(screen.getByRole('button', { name: /^Register$/i }))
        await waitFor(() => expect(mockMakeRequest).toHaveBeenCalledTimes(3))

        const body = JSON.parse(mockMakeRequest.mock.calls[1][2].body)
        expect(body.expected_input_schema).toEqual({ invoice_id: 'string' })
        expect(body.expected_output_schema).toEqual({ revenue_line: 'string' })
    })

    it('shows error when schema JSON is invalid (not silently passing bad data)', async () => {
        mockMakeRequest.mockResolvedValueOnce([])
        render(<PromptTemplateManager />)
        await screen.findByText(/No active templates/i)

        fireEvent.change(screen.getByLabelText(/Template ID/i), { target: { value: 'tpl-x' } })
        fireEvent.change(screen.getByLabelText(/Prompt text/i), { target: { value: 'p' } })
        fireEvent.change(screen.getByLabelText(/Input schema/i), {
            target: { value: '{bad json' },
        })

        fireEvent.click(screen.getByRole('button', { name: /^Register$/i }))
        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toMatch(/valid JSON/i)
        })
        // No POST should have fired
        expect(mockMakeRequest).toHaveBeenCalledTimes(1)
    })
})
