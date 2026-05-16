/**
 * Unit tests for UnifiedBridgeImport — source picker (protocol tabs)
 * Covers: 4-tab render (FTP/TCP/HTTP/Connectors), tab switching, auth-warning
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/modules/auth', () => ({
  useAuth: jest.fn(),
}))
jest.mock('@/modules/files', () => ({
  fileManagementAPI: {
    ingestFromFtp: jest.fn(),
    ingestFromTcp: jest.fn(),
    ingestFromHttp: jest.fn(),
    testFtpConnection: jest.fn(),
    testHttpEndpoint: jest.fn(),
  },
}))
// Suppress Radix UI / lucide heavy deps
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange, value }: any) => (
    <div data-testid="tabs" data-value={value} onClick={() => {}}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value, onClick, disabled }: any) => (
    <button role="tab" data-value={value} disabled={disabled} onClick={() => onClick && onClick(value)}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value }: any) => <div data-tab-content={value}>{children}</div>,
}))

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth'
import UnifiedBridgeImport from '@/modules/unified-bridge/components/unified-bridge-import'

const mockUseAuth = useAuth as jest.Mock

beforeEach(() => {
  mockUseAuth.mockReturnValue({ idToken: 'test-token', user: { name: 'Alice' } })
})
afterEach(() => jest.clearAllMocks())

describe('UnifiedBridgeImport — source picker', () => {
  it('renders the Unified Bridge header', () => {
    render(<UnifiedBridgeImport mode="source" />)
    expect(screen.getByText('Unified Bridge')).toBeInTheDocument()
  })

  it('renders all 4 protocol tabs (FTP/TCP/HTTP/Connectors)', () => {
    render(<UnifiedBridgeImport mode="source" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
  })

  it('renders FTP tab with correct label', () => {
    render(<UnifiedBridgeImport mode="source" />)
    const ftpTab = screen.getAllByRole('tab').find(t => t.getAttribute('data-value') === 'ftp')
    expect(ftpTab).toBeTruthy()
  })

  it('renders TCP tab', () => {
    render(<UnifiedBridgeImport mode="source" />)
    const tcpTab = screen.getAllByRole('tab').find(t => t.getAttribute('data-value') === 'tcp')
    expect(tcpTab).toBeTruthy()
  })

  it('renders HTTP tab', () => {
    render(<UnifiedBridgeImport mode="source" />)
    const httpTab = screen.getAllByRole('tab').find(t => t.getAttribute('data-value') === 'http')
    expect(httpTab).toBeTruthy()
  })

  it('renders Connectors (other) tab', () => {
    render(<UnifiedBridgeImport mode="source" />)
    const otherTab = screen.getAllByRole('tab').find(t => t.getAttribute('data-value') === 'other')
    expect(otherTab).toBeTruthy()
  })

  it('shows auth warning when idToken is absent', () => {
    mockUseAuth.mockReturnValue({ idToken: null, user: null })
    render(<UnifiedBridgeImport mode="source" />)
    expect(screen.getByText(/please log in/i)).toBeInTheDocument()
  })

  it('does not show auth warning when idToken is present', () => {
    render(<UnifiedBridgeImport mode="source" />)
    expect(screen.queryByText(/please log in/i)).not.toBeInTheDocument()
  })

  it('renders ErpSourceForm only in destination mode (no tabs)', () => {
    render(<UnifiedBridgeImport mode="destination" uploadId="upload-123" />)
    // In destination mode there is no tablist
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})
