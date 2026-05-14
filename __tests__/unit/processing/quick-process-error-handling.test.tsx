/**
 * Tests for QuickProcessView (WizardDialog.tsx) error-differentiation
 * + onStarted refresh + REJECTED-status handling fixes.
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

jest.mock('@/modules/files', () => ({
  fileManagementAPI: {
    getFileColumns: jest.fn(),
    startProcessing: jest.fn(),
    getFileStatus: jest.fn(),
  },
  FileDetailsDialog: () => null,
}))

jest.mock('@/shared/lib/type-catalog', () => ({
  deriveRulesV2: jest.fn().mockReturnValue({ rules: [], ruleSources: {} }),
  CORE_TYPES: {},
  TYPE_ALIASES: {},
}))

jest.mock('@/shared/lib/dq-rules', () => ({ getRuleLabel: jest.fn((id: string) => id) }))

jest.mock('@/modules/processing/components/ProcessingWizard', () => ({
  ProcessingWizard: () => <div data-testid="processing-wizard" />,
}))
jest.mock('@/modules/processing/components/steps/SourceStep', () => ({
  SourceStep: () => <div data-testid="source-step" />,
}))

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ApiError } from '@/modules/shared/api-error'
import { WizardDialog } from '@/modules/processing/components/WizardDialog'
import { fileManagementAPI } from '@/modules/files'
import type { FileStatusResponse } from '@/modules/files/types/file.types'

const mockGetFileColumns = fileManagementAPI.getFileColumns as jest.Mock
const mockStartProcessing = fileManagementAPI.startProcessing as jest.Mock
const mockGetFileStatus = fileManagementAPI.getFileStatus as jest.Mock

function makeFile(): FileStatusResponse {
  return {
    upload_id: 'uid-quick',
    status: 'VALIDATED',
    original_filename: 'data.csv',
    input_size_bytes: 1024,
  } as FileStatusResponse
}

beforeEach(() => {
  mockGetFileColumns.mockReset()
  mockStartProcessing.mockReset()
  mockGetFileStatus.mockReset()
  mockGetFileColumns.mockResolvedValue({ columns: ['col_a'] })
})

describe('QuickProcessView — onStarted refresh + already-running', () => {
  it('fires onStarted after successful startProcessing so list refreshes', async () => {
    mockStartProcessing.mockResolvedValue({})
    const onStarted = jest.fn()
    render(
      <WizardDialog open={true} onOpenChange={() => {}} file={makeFile()} authToken="tok"
        onStarted={onStarted} mode="existing" />
    )
    await waitFor(() => screen.getByText('Process Now'))
    await act(async () => fireEvent.click(screen.getByText('Process Now')))
    await waitFor(() => expect(onStarted).toHaveBeenCalled())
  })

  it('fires onStarted when BE says "already being processed" (background path)', async () => {
    mockStartProcessing.mockRejectedValue(new Error('File is already being processed (status: DQ_RUNNING)'))
    const onStarted = jest.fn()
    render(
      <WizardDialog open={true} onOpenChange={() => {}} file={makeFile()} authToken="tok"
        onStarted={onStarted} mode="existing" />
    )
    await waitFor(() => screen.getByText('Process Now'))
    await act(async () => fireEvent.click(screen.getByText('Process Now')))
    await waitFor(() => expect(onStarted).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/running in the background/i)).toBeInTheDocument())
  })
})

describe('QuickProcessView — error classification', () => {
  it('maps ApiError 403 from startProcessing to permission-denied', async () => {
    mockStartProcessing.mockRejectedValue(new ApiError({ status: 403, message: 'Forbidden' }))
    render(
      <WizardDialog open={true} onOpenChange={() => {}} file={makeFile()} authToken="tok" mode="existing" />
    )
    await waitFor(() => screen.getByText('Process Now'))
    await act(async () => fireEvent.click(screen.getByText('Process Now')))
    await waitFor(() => {
      expect(screen.getByText(/do not have permission/i)).toBeInTheDocument()
    })
  })

  it('maps ApiError 500 to server-error message', async () => {
    mockStartProcessing.mockRejectedValue(new ApiError({ status: 500, message: 'oops' }))
    render(
      <WizardDialog open={true} onOpenChange={() => {}} file={makeFile()} authToken="tok" mode="existing" />
    )
    await waitFor(() => screen.getByText('Process Now'))
    await act(async () => fireEvent.click(screen.getByText('Process Now')))
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })
})

describe('WizardInitializer — REJECTED file column-load surfaces failure_reason', () => {
  it('shows BE failure_reason when getFileColumns rejects and status is REJECTED', async () => {
    mockGetFileColumns.mockRejectedValue(new Error('400 Bad Request'))
    mockGetFileStatus.mockResolvedValue({
      upload_id: 'uid-quick',
      status: 'REJECTED',
      failure_reason: 'utf-16 encoding not supported',
    })
    render(
      <WizardDialog open={true} onOpenChange={() => {}} file={makeFile()} authToken="tok" mode="existing" />
    )
    await waitFor(() => {
      expect(screen.getByText(/utf-16 encoding not supported/i)).toBeInTheDocument()
    })
  })
})
