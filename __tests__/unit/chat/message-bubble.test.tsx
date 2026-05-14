/**
 * Unit tests for message-bubble rendering inside ChatDrawer
 * Covers: user vs assistant layout, markdown/code rendering, copy button, sources badges
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

// jsdom does not implement scrollIntoView — patch it globally
window.HTMLElement.prototype.scrollIntoView = function () {}

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

jest.mock('@/shared/store/store', () => ({
  useAppSelector: jest.fn().mockReturnValue([]),
}))

jest.mock('@/modules/files/store/filesSlice', () => ({
  selectFiles: jest.fn(),
}))

const mockToast = jest.fn()
jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
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

// Make ScrollArea transparent in jsdom (Radix viewport doesn't render children in jsdom)
jest.mock('@/components/ui/scroll-area', () => {
  const React = require('react')
  return {
    ScrollArea: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'scroll-area', ...props }, children),
  }
})

// ReactMarkdown: render children so inline code/text tests can find text content
jest.mock('react-markdown', () => {
  const React = require('react')
  return function MockMarkdown({ children, components }: any) {
    // Split on backtick-wrapped code to simulate inline code rendering
    if (typeof children !== 'string') return React.createElement('div', null, children)
    const parts = children.split(/(`[^`]+`)/)
    return React.createElement('div', { 'data-testid': 'markdown' },
      parts.map((part: string, i: number) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          const code = part.slice(1, -1)
          if (components?.code) {
            return React.createElement(components.code, { key: i }, code)
          }
          return React.createElement('code', { key: i }, code)
        }
        return part
      })
    )
  }
})

import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ChatDrawer } from '@/modules/chat/components/chat-drawer'

const originalFetch = global.fetch

function seedMessages(userText: string, assistantText: string, sources?: any[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ reply: assistantText, sources: sources ?? [] }),
  }) as any
}

async function sendMessage(text: string) {
  const input = screen.getByPlaceholderText('Ask a question...')
  fireEvent.change(input, { target: { value: text } })
  const buttons = screen.getAllByRole('button')
  await act(async () => { fireEvent.click(buttons[buttons.length - 1]) })
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  global.fetch = originalFetch
  jest.clearAllMocks()
})

describe('Message bubble — user messages', () => {
  it('renders user message content in a bubble', async () => {
    seedMessages('My question', 'My answer')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('My question')
    await waitFor(() =>
      expect(screen.getByText('My question')).toBeInTheDocument()
    )
  })

  it('user bubble does NOT have a copy button', async () => {
    seedMessages('User msg', 'Assistant msg')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('User msg')
    await waitFor(() => screen.getByText('User msg'))
    // Only assistant message should have a copy button
    const copyBtns = screen.queryAllByTitle('Copy message')
    // Assert there is at most one (the assistant one), none for the user
    expect(copyBtns.length).toBeLessThanOrEqual(1)
  })
})

describe('Message bubble — assistant messages', () => {
  it('renders assistant reply via ReactMarkdown', async () => {
    seedMessages('Question', 'The **answer** is here.')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('Question')
    await waitFor(() =>
      expect(screen.getByTestId('markdown')).toBeInTheDocument()
    )
  })

  it('assistant bubble has a Copy button', async () => {
    seedMessages('Ping', 'Pong reply')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('Ping')
    await waitFor(() => screen.getByText('Pong reply'))
    expect(screen.getByTitle('Copy message')).toBeInTheDocument()
  })

  it('copy button changes to "Copied" feedback after click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
    seedMessages('Copy test', 'Content to copy')
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('Copy test')
    await waitFor(() => screen.getByTitle('Copy message'))
    const copyBtn = screen.getByTitle('Copy message')
    await act(async () => { fireEvent.click(copyBtn) })
    await waitFor(() =>
      expect(screen.getByText('Copied')).toBeInTheDocument()
    )
  })

  it('renders source badges when sources are present', async () => {
    seedMessages('Sources question', 'Here is what I found.', [
      { score: 0.9, section: 'File Upload' },
      { score: 0.8, section: 'DQ Rules' },
    ])
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('Sources question')
    await waitFor(() => screen.getByText('File Upload'))
    expect(screen.getByText('DQ Rules')).toBeInTheDocument()
  })

  it('renders at most 3 source badges even with more sources', async () => {
    seedMessages('Many sources', 'Reply', [
      { score: 0.9, section: 'S1' },
      { score: 0.8, section: 'S2' },
      { score: 0.7, section: 'S3' },
      { score: 0.6, section: 'S4' },
    ])
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('Many sources')
    await waitFor(() => screen.getByText('S1'))
    expect(screen.getByText('S2')).toBeInTheDocument()
    expect(screen.getByText('S3')).toBeInTheDocument()
    expect(screen.queryByText('S4')).not.toBeInTheDocument()
  })

  it('does not render source badges when sources array is empty', async () => {
    seedMessages('No sources', 'Clean reply', [])
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('No sources')
    await waitFor(() => screen.getByText('Clean reply'))
    expect(screen.queryByText('docs')).not.toBeInTheDocument()
  })
})

describe('Message bubble — error handling', () => {
  it('shows toast (not a fake assistant bubble) when fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    await sendMessage('Trigger error')
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Chat unavailable', variant: 'destructive' })
      )
    )
  })
})
