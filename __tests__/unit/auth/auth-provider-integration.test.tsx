/**
 * Integration tests for AuthProvider (modules/auth/providers/auth-provider.tsx)
 * Covers: wraps tree, hasPermission() for Member/Admin/Super Admin, RBAC denies,
 *         permissions loaded via orgAPI.getMe(), unauthenticated clears state
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

// Use-auth hook — we control the returned state entirely
jest.mock('@/modules/auth/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/modules/auth/api/org-api', () => ({
  orgAPI: { getMe: jest.fn() },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/modules/shared/auth-token-bridge', () => ({
  setValidTokenGetter: jest.fn(),
}))

jest.mock('@/lib/error-toast', () => ({
  setReconnectHandler: jest.fn(),
  setConnectHandler: jest.fn(),
  setSigninHandler: jest.fn(),
  setSignOutHandler: jest.fn(),
}))

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useAuth as useAuthHook } from '@/modules/auth/hooks/use-auth'
import { orgAPI } from '@/modules/auth/api/org-api'
import { AuthProvider } from '@/modules/auth/providers/auth-provider'
import { useContext } from 'react'

const mockUseAuthHook = useAuthHook as jest.Mock
const mockGetMe = (orgAPI as any).getMe as jest.Mock

// Minimal context consumer for testing hasPermission
function PermissionProbe({ permKey }: { permKey: string }) {
  // Import useAuth from provider (re-exported from index)
  const { hasPermission, userRole, permissionsLoaded } = require(
    '@/modules/auth/providers/auth-provider'
  ).useAuth()
  return (
    <div>
      <span data-testid="has-perm">{hasPermission(permKey) ? 'yes' : 'no'}</span>
      <span data-testid="role">{userRole ?? 'none'}</span>
      <span data-testid="loaded">{permissionsLoaded ? 'loaded' : 'pending'}</span>
    </div>
  )
}

function makeAuthHook(overrides: Record<string, any> = {}) {
  return {
    user: { name: 'Test' },
    isAuthenticated: true,
    isLoading: false,
    idToken: 'id-tok-123',
    accessToken: 'acc-tok-123',
    mfaRequired: false,
    mfaSession: null,
    mfaUsername: null,
    idleWarnSecondsRemaining: null,
    signup: jest.fn(),
    confirmSignup: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    logoutExpired: jest.fn(),
    dismissIdleWarning: jest.fn(),
    verifyMfaCode: jest.fn(),
    setupMfa: jest.fn(),
    setupMfaWithSession: jest.fn(),
    confirmMfaSetup: jest.fn(),
    confirmMfaSetupWithSession: jest.fn(),
    cancelMfa: jest.fn(),
    completeNewPassword: jest.fn(),
    getValidToken: jest.fn().mockResolvedValue('fresh-token'),
    ...overrides,
  }
}

afterEach(() => jest.clearAllMocks())

describe('AuthProvider — tree wrapping', () => {
  it('renders children', async () => {
    mockUseAuthHook.mockReturnValue(makeAuthHook())
    mockGetMe.mockResolvedValue({ membership: { role: 'Admin' }, role_permissions: {} })

    render(
      <AuthProvider>
        <div data-testid="child">Hello</div>
      </AuthProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})

describe('AuthProvider — hasPermission()', () => {
  it('grants permission for a key present in role_permissions', async () => {
    mockUseAuthHook.mockReturnValue(makeAuthHook())
    mockGetMe.mockResolvedValue({
      membership: { role: 'Admin' },
      role_permissions: { file_management: true, dq_execution: false },
    })

    render(
      <AuthProvider>
        <PermissionProbe permKey="file_management" />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('loaded'))
    expect(screen.getByTestId('has-perm')).toHaveTextContent('yes')
    expect(screen.getByTestId('role')).toHaveTextContent('Admin')
  })

  it('denies permission for a key set to false', async () => {
    mockUseAuthHook.mockReturnValue(makeAuthHook())
    mockGetMe.mockResolvedValue({
      membership: { role: 'Member' },
      role_permissions: { file_management: true, admin_settings: false },
    })

    render(
      <AuthProvider>
        <PermissionProbe permKey="admin_settings" />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('loaded'))
    expect(screen.getByTestId('has-perm')).toHaveTextContent('no')
    expect(screen.getByTestId('role')).toHaveTextContent('Member')
  })

  it('denies permission for an unknown key', async () => {
    mockUseAuthHook.mockReturnValue(makeAuthHook())
    mockGetMe.mockResolvedValue({
      membership: { role: 'Super Admin' },
      role_permissions: { file_management: true },
    })

    render(
      <AuthProvider>
        <PermissionProbe permKey="nonexistent_key" />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('loaded'))
    expect(screen.getByTestId('has-perm')).toHaveTextContent('no')
  })

  it('denies all permissions before permissions have loaded', async () => {
    mockUseAuthHook.mockReturnValue(makeAuthHook())
    // Never resolve — permissions stay in "pending"
    mockGetMe.mockReturnValue(new Promise(() => {}))

    render(
      <AuthProvider>
        <PermissionProbe permKey="file_management" />
      </AuthProvider>
    )

    expect(screen.getByTestId('loaded')).toHaveTextContent('pending')
    expect(screen.getByTestId('has-perm')).toHaveTextContent('no')
  })

  it('clears permissions when user is not authenticated', async () => {
    mockUseAuthHook.mockReturnValue(
      makeAuthHook({ isAuthenticated: false, idToken: null })
    )
    mockGetMe.mockResolvedValue({ membership: { role: 'Admin' }, role_permissions: {} })

    render(
      <AuthProvider>
        <PermissionProbe permKey="file_management" />
      </AuthProvider>
    )

    // getMe should NOT be called for unauthenticated users
    expect(mockGetMe).not.toHaveBeenCalled()
    expect(screen.getByTestId('has-perm')).toHaveTextContent('no')
  })
})

describe('AuthProvider — orgAPI.getMe call', () => {
  it('calls orgAPI.getMe with the idToken when authenticated', async () => {
    mockUseAuthHook.mockReturnValue(makeAuthHook({ idToken: 'id-tok-test' }))
    mockGetMe.mockResolvedValue({
      membership: { role: 'Admin' },
      role_permissions: {},
    })

    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockGetMe).toHaveBeenCalledWith('id-tok-test')
    })
  })
})
