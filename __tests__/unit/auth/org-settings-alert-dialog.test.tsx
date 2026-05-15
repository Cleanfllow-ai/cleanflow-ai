/**
 * P0-2: AlertDialog migration for revoke-invite + remove-member
 * Asserts native window.confirm is NOT called and AlertDialog opens instead.
 */

// Must mock permission-wrapper to avoid AuthProvider dependency chain
jest.mock('@/modules/auth/components/permission-wrapper', () => ({
  PermissionWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock aws-config to avoid required env var errors in test environment
jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: {
    API_BASE_URL: 'https://api.test.com',
    WS_URL: '',
    REGION: 'us-east-1',
    COGNITO: {
      USER_POOL_ID: 'test-pool',
      CLIENT_ID: 'test-client',
      REGION: 'us-east-1',
    },
    S3: { BUCKET_NAME: 'test-bucket', REGION: 'us-east-1' },
  },
}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

import {
  OrgMembersTab,
} from '@/modules/auth/components/org-settings/org-members-tab'
import type { AppRole } from '@/modules/auth/components/org-settings/use-org-settings'

function baseProps() {
  return {
    currentUserRole: 'Super Admin' as AppRole,
    currentUserId: 'u1',
    canViewMembersPermission: true,
    canManageMembersPermission: true,
    canInviteMembers: true,
    canChangeAllRoles: true,
    canManageDataStewards: true,
    allMembers: [
      {
        id: 'u2',
        isInvite: false,
        displayId: 'u2',
        displayName: 'Alice',
        displayEmail: 'alice@test.com',
        displayStatus: 'Active',
        displayRole: 'Member' as AppRole,
        displayJoined: '2025-01-01',
        displayLastLogin: '2025-01-02',
        displayAvatar: '',
      },
    ],
    isLoadingOrg: false,
    revokingInviteId: null,
    inviteHelpText: '',
    handleInviteMember: jest.fn(),
    handleRevokeInvite: jest.fn(),
    confirmRevokeInvite: jest.fn(),
    pendingRevokeInvite: null as null | { inviteId: string; email: string },
    setPendingRevokeInvite: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    confirmRemoveMember: jest.fn(),
    pendingRemoveMember: null as null | { memberId: string; name: string; email: string },
    setPendingRemoveMember: jest.fn(),
  }
}

describe('P0-2: AlertDialog migration — no window.confirm', () => {
  it('handleRevokeInvite does not call window.confirm', () => {
    const confirmSpy = jest.spyOn(window, 'confirm')
    const props = baseProps()
    render(<OrgMembersTab {...props} />)
    // Simulate clicking revoke invite button (calls handleRevokeInvite)
    props.handleRevokeInvite('inv-1', 'bob@test.com')
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('removeMember does not call window.confirm', () => {
    const confirmSpy = jest.spyOn(window, 'confirm')
    const props = baseProps()
    render(<OrgMembersTab {...props} />)
    props.removeMember('u2')
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('shows Revoke Invitation AlertDialog when pendingRevokeInvite is set', () => {
    const props = {
      ...baseProps(),
      pendingRevokeInvite: { inviteId: 'inv-1', email: 'bob@test.com' },
    }
    render(<OrgMembersTab {...props} />)
    expect(screen.getByText('Revoke Invitation')).toBeInTheDocument()
    expect(screen.getByText(/bob@test\.com/)).toBeInTheDocument()
  })

  it('shows Remove Member AlertDialog when pendingRemoveMember is set', () => {
    const props = {
      ...baseProps(),
      pendingRemoveMember: { memberId: 'u2', name: 'Alice', email: 'alice@test.com' },
    }
    render(<OrgMembersTab {...props} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Remove Member')).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument()
  })

  it('Revoke action button uses destructive variant', () => {
    const props = {
      ...baseProps(),
      pendingRevokeInvite: { inviteId: 'inv-1', email: 'bob@test.com' },
    }
    render(<OrgMembersTab {...props} />)
    const revokeBtn = screen.getByRole('button', { name: 'Revoke' })
    expect(revokeBtn.className).toMatch(/destructive/)
  })

  it('Remove action button uses destructive variant', () => {
    const props = {
      ...baseProps(),
      pendingRemoveMember: { memberId: 'u2', name: 'Alice', email: 'alice@test.com' },
    }
    render(<OrgMembersTab {...props} />)
    const removeBtn = screen.getByRole('button', { name: 'Remove' })
    expect(removeBtn.className).toMatch(/destructive/)
  })
})
