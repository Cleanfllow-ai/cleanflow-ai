/**
 * Unit tests for HttpSourceForm
 * Covers: URL field, auth-type dropdown, custom headers add/remove,
 *         validation guard, ingest success/error (INGEST_HTTP_FAILED)
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/modules/files', () => ({
  fileManagementAPI: {
    testHttpEndpoint: jest.fn(),
    ingestFromHttp: jest.fn(),
  },
}))
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-value={value}>{children}</div>
  ),
}))

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { fileManagementAPI } from '@/modules/files'
import HttpSourceForm from '@/modules/unified-bridge/components/http-source-form'

const mockApi = fileManagementAPI as any
const baseProps = {
  mode: 'source' as const,
  token: 'test-token',
  onIngestionStart: jest.fn(),
  onIngestionComplete: jest.fn(),
  onError: jest.fn(),
  disabled: false,
}

beforeEach(() => jest.clearAllMocks())

describe('HttpSourceForm', () => {
  it('renders URL field and Save As field', () => {
    render(<HttpSourceForm {...baseProps} />)
    expect(screen.getByLabelText(/url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/save as/i)).toBeInTheDocument()
  })

  it('renders Authentication selector', () => {
    render(<HttpSourceForm {...baseProps} />)
    expect(screen.getByText(/authentication/i)).toBeInTheDocument()
  })

  it('Fetch Data button is disabled when URL is empty (prevents submit)', () => {
    render(<HttpSourceForm {...baseProps} />)
    const fetchBtn = screen.getByRole('button', { name: /fetch data/i })
    // Button disabled when url or filename are missing
    expect(fetchBtn).toBeDisabled()
  })

  it('Fetch Data button remains disabled when URL is filled but filename is empty', () => {
    render(<HttpSourceForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'https://api.example.com' } })
    const fetchBtn = screen.getByRole('button', { name: /fetch data/i })
    expect(fetchBtn).toBeDisabled()
  })

  it('calls onIngestionStart + onIngestionComplete on successful fetch', async () => {
    mockApi.ingestFromHttp.mockResolvedValue({
      upload_id: 'up-http-1',
      filename: 'api_data.csv',
      size_bytes: 4096,
    })
    render(<HttpSourceForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/url/i), {
      target: { value: 'https://api.example.com/export' },
    })
    fireEvent.change(screen.getByLabelText(/save as/i), { target: { value: 'export.csv' } })

    const fetchBtn = screen.getByRole('button', { name: /fetch data/i })
    await act(async () => { fireEvent.click(fetchBtn) })

    await waitFor(() => {
      expect(baseProps.onIngestionStart).toHaveBeenCalledTimes(1)
      expect(baseProps.onIngestionComplete).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, uploadId: 'up-http-1' })
      )
    })
  })

  it('calls onError when ingestFromHttp throws (INGEST_HTTP_FAILED)', async () => {
    mockApi.ingestFromHttp.mockRejectedValue(new Error('INGEST_HTTP_FAILED: 403 Forbidden'))
    render(<HttpSourceForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'https://api.example.com' } })
    fireEvent.change(screen.getByLabelText(/save as/i), { target: { value: 'out.csv' } })

    const fetchBtn = screen.getByRole('button', { name: /fetch data/i })
    await act(async () => { fireEvent.click(fetchBtn) })

    await waitFor(() => {
      expect(baseProps.onError).toHaveBeenCalledWith(expect.stringContaining('INGEST_HTTP_FAILED'))
    })
  })

  it('Add header button adds a header row', () => {
    render(<HttpSourceForm {...baseProps} />)
    const addBtn = screen.getByRole('button', { name: /add/i })
    fireEvent.click(addBtn)
    // After adding, there should be placeholder inputs for header key/value
    const headerKeyInputs = screen.getAllByPlaceholderText(/header-name/i)
    expect(headerKeyInputs.length).toBeGreaterThanOrEqual(1)
  })

  it('Validate URL button is disabled when URL is empty', () => {
    render(<HttpSourceForm {...baseProps} />)
    const validateBtn = screen.getByRole('button', { name: /validate url/i })
    expect(validateBtn).toBeDisabled()
  })

  it('Validate URL button enabled when URL is filled', () => {
    render(<HttpSourceForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'https://example.com' } })
    const validateBtn = screen.getByRole('button', { name: /validate url/i })
    expect(validateBtn).not.toBeDisabled()
  })

  it('calls testHttpEndpoint on Validate URL click and fires onIngestionComplete on success', async () => {
    mockApi.testHttpEndpoint.mockResolvedValue({ success: true, message: 'URL is valid' })
    render(<HttpSourceForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'https://example.com' } })
    const validateBtn = screen.getByRole('button', { name: /validate url/i })
    await act(async () => { fireEvent.click(validateBtn) })
    await waitFor(() => {
      expect(mockApi.testHttpEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com' })
      )
      expect(baseProps.onIngestionComplete).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      )
    })
  })
})
