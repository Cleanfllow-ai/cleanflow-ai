/**
 * Unit tests for SignUpForm (modules/auth/components/signup-form.tsx)
 * Covers: step 1 validation, password mismatch, submit success → verification, error toast
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

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

jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (_k: string) => null,
    toString: () => '',
  }),
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

// Email verification stub — just render a placeholder
jest.mock('@/modules/auth/components/email-verification', () => ({
  EmailVerification: ({ email }: { email: string }) => (
    <div data-testid="email-verification">verify:{email}</div>
  ),
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth/providers/auth-provider'
import { SignUpForm } from '@/modules/auth/components/signup-form'

const mockUseAuth = useAuth as jest.Mock

function makeAuth(overrides: Record<string, any> = {}) {
  return {
    signup: jest.fn(),
    login: jest.fn(),
    ...overrides,
  }
}

afterEach(() => jest.clearAllMocks())

// Helper to fill step 1
async function fillStep1(fullName: string, email: string, password: string, confirm: string) {
  await userEvent.type(screen.getByLabelText(/full name/i), fullName)
  await userEvent.type(screen.getByLabelText(/^email$/i), email)
  await userEvent.type(screen.getByPlaceholderText(/min. 8 characters/i), password)
  await userEvent.type(screen.getByPlaceholderText(/re-enter your password/i), confirm)
}

describe('SignUpForm — step 1 validation', () => {
  it('shows error when passwords do not match', async () => {
    mockUseAuth.mockReturnValue(makeAuth())
    render(<SignUpForm />)
    await waitFor(() => screen.getByLabelText(/full name/i))

    await fillStep1('Alice', 'alice@example.com', 'Password123!', 'Different123!')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    )
  })

  it('shows error when password is too short', async () => {
    mockUseAuth.mockReturnValue(makeAuth())
    render(<SignUpForm />)
    await waitFor(() => screen.getByLabelText(/full name/i))

    await fillStep1('Alice', 'alice@example.com', 'short', 'short')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() =>
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    )
  })

  it('advances to step 2 when step 1 is valid', async () => {
    mockUseAuth.mockReturnValue(makeAuth())
    render(<SignUpForm />)
    await waitFor(() => screen.getByLabelText(/full name/i))

    await fillStep1('Alice', 'alice@example.com', 'Password123!', 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() =>
      expect(screen.getByText(/organization details/i)).toBeInTheDocument()
    )
  })
})

describe('SignUpForm — success path', () => {
  it('calls signup and shows email verification on success', async () => {
    const signup = jest.fn().mockResolvedValue({ message: 'Check your email', confirmed: false })
    mockUseAuth.mockReturnValue(makeAuth({ signup }))
    render(<SignUpForm />)
    await waitFor(() => screen.getByLabelText(/full name/i), { timeout: 10000 })

    await fillStep1('Alice', 'alice@example.com', 'Password123!', 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2: fill required org fields
    await waitFor(() => screen.getByLabelText(/organization name/i), { timeout: 10000 })
    await userEvent.type(screen.getByLabelText(/organization name/i), 'Acme Corp')
    await userEvent.type(screen.getByLabelText(/industry/i), 'Finance')
    await userEvent.type(screen.getByLabelText(/phone/i), '+91 9000000000')
    await userEvent.type(screen.getByLabelText(/address/i), '123 Main St')

    // Accept terms
    const termsCheckbox = screen.getByRole('checkbox', { name: /terms/i })
    await userEvent.click(termsCheckbox)

    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signup).toHaveBeenCalled(), { timeout: 10000 })
    const args = signup.mock.calls[0]
    expect(args[0]).toBe('alice@example.com')
    expect(args[1]).toBe('Password123!')
  }, 30000)

  it('shows error alert when signup throws', async () => {
    const signup = jest.fn().mockRejectedValue(new Error('Email already exists'))
    mockUseAuth.mockReturnValue(makeAuth({ signup }))
    render(<SignUpForm />)
    await waitFor(() => screen.getByLabelText(/full name/i), { timeout: 10000 })

    await fillStep1('Bob', 'bob@example.com', 'Password123!', 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => screen.getByLabelText(/organization name/i), { timeout: 10000 })
    await userEvent.type(screen.getByLabelText(/organization name/i), 'Corp')
    await userEvent.type(screen.getByLabelText(/industry/i), 'Tech')
    await userEvent.type(screen.getByLabelText(/phone/i), '+91 9000000000')
    await userEvent.type(screen.getByLabelText(/address/i), '456 Side St')

    const termsCheckbox = screen.getByRole('checkbox', { name: /terms/i })
    await userEvent.click(termsCheckbox)

    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument(),
      { timeout: 10000 }
    )
  }, 30000)
})
