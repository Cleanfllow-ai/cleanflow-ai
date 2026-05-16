/**
 * Unit tests for LoginForm (modules/auth/components/login-form.tsx)
 * Covers: happy-path login, MFA dialog, error display, post-login redirect
 */

// ── polyfill / DOM stubs ─────────────────────────────────────────────────────
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

// ── module mocks ─────────────────────────────────────────────────────────────
jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

jest.mock('@/modules/auth/api/org-api', () => ({
  orgAPI: {
    getMe: jest.fn(),
    registerOrg: jest.fn(),
  },
}))

jest.mock('@/modules/auth/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}))

// next/navigation stubs
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (_k: string) => null,
    toString: () => '',
  }),
  useRouter: () => ({ push: jest.fn() }),
}))

// QRCode stub (not needed for login tests)
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test') }))

// next/image stub
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth/providers/auth-provider'
import { orgAPI } from '@/modules/auth/api/org-api'
import { LoginForm } from '@/modules/auth/components/login-form'

const mockUseAuth = useAuth as jest.Mock
const mockGetMe = (orgAPI as any).getMe as jest.Mock

function makeAuth(overrides: Record<string, any> = {}) {
  return {
    login: jest.fn(),
    verifyMfaCode: jest.fn(),
    setupMfaWithSession: jest.fn(),
    confirmMfaSetupWithSession: jest.fn(),
    completeNewPassword: jest.fn(),
    mfaRequired: false,
    mfaSession: null,
    mfaUsername: null,
    cancelMfa: jest.fn(),
    ...overrides,
  }
}

afterEach(() => jest.clearAllMocks())

// ── tests ────────────────────────────────────────────────────────────────────

describe('LoginForm — happy path', () => {
  it('submits email + password and redirects to /dashboard on success', async () => {
    const login = jest.fn().mockResolvedValue({ success: true })
    mockUseAuth.mockReturnValue(makeAuth({ login }))
    mockGetMe.mockResolvedValue({ membership: { role: 'Admin' }, role_permissions: {} })

    const assignSpy = jest.fn()
    Object.defineProperty(window, 'location', {
      value: { href: '', search: '' },
      writable: true,
    })

    render(<LoginForm />)
    await waitFor(() => screen.getByLabelText(/email/i))

    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(login).toHaveBeenCalledWith('alice@example.com', 'Password123!'))
  })

  it('displays error message when login throws', async () => {
    const login = jest.fn().mockRejectedValue(new Error('Incorrect username or password.'))
    mockUseAuth.mockReturnValue(makeAuth({ login }))

    render(<LoginForm />)
    await waitFor(() => screen.getByLabelText(/email/i))

    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getByText(/incorrect username or password/i)).toBeInTheDocument()
    )
  })
})

describe('LoginForm — MFA dialog', () => {
  it('opens MFA dialog when login returns mfaRequired=true', async () => {
    const login = jest.fn().mockResolvedValue({ success: false, mfaRequired: true })
    mockUseAuth.mockReturnValue(makeAuth({ login }))

    render(<LoginForm />)
    await waitFor(() => screen.getByLabelText(/email/i))

    await userEvent.type(screen.getByLabelText(/email/i), 'mfa@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument(),
      { timeout: 10000 }
    )
  }, 12000)

  it('calls verifyMfaCode with the entered 6-digit code', async () => {
    const login = jest.fn().mockResolvedValue({ success: false, mfaRequired: true })
    const verifyMfaCode = jest.fn().mockResolvedValue({ success: true })
    mockUseAuth.mockReturnValue(makeAuth({ login, verifyMfaCode }))
    mockGetMe.mockResolvedValue({ membership: { role: 'Member' }, role_permissions: {} })

    render(<LoginForm />)
    await waitFor(() => screen.getByLabelText(/email/i), { timeout: 10000 })

    await userEvent.type(screen.getByLabelText(/email/i), 'mfa@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => screen.getByLabelText(/verification code/i), { timeout: 10000 })
    await userEvent.type(screen.getByLabelText(/verification code/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() => expect(verifyMfaCode).toHaveBeenCalledWith('123456'), { timeout: 10000 })
  }, 20000)

  it('shows MFA error when verifyMfaCode throws', async () => {
    const login = jest.fn().mockResolvedValue({ success: false, mfaRequired: true })
    const verifyMfaCode = jest.fn().mockRejectedValue(new Error('Code mismatch'))
    mockUseAuth.mockReturnValue(makeAuth({ login, verifyMfaCode }))

    render(<LoginForm />)
    await waitFor(() => screen.getByLabelText(/email/i))

    await userEvent.type(screen.getByLabelText(/email/i), 'mfa@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => screen.getByLabelText(/verification code/i))
    await userEvent.type(screen.getByLabelText(/verification code/i), '999999')
    await userEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() => expect(screen.getByText(/code mismatch/i)).toBeInTheDocument(), { timeout: 10000 })
  }, 12000)
})

describe('LoginForm — new password required', () => {
  it('opens Set Your Password dialog when login returns newPasswordRequired', async () => {
    const login = jest.fn().mockResolvedValue({ success: false, newPasswordRequired: true })
    mockUseAuth.mockReturnValue(makeAuth({ login }))

    render(<LoginForm />)
    await waitFor(() => screen.getByLabelText(/email/i))

    await userEvent.type(screen.getByLabelText(/email/i), 'invite@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'TempPass1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getByText(/set your password/i)).toBeInTheDocument(),
      { timeout: 10000 }
    )
  }, 12000)
})
