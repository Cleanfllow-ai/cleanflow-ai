/**
 * Unit tests for ForgotPasswordPage (app/auth/forgot-password/page.tsx)
 * Covers: send-code step, reset-password step, validation, success redirect, error display
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: {
    API_BASE_URL: 'https://api.test.com',
    COGNITO: { USER_POOL_ID: 'us-east-1_test', CLIENT_ID: 'test-client', REGION: 'us-east-1' },
  },
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

jest.mock('@/modules/auth/api/cognito-client', () => ({
  cognitoApi: {
    forgotPassword: jest.fn(),
    confirmForgotPassword: jest.fn(),
  },
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ForgotPasswordPage from '@/app/auth/forgot-password/page'
import { cognitoApi } from '@/modules/auth/api/cognito-client'

const mockForgotPassword = cognitoApi.forgotPassword as jest.Mock
const mockConfirmForgotPassword = cognitoApi.confirmForgotPassword as jest.Mock

afterEach(() => jest.clearAllMocks())

describe('ForgotPasswordPage — send code step', () => {
  it('renders the email input and send button on initial load', () => {
    render(<ForgotPasswordPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset code/i })).toBeInTheDocument()
  })

  it('calls cognitoApi.forgotPassword with the entered email', async () => {
    mockForgotPassword.mockResolvedValue({})
    render(<ForgotPasswordPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset code/i }))

    await waitFor(() =>
      expect(mockForgotPassword).toHaveBeenCalledWith('alice@example.com')
    )
  })

  it('advances to the reset step after sending code successfully', async () => {
    mockForgotPassword.mockResolvedValue({})
    render(<ForgotPasswordPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset code/i }))

    await waitFor(() =>
      expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('shows error when forgotPassword throws', async () => {
    mockForgotPassword.mockRejectedValue(new Error('User not found'))
    render(<ForgotPasswordPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'nobody@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset code/i }))

    await waitFor(() =>
      expect(screen.getByText(/user not found/i)).toBeInTheDocument()
    )
  })
})

describe('ForgotPasswordPage — reset password step', () => {
  async function navigateToResetStep(email = 'alice@example.com') {
    mockForgotPassword.mockResolvedValue({})
    render(<ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText(/email/i), email)
    await userEvent.click(screen.getByRole('button', { name: /send reset code/i }))
    await waitFor(() => screen.getByLabelText(/reset code/i))
  }

  it('shows password mismatch error when passwords differ', async () => {
    await navigateToResetStep()

    await userEvent.type(screen.getByLabelText(/reset code/i), '123456')
    await userEvent.type(screen.getByLabelText(/new password/i), 'Password123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Different999!')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    )
    expect(mockConfirmForgotPassword).not.toHaveBeenCalled()
  })

  it('shows too-short error when new password is under 8 chars', async () => {
    await navigateToResetStep()

    await userEvent.type(screen.getByLabelText(/reset code/i), '123456')
    await userEvent.type(screen.getByLabelText(/new password/i), 'short')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() =>
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    )
    expect(mockConfirmForgotPassword).not.toHaveBeenCalled()
  })

  it('calls confirmForgotPassword with email, code, and new password', async () => {
    await navigateToResetStep('alice@example.com')
    mockConfirmForgotPassword.mockResolvedValue({})

    await userEvent.type(screen.getByLabelText(/reset code/i), '654321')
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'NewPass123!')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() =>
      expect(mockConfirmForgotPassword).toHaveBeenCalledWith(
        'alice@example.com',
        '654321',
        'NewPass123!'
      )
    )
  })

  it('shows success state after successful reset', async () => {
    await navigateToResetStep()
    mockConfirmForgotPassword.mockResolvedValue({})

    await userEvent.type(screen.getByLabelText(/reset code/i), '654321')
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'NewPass123!')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() =>
      expect(screen.getByText(/password reset successful/i)).toBeInTheDocument()
    )
  })

  it('shows error when confirmForgotPassword throws', async () => {
    await navigateToResetStep()
    mockConfirmForgotPassword.mockRejectedValue(new Error('Code expired'))

    await userEvent.type(screen.getByLabelText(/reset code/i), '000000')
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'NewPass123!')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() =>
      expect(screen.getByText(/code expired/i)).toBeInTheDocument()
    )
  })

  it('"Use a different email" button returns to email step', async () => {
    await navigateToResetStep()

    await userEvent.click(screen.getByRole('button', { name: /use a different email/i }))

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/reset code/i)).not.toBeInTheDocument()
  })
})
