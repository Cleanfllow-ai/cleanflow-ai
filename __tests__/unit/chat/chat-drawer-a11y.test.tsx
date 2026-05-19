/**
 * P0-4: Chat drawer a11y — role=dialog, aria-modal, aria-labels, Esc handler
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
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

jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

jest.mock('framer-motion', () => {
  const React = require('react')
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) =>
        React.createElement('div', { ...props, ref }, children)
      ),
    },
    AnimatePresence: ({ children }: any) => children,
  }
})

jest.mock('react-markdown', () => ({ children }: any) => {
  const React = require('react')
  return React.createElement('div', { 'data-testid': 'markdown' }, children)
})

jest.mock('@/components/ui/scroll-area', () => {
  const React = require('react')
  return {
    ScrollArea: ({ children, ...props }: any) => React.createElement('div', props, children),
  }
})

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ChatDrawer } from '@/modules/chat/components/chat-drawer'

describe('P0-4: ChatDrawer a11y', () => {
  it('renders with role=dialog when open', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('dialog has aria-modal=true', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('dialog has descriptive aria-label', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'RightRev Assistant')
  })

  it('close button has aria-label', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Close assistant' })).toBeInTheDocument()
  })

  it('clear history button has aria-label', () => {
    render(<ChatDrawer isOpen={true} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Clear chat history' })).toBeInTheDocument()
  })

  it('Esc key calls onClose', () => {
    const onClose = jest.fn()
    render(<ChatDrawer isOpen={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc key does NOT call onClose when drawer is closed', () => {
    const onClose = jest.fn()
    render(<ChatDrawer isOpen={false} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
