/**
 * Unit tests for ChatButton + ChatDrawer (chat panel)
 * Covers: toggle open/close, input + send, message list, suggestions, clear history
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

// jsdom does not implement scrollIntoView — patch it globally
window.HTMLElement.prototype.scrollIntoView = function () {}

// Use var so the declaration is hoisted above the jest.mock factory
// eslint-disable-next-line no-var
var mockPathnameValue = '/dashboard'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathnameValue,
}))

jest.mock('@/shared/store/store', () => ({
  useAppSelector: jest.fn().mockReturnValue([]),
}))

jest.mock('@/modules/files/store/filesSlice', () => ({
  selectFiles: jest.fn(),
}))

jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

jest.mock('framer-motion', () => {
  const React = require('react')
  return {
    motion: {
      div: ({ children, ...props }: any) => React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: any) => children,
  }
})

jest.mock('react-markdown', () => ({ children }: any) => {
  const React = require('react')
  return React.createElement('div', { 'data-testid': 'markdown' }, children)
})

// Make ScrollArea transparent in jsdom — Radix's scroll area viewport doesn't
// render children in jsdom's layout environment.
jest.mock('@/components/ui/scroll-area', () => {
  const React = require('react')
  return {
    ScrollArea: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'scroll-area', ...props }, children),
  }
})

import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ChatButton } from '@/modules/chat/components/chat-button'
import { ChatDrawer } from '@/modules/chat/components/chat-drawer'

const originalFetch = global.fetch
function mockFetchSuccess(reply = 'Sure, here is the answer.') {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ reply, sources: [] }),
  }) as any
}

beforeEach(() => {
  localStorage.clear()
  global.fetch = originalFetch
  mockPathnameValue = '/dashboard'
})
afterEach(() => {
  global.fetch = originalFetch
  jest.clearAllMocks()
})

describe('ChatButton — toggle', () => {
  it('renders the open-chat button when closed', () => {
    render(<ChatButton />)
    expect(screen.getByRole('button', { name: /open help chat/i })).toBeInTheDocument()
  })

  it('opens the drawer when the floating button is clicked', async () => {
    render(<ChatButton />)
    fireEvent.click(screen.getByRole('button', { name: /open help chat/i }))
    await waitFor(() =>
      expect(screen.getByText('RightRev Assistant')).toBeInTheDocument()
    )
  })

  it('ChatDrawer hides content when isOpen=false', () => {
    const { rerender } = render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    expect(screen.getByText('RightRev Assistant')).toBeInTheDocument()
    rerender(<ChatDrawer isOpen={false} onClose={() => {}} />)
    expect(screen.queryByText('RightRev Assistant')).not.toBeInTheDocument()
  })
})

describe('ChatDrawer — empty state', () => {
  it('shows empty state with suggestions when no messages', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    expect(screen.getByText(/how can i help you/i)).toBeInTheDocument()
  })

  it('renders dashboard suggestions on /dashboard pathname', () => {
    mockPathnameValue = '/dashboard'
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    expect(screen.getByText('What do the dashboard metrics mean?')).toBeInTheDocument()
  })

  it('renders files suggestions on /files pathname', () => {
    mockPathnameValue = '/files'
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    expect(screen.getByText('How do I upload a file?')).toBeInTheDocument()
  })

  it('clicking a suggestion populates the input', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const suggestion = screen.getByText('What do the dashboard metrics mean?')
    fireEvent.click(suggestion)
    const input = screen.getByPlaceholderText('Ask a question...')
    expect((input as HTMLInputElement).value).toBe('What do the dashboard metrics mean?')
  })
})

describe('ChatDrawer — send message', () => {
  it('send button is disabled when input is empty', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    // The send button is disabled when input is empty (disabled attr present)
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons[buttons.length - 1] // last button is send
    expect(sendBtn).toBeDisabled()
  })

  it('enables send button when input has text', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Hello' } })
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons[buttons.length - 1]
    expect(sendBtn).not.toBeDisabled()
  })

  it('sends message on button click and displays user bubble', async () => {
    mockFetchSuccess()
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'What is DQ score?' } })
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons[buttons.length - 1]
    await act(async () => { fireEvent.click(sendBtn) })
    await waitFor(() =>
      expect(screen.getByText('What is DQ score?')).toBeInTheDocument()
    )
  })

  it('sends message on Enter key press', async () => {
    mockFetchSuccess('The DQ score measures data quality.')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Explain DQ score' } })
    await act(async () => {
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })
    })
    await waitFor(() =>
      expect(screen.getByText('Explain DQ score')).toBeInTheDocument()
    )
  })

  it('displays assistant reply after successful fetch', async () => {
    mockFetchSuccess('You can upload CSV files.')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'How to upload?' } })
    const buttons = screen.getAllByRole('button')
    await act(async () => { fireEvent.click(buttons[buttons.length - 1]) })
    await waitFor(() =>
      expect(screen.getByText('You can upload CSV files.')).toBeInTheDocument()
    )
  })

  it('clears input after send', async () => {
    mockFetchSuccess()
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Test message' } })
    const buttons = screen.getAllByRole('button')
    await act(async () => { fireEvent.click(buttons[buttons.length - 1]) })
    await waitFor(() =>
      expect((input as HTMLInputElement).value).toBe('')
    )
  })
})

describe('ChatDrawer — clear history', () => {
  it('clear-history button removes messages', async () => {
    mockFetchSuccess('Reply.')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Hello' } })
    const buttons = screen.getAllByRole('button')
    await act(async () => { fireEvent.click(buttons[buttons.length - 1]) })
    await waitFor(() => screen.getByText('Hello'))

    fireEvent.click(screen.getByRole('button', { name: 'Clear chat history' }))
    await waitFor(() =>
      expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    )
  })
})
