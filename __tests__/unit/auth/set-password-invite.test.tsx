/**
 * Unit tests for InviteSetPasswordForm (modules/auth/components/invite-set-password-form.tsx)
 * Covers: invalid invite link, password validation, success redirect, error toasts
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

// Capture the router.push calls
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/modules/auth/api/org-api', () => ({
  orgAPI: {
    setInvitePassword: jest.fn(),
  },
}))

const mockToast = jest.fn()
jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

jest.mock('@/modules/shared/api-error', () => ({
  isApiError: (e: any) => e && typeof e === 'object' && 'code' in e,
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { useSearchParams } from 'next/navigation'
import { orgAPI } from '@/modules/auth/api/org-api'
import { InviteSetPasswordForm } from '@/modules/auth/components/invite-set-password-form'

const mockUseSearchParams = useSearchParams as jest.Mock
const mockSetInvitePassword = (orgAPI as any).setInvitePassword as jest.Mock

function validSearchParams() {
  return {
    get: (k: string) => {
      const m: Record<string, string> = {
        org_id: 'org-123',
        invite_id: 'inv-456',
        token: 'tok-abc',
        email: 'new@example.com',
      }
      return m[k] ?? null
    },
  }
}

function invalidSearchParams() {
  return { get: (_k: string) => null }
}

afterEach(() => jest.clearAllMocks())

describe('InviteSetPasswordForm — invalid link', () => {
  it('shows an invalid-link alert when params are missing', () => {
    mockUseSearchParams.mockReturnValue(invalidSearchParams())
    render(<InviteSetPasswordForm />)
    expect(screen.getByText(/invalid or incomplete/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set password/i })).toBeDisabled()
  })
})

describe('InviteSetPasswordForm — password validation', () => {
  it('shows strength error for short password', async () => {
    mockUseSearchParams.mockReturnValue(validSearchParams())
    render(<InviteSetPasswordForm />)

    await userEvent.type(screen.getByLabelText(/^password$/i), 'abc')
    await userEvent.tab() // blur to trigger validation render

    expect(screen.getByRole('alert')).toHaveTextContent(/8\+ chars/i)
  })

  it('shows mismatch error when passwords differ', async () => {
    mockUseSearchParams.mockReturnValue(validSearchParams())
    mockSetInvitePassword.mockResolvedValue({})
    render(<InviteSetPasswordForm />)

    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Different999!')
    await userEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    )
    expect(mockSetInvitePassword).not.toHaveBeenCalled()
  })
})

describe('InviteSetPasswordForm — success path', () => {
  it('calls orgAPI.setInvitePassword with correct params and redirects to login', async () => {
    mockUseSearchParams.mockReturnValue(validSearchParams())
    mockSetInvitePassword.mockResolvedValue({})
    render(<InviteSetPasswordForm />)

    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(mockSetInvitePassword).toHaveBeenCalledWith(
        'org-123', 'inv-456', 'tok-abc', 'new@example.com', 'Password123!', null
      )
    })

    // Should redirect to /auth/login — token must NOT be in the URL
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    const redirectUrl: string = mockPush.mock.calls[0][0]
    expect(redirectUrl).toContain('/auth/login')
    expect(redirectUrl).not.toContain('tok-abc') // single-use token must be stripped
    expect(redirectUrl).toContain('email=new%40example.com')
  })

  it('shows success toast on password set', async () => {
    mockUseSearchParams.mockReturnValue(validSearchParams())
    mockSetInvitePassword.mockResolvedValue({})
    render(<InviteSetPasswordForm />)

    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Password set' })
      )
    })
  })
})

describe('InviteSetPasswordForm — API error handling', () => {
  it('shows destructive toast on InviteExpiredError', async () => {
    mockUseSearchParams.mockReturnValue(validSearchParams())
    const apiError = { code: 'InviteExpiredError', action: 'request_new_invite', message: 'Expired' }
    mockSetInvitePassword.mockRejectedValue(apiError)
    render(<InviteSetPasswordForm />)

    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      )
    )
  })
})
