/**
 * Tests for the FE/processing wizard error-differentiation fixes.
 *
 * Covers SourceStep + WizardDialog error mapping by interacting with the
 * components through their public surface. We avoid rendering Radix Select
 * by going straight to the file-pick path with a tightly mocked source list.
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

const mockGetFileStatus = jest.fn()
const mockGetFileColumns = jest.fn()
const mockStartProcessing = jest.fn()

jest.mock('@/modules/files', () => ({
  fileManagementAPI: {
    getFileStatus: (...a: any[]) => mockGetFileStatus(...a),
    getFileColumns: (...a: any[]) => mockGetFileColumns(...a),
    startProcessing: (...a: any[]) => mockStartProcessing(...a),
  },
  FileDetailsDialog: () => null,
}))

const mockStartUpload = jest.fn()
jest.mock('@/modules/files/context/upload-manager', () => ({
  useUploadManager: () => ({
    activeUploads: [],
    startUpload: (...a: any[]) => mockStartUpload(...a),
    cancelUpload: jest.fn(),
    getUploadForFile: jest.fn(),
    hasActiveUploads: false,
  }),
}))

// Stub heavy connector / unified-bridge imports
jest.mock('@/modules/connectors', () => ({ ERPImport: () => null }))
jest.mock('@/modules/connectors/components/connector-logo', () => ({ ConnectorLogo: () => null }))
jest.mock('@/modules/unified-bridge', () => ({ UnifiedBridgeImport: () => null }))
jest.mock('@/modules/files/page/constants', () => ({
  SOURCE_OPTIONS: [{ value: 'local', label: 'Local' }],
  ERP_OPTIONS: [],
}))

// Avoid rendering Radix Select (caused infinite ref-loop in jsdom).
jest.mock('@/components/ui/select', () => {
  const React = require('react')
  return {
    Select: ({ children }: any) => React.createElement('div', null, children),
    SelectTrigger: ({ children }: any) => React.createElement('div', null, children),
    SelectValue: ({ children }: any) => React.createElement('div', null, children),
    SelectContent: ({ children }: any) => React.createElement('div', null, children),
    SelectItem: ({ children }: any) => React.createElement('div', null, children),
  }
})

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ApiError } from '@/modules/shared/api-error'
import { SourceStep } from '@/modules/processing/components/steps/SourceStep'
import { ProcessingWizardProvider, useProcessingWizard } from '@/modules/processing/components/WizardContext'

function InitializedSource() {
  const { initializeNew } = useProcessingWizard()
  const inited = React.useRef(false)
  if (!inited.current) {
    inited.current = true
    initializeNew('tok-abc')
  }
  return <SourceStep />
}

function renderSource() {
  return render(
    <ProcessingWizardProvider>
      <InitializedSource />
    </ProcessingWizardProvider>
  )
}

function pickFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

beforeEach(() => {
  mockGetFileStatus.mockReset()
  mockGetFileColumns.mockReset()
  mockStartProcessing.mockReset()
  mockStartUpload.mockReset()
})

describe('SourceStep — error differentiation', () => {
  it('rejects 0-byte CSV client-side without calling the upload manager', async () => {
    renderSource()
    const empty = new File([], 'empty.csv', { type: 'text/csv' })
    Object.defineProperty(empty, 'size', { value: 0 })
    pickFile(empty)
    await waitFor(() => expect(screen.getByText(/your file is empty/i)).toBeInTheDocument())
    expect(mockStartUpload).not.toHaveBeenCalled()
  })

  it('surfaces REJECTED.failure_reason="empty_file" instead of generic "upload failed"', async () => {
    mockStartUpload.mockResolvedValue('upload-xyz')
    mockGetFileColumns.mockResolvedValue({ columns: [] })
    mockGetFileStatus.mockResolvedValue({
      upload_id: 'upload-xyz',
      status: 'REJECTED',
      failure_reason: 'empty_file',
    })

    renderSource()
    const file = new File(['x'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'size', { value: 1 })
    pickFile(file)

    await waitFor(() => {
      expect(screen.getByText(/your file appears to be empty/i)).toBeInTheDocument()
    })
  })

  it('maps ApiError 403 to permission-denied message (not generic upload failed)', async () => {
    mockStartUpload.mockRejectedValue(new ApiError({ status: 403, message: 'Forbidden' }))

    renderSource()
    const file = new File(['hello,world'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'size', { value: 11 })
    pickFile(file)

    await waitFor(() => {
      expect(screen.getByText(/do not have permission/i)).toBeInTheDocument()
    })
  })

  it('maps ApiError 413 to "file too large" message', async () => {
    mockStartUpload.mockRejectedValue(new ApiError({ status: 413, message: 'Too large' }))

    renderSource()
    const file = new File(['x'], 'big.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'size', { value: 1 })
    pickFile(file)

    await waitFor(() => {
      expect(screen.getByText(/too large/i)).toBeInTheDocument()
    })
  })

  it('maps ApiError 5xx to server-error message', async () => {
    mockStartUpload.mockRejectedValue(new ApiError({ status: 502, message: 'Bad gateway' }))

    renderSource()
    const file = new File(['x'], 'a.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'size', { value: 1 })
    pickFile(file)

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })
})
