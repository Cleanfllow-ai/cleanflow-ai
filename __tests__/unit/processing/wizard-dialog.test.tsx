/**
 * Unit tests for WizardDialog (WizardDialog.tsx)
 * Covers: dialog open/close, loading state, error state,
 *         Process Now vs Advanced Configuration landing,
 *         QuickProcessView polling states
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

jest.mock('@/shared/lib/dq-rules', () => ({
  getRuleLabel: jest.fn((id: string) => id),
}))

// Stub heavy wizard sub-components
jest.mock('@/modules/processing/components/ProcessingWizard', () => ({
  ProcessingWizard: () => <div data-testid="processing-wizard">ProcessingWizard</div>,
}))
jest.mock('@/modules/processing/components/steps/SourceStep', () => ({
  SourceStep: ({ onUploadComplete }: any) => (
    <div data-testid="source-step">
      <button onClick={onUploadComplete}>FinishUpload</button>
    </div>
  ),
}))

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { WizardDialog } from '@/modules/processing/components/WizardDialog'
import { fileManagementAPI } from '@/modules/files'
import type { FileStatusResponse } from '@/modules/files/types/file.types'

const mockGetFileColumns = fileManagementAPI.getFileColumns as jest.Mock
const mockStartProcessing = fileManagementAPI.startProcessing as jest.Mock
const mockGetFileStatus = fileManagementAPI.getFileStatus as jest.Mock

function makeFile(overrides: Partial<FileStatusResponse> = {}): FileStatusResponse {
  return {
    upload_id: 'uid-test',
    status: 'VALIDATED',
    original_filename: 'sales.csv',
    input_size_bytes: 1024 * 512,
    ...overrides,
  } as FileStatusResponse
}

afterEach(() => jest.clearAllMocks())

describe('WizardDialog — renders nothing when no file in existing mode', () => {
  it('returns null when file is missing', () => {
    const { container } = render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={null}
        authToken="tok"
        mode="existing"
      />
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('WizardDialog — existing mode loading state', () => {
  it('shows loading spinner while fetching columns', async () => {
    mockGetFileColumns.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ columns: ['a', 'b'] }), 200))
    )
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        authToken="tok"
        mode="existing"
      />
    )
    expect(screen.getByText(/Loading file info/i)).toBeInTheDocument()
  })

  it('shows error when columns fetch fails', async () => {
    mockGetFileColumns.mockRejectedValue(new Error('Network error'))
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        authToken="tok"
        mode="existing"
      />
    )
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument())
  })
})

describe('WizardDialog — existing mode landing page', () => {
  beforeEach(() => {
    mockGetFileColumns.mockResolvedValue({ columns: ['col_a', 'col_b'] })
  })

  it('shows Process Now and Advanced Configuration options', async () => {
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        authToken="tok"
        mode="existing"
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Process Now')).toBeInTheDocument()
      expect(screen.getByText('Advanced Configuration')).toBeInTheDocument()
    })
  })

  it('shows file name in the dialog title', async () => {
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile({ original_filename: 'invoices.csv' })}
        authToken="tok"
        mode="existing"
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/Process: invoices\.csv/i)).toBeInTheDocument()
    })
  })

  it('clicking Advanced Configuration renders the ProcessingWizard', async () => {
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        authToken="tok"
        mode="existing"
      />
    )
    await waitFor(() => screen.getByText('Advanced Configuration'))
    fireEvent.click(screen.getByText('Advanced Configuration'))
    await waitFor(() => expect(screen.getByTestId('processing-wizard')).toBeInTheDocument())
  })
})

describe('WizardDialog — QuickProcessView polling', () => {
  beforeEach(() => {
    mockGetFileColumns.mockResolvedValue({ columns: ['col_a'] })
  })

  it('shows processing spinner after Process Now click', async () => {
    mockStartProcessing.mockResolvedValue({})
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        authToken="tok"
        mode="existing"
      />
    )
    await waitFor(() => screen.getByText('Process Now'))
    await act(async () => fireEvent.click(screen.getByText('Process Now')))
    // After startProcessing resolves → "processing" state shows spinner text
    await waitFor(() =>
      expect(screen.getAllByText(/Processing started|Processing|Starting/i).length).toBeGreaterThanOrEqual(1)
    )
  })

  it('shows error state when startProcessing rejects', async () => {
    mockStartProcessing.mockRejectedValue(new Error('500 Internal Server Error'))
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        authToken="tok"
        mode="existing"
      />
    )
    await waitFor(() => screen.getByText('Process Now'))
    await act(async () => fireEvent.click(screen.getByText('Process Now')))
    await waitFor(() =>
      expect(screen.getByText('Processing Failed')).toBeInTheDocument()
    )
  })
})

describe('WizardDialog — new mode (import only)', () => {
  it('renders Import File title in new mode', () => {
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        authToken="tok"
        mode="new"
      />
    )
    expect(screen.getByText('Import File')).toBeInTheDocument()
  })

  it('renders SourceStep in new mode', async () => {
    render(
      <WizardDialog
        open={true}
        onOpenChange={() => {}}
        authToken="tok"
        mode="new"
      />
    )
    await waitFor(() => expect(screen.getByTestId('source-step')).toBeInTheDocument())
  })
})
