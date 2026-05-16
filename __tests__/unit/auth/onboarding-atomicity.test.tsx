/**
 * Onboarding atomicity & error-surface tests
 * (regression coverage for docs/ONBOARDING_BUG_INVESTIGATION_2026-05-14.md).
 *
 * Reproduces the smahendran@infiniqon.com bug at the FE layer: a partial BE
 * onboarding (Org row written, OrgMember row missing) used to silently
 * redirect the user to /dashboard, where every /uploads call returned 403.
 *
 * After the fix:
 *   - SignUpForm post-verification flow MUST verify membership via getMe()
 *     before redirecting to /dashboard.
 *   - When auto-register fails, the error MUST be surfaced to the user
 *     (toast + inline error), not silently swallowed.
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

const mockToast = jest.fn()
jest.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

jest.mock('@/modules/auth/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (_k: string) => null,
    toString: () => '',
  }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

// Stub the email-verification step so we can drive `onVerified` directly.
let verifiedCallback: (() => Promise<void> | void) | null = null
jest.mock('@/modules/auth/components/email-verification', () => ({
  EmailVerification: ({ email, onVerified }: { email: string; onVerified: () => Promise<void> | void }) => {
    verifiedCallback = onVerified
    return <div data-testid="email-verification">verify:{email}</div>
  },
}))

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { useAuth } from '@/modules/auth/providers/auth-provider'
import { orgAPI } from '@/modules/auth/api/org-api'
import { SignUpForm } from '@/modules/auth/components/signup-form'

const mockUseAuth = useAuth as jest.Mock
const mockOrgAPI = orgAPI as jest.Mocked<typeof orgAPI>

// Hold the original window.location so we can restore between tests.
const originalLocation = window.location

beforeEach(() => {
  jest.clearAllMocks()
  verifiedCallback = null
  // Stub navigation: we only assert on the URL we tried to navigate to.
  delete (window as any).location
  ;(window as any).location = {
    href: '',
    search: '',
    pathname: '/auth/signup',
  }
  sessionStorage.clear()
  localStorage.clear()
})

afterAll(() => {
  ;(window as any).location = originalLocation
})

async function completeSignupToVerification() {
  const signup = jest.fn().mockResolvedValue({ confirmed: false, message: 'Check email' })
  const login = jest.fn().mockResolvedValue({ success: true })
  mockUseAuth.mockReturnValue({ signup, login })

  render(<SignUpForm />)
  await waitFor(() => screen.getByLabelText(/full name/i))

  // Step 1
  await userEvent.type(screen.getByLabelText(/full name/i), 'Alice')
  await userEvent.type(screen.getByLabelText(/^email$/i), 'alice@example.com')
  await userEvent.type(screen.getByPlaceholderText(/min. 8 characters/i), 'Password123!')
  await userEvent.type(screen.getByPlaceholderText(/re-enter your password/i), 'Password123!')
  await userEvent.click(screen.getByRole('button', { name: /continue/i }))

  // Step 2 — org details
  await waitFor(() => screen.getByLabelText(/organization name/i))
  await userEvent.type(screen.getByLabelText(/organization name/i), 'Acme')
  await userEvent.type(screen.getByLabelText(/industry/i), 'Software')
  await userEvent.type(screen.getByLabelText(/phone/i), '+1-555-0000')
  await userEvent.type(screen.getByLabelText(/address/i), '1 Main St')
  // Terms checkbox
  await userEvent.click(screen.getByLabelText(/i agree to/i))
  // Submit
  await userEvent.click(screen.getByRole('button', { name: /create account/i }))

  await waitFor(() => screen.getByTestId('email-verification'))
  return { signup, login }
}

describe('SignUpForm onboarding atomicity', () => {
  it('verifies membership via getMe() AFTER registerOrg before redirecting to /dashboard', async () => {
    await completeSignupToVerification()

    // First getMe() during post-verify: BE has no membership yet.
    // registerOrg returns the org payload.
    // Second getMe() (the new verification call): MUST run AND must succeed.
    mockOrgAPI.getMe
      .mockRejectedValueOnce(new Error('Organization membership required'))
      .mockResolvedValueOnce({
        organization: { org_id: 'org-1', name: 'Acme' } as any,
        membership: { org_id: 'org-1', user_id: 'u-1', role: 'Super Admin', status: 'ACTIVE' } as any,
        permissions_by_role: {},
        role_permissions: {},
      })
    mockOrgAPI.registerOrg.mockResolvedValue({
      message: 'Organization created',
      org_id: 'org-1',
      membership: { user_id: 'u-1', role: 'Super Admin', status: 'ACTIVE', org_id: 'org-1' },
    } as any)

    // Drive the verification onComplete callback (Cognito confirms).
    await act(async () => {
      await verifiedCallback!()
    })

    // After all promises settle, both getMe calls must have happened.
    await waitFor(() => {
      expect(mockOrgAPI.registerOrg).toHaveBeenCalledTimes(1)
      expect(mockOrgAPI.getMe).toHaveBeenCalledTimes(2)
    })
    // Only after successful verification do we redirect to /dashboard.
    expect(window.location.href).toContain('/dashboard')
  })

  it('does NOT redirect to /dashboard when membership verification fails (partial BE write)', async () => {
    await completeSignupToVerification()

    // Pre-seed pending org details into sessionStorage (the form does this on
    // step-2 submit). Set it manually here because act() may not have flushed
    // the sessionStorage write yet in the test environment.
    sessionStorage.setItem('pending_org_details', JSON.stringify({
      name: 'Acme', email: '', phone: '+1', address: '1 St', industry: 'SW',
    }))

    // BE bug reproduction: first getMe fails (no membership), registerOrg
    // returns success, but the verification getMe ALSO fails (Org row written
    // but Member row missing — the smahendran scenario).
    mockOrgAPI.getMe.mockRejectedValue(new Error('Organization membership required'))
    mockOrgAPI.registerOrg.mockResolvedValue({
      message: 'Organization created',
      org_id: 'org-1',
      membership: { user_id: 'u-1', role: 'Super Admin', status: 'ACTIVE', org_id: 'org-1' },
    } as any)

    await act(async () => {
      await verifiedCallback!()
    })

    await waitFor(() => {
      expect(mockOrgAPI.registerOrg).toHaveBeenCalledTimes(1)
      // getMe called twice: once pre-register, once post-register verification.
      expect(mockOrgAPI.getMe).toHaveBeenCalledTimes(2)
    })

    // Critical: we did NOT redirect to /dashboard.
    expect(window.location.href).not.toContain('/dashboard')
    // User-visible error surfaced via toast (regression guard against the
    // pre-fix "silent swallow" behaviour).
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Membership pending',
        variant: 'destructive',
      }),
    )
  })

  it('surfaces registerOrg failure via toast (no silent swallow)', async () => {
    await completeSignupToVerification()
    sessionStorage.setItem('pending_org_details', JSON.stringify({
      name: 'Acme', email: '', phone: '+1', address: '1 St', industry: 'SW',
    }))

    mockOrgAPI.getMe.mockRejectedValue(new Error('Organization membership required'))
    mockOrgAPI.registerOrg.mockRejectedValue(new Error('BE 422: org_address is required'))

    await act(async () => {
      await verifiedCallback!()
    })

    await waitFor(() => {
      expect(mockOrgAPI.registerOrg).toHaveBeenCalledTimes(1)
    })

    // We MUST surface the error (toast + inline error). The pre-fix code
    // did `console.error(...)` and silently navigated to /create-organization
    // with no indication of why.
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Organization setup failed',
        variant: 'destructive',
      }),
    )
  })
})
