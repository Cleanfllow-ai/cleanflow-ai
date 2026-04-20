/**
 * Unit tests for modules/auth/api/org-api.ts
 * Covers: OrgAPI class — getMe, registerOrg, members, invites, permissions, approvals
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

// We need to test the OrgAPI class which calls fetch internally.
const originalFetch = global.fetch

function mockFetch(impl: (...args: any[]) => Promise<Response>) {
  global.fetch = jest.fn(impl) as any
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

// Must import AFTER mocking aws-config
import { orgAPI } from '@/modules/auth/api/org-api'

// ─── getMe ───────────────────────────────────────────────────────────────────
describe('OrgAPI.getMe', () => {
  it('calls /org/me with GET and auth header', async () => {
    const meResponse = {
      organization: { org_id: 'org-1', name: 'Test Corp' },
      membership: { org_id: 'org-1', user_id: 'u1', role: 'Admin' },
      permissions_by_role: {},
      role_permissions: { file_management: true },
    }
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toBe('https://api.test.com/org/me')
      expect(opts.method).toBe('GET')
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123')
      return jsonResponse(meResponse)
    })

    const result = await orgAPI.getMe('tok-123')
    expect(result.organization.org_id).toBe('org-1')
    expect(result.role_permissions.file_management).toBe(true)
  })

  it('throws on non-OK response with error message', async () => {
    mockFetch(async () => jsonResponse({ error: 'Not authenticated' }, 401))

    await expect(orgAPI.getMe('bad-tok')).rejects.toThrow('Not authenticated')
  })

  it('throws with HTTP status when no error field', async () => {
    mockFetch(async () => jsonResponse({}, 500))

    await expect(orgAPI.getMe('tok')).rejects.toThrow('HTTP 500')
  })
})

// ─── registerOrg ─────────────────────────────────────────────────────────────
describe('OrgAPI.registerOrg', () => {
  it('sends POST with org details', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body as string)
      expect(body.name).toBe('Acme Inc')
      expect(body.email).toBe('admin@acme.com')
      return jsonResponse({ org_id: 'org-new' })
    })

    const result = await orgAPI.registerOrg(
      { name: 'Acme Inc', email: 'admin@acme.com', phone: '555-1234', address: '123 Main St' },
      'tok'
    )
    expect(result.org_id).toBe('org-new')
  })
})

// ─── Members ─────────────────────────────────────────────────────────────────
describe('OrgAPI.listMembers', () => {
  it('calls GET /org/members', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('/org/members')
      return jsonResponse({ members: [{ user_id: 'u1', role: 'Admin' }], count: 1 })
    })

    const result = await orgAPI.listMembers('tok')
    expect(result.members).toHaveLength(1)
    expect(result.count).toBe(1)
  })
})

describe('OrgAPI.updateMemberRole', () => {
  it('sends PUT with new role', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/org/members/user-1/role')
      expect(opts.method).toBe('PUT')
      const body = JSON.parse(opts.body as string)
      expect(body.role).toBe('Data Steward')
      return jsonResponse({ message: 'Role updated' })
    })

    await orgAPI.updateMemberRole('user-1', 'Data Steward', 'tok')
  })

  it('encodes userId with special characters', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('/org/members/user%40email.com/role')
      return jsonResponse({ message: 'ok' })
    })

    await orgAPI.updateMemberRole('user@email.com', 'Admin', 'tok')
  })
})

describe('OrgAPI.removeMember', () => {
  it('sends DELETE for the given user', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/org/members/user-1')
      expect(opts.method).toBe('DELETE')
      return jsonResponse({ message: 'Removed' })
    })

    await orgAPI.removeMember('user-1', 'tok')
  })
})

// ─── Invites ─────────────────────────────────────────────────────────────────
describe('OrgAPI.createInvite', () => {
  it('sends POST with email, role, and frontend_base_url', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.email).toBe('new@member.com')
      expect(body.role).toBe('Data Steward')
      expect(body.frontend_base_url).toBe('https://app.cleanflow.ai')
      return jsonResponse({ invite_id: 'inv-1' })
    })

    const result = await orgAPI.createInvite('new@member.com', 'Data Steward', 'https://app.cleanflow.ai', 'tok')
    expect(result.invite_id).toBe('inv-1')
  })
})

describe('OrgAPI.listInvites', () => {
  it('calls GET /org/invites', async () => {
    mockFetch(async () => jsonResponse({ invites: [], count: 0 }))

    const result = await orgAPI.listInvites('tok')
    expect(result.invites).toEqual([])
    expect(result.count).toBe(0)
  })
})

describe('OrgAPI.revokeInvite', () => {
  it('sends DELETE for invite', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/org/invites/inv-1')
      expect(opts.method).toBe('DELETE')
      return jsonResponse({ message: 'Revoked' })
    })

    await orgAPI.revokeInvite('inv-1', 'tok')
  })
})

describe('OrgAPI.acceptInvite', () => {
  it('sends POST with org_id, invite_id, token', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.org_id).toBe('org-1')
      expect(body.invite_id).toBe('inv-1')
      expect(body.token).toBe('invite-token')
      return jsonResponse({ message: 'Accepted' })
    })

    await orgAPI.acceptInvite('org-1', 'inv-1', 'invite-token', 'tok')
  })
})

// ─── Permissions ─────────────────────────────────────────────────────────────
describe('OrgAPI.listPermissions', () => {
  it('calls GET /org/permissions', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('/org/permissions')
      return jsonResponse({ permissions_by_role: { Admin: { file_management: true } } })
    })

    const result = await orgAPI.listPermissions('tok')
    expect(result.permissions_by_role.Admin.file_management).toBe(true)
  })
})

describe('OrgAPI.updateRolePermissions', () => {
  it('sends PUT with role and permissions', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/org/permissions/Data%20Steward')
      expect(opts.method).toBe('PUT')
      const body = JSON.parse(opts.body as string)
      expect(body.permissions).toEqual({ file_management: true, export_data: false })
      return jsonResponse({ message: 'Updated' })
    })

    await orgAPI.updateRolePermissions('Data Steward', { file_management: true, export_data: false }, 'tok')
  })
})

// ─── Approvals ───────────────────────────────────────────────────────────────
describe('OrgAPI.createApproval', () => {
  it('sends POST with approval payload', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string)
      expect(body.action_type).toBe('delete_file')
      expect(body.resource_id).toBe('file-1')
      return jsonResponse({ approval_id: 'appr-1' })
    })

    const result = await orgAPI.createApproval({
      action_type: 'delete_file',
      resource_id: 'file-1',
      message: 'Please approve deletion',
    }, 'tok')
    expect(result.approval_id).toBe('appr-1')
  })
})

describe('OrgAPI.listApprovals', () => {
  it('passes status and action_type as query params', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('status=PENDING')
      expect(url).toContain('action_type=delete_file')
      return jsonResponse({ approvals: [], count: 0 })
    })

    await orgAPI.listApprovals({ status: 'PENDING', action_type: 'delete_file' }, 'tok')
  })

  it('omits query params when not provided', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('/org/approvals')
      expect(url).not.toContain('?')
      return jsonResponse({ approvals: [], count: 0 })
    })

    await orgAPI.listApprovals(undefined, 'tok')
  })
})

describe('OrgAPI.approveRequest', () => {
  it('sends POST to approve endpoint', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/org/approvals/appr-1/approve')
      expect(opts.method).toBe('POST')
      return jsonResponse({ message: 'Approved' })
    })

    await orgAPI.approveRequest('appr-1', 'tok')
  })
})

describe('OrgAPI.rejectRequest', () => {
  it('sends POST to reject endpoint', async () => {
    mockFetch(async (url: string, opts: RequestInit) => {
      expect(url).toContain('/org/approvals/appr-1/reject')
      expect(opts.method).toBe('POST')
      return jsonResponse({ message: 'Rejected' })
    })

    await orgAPI.rejectRequest('appr-1', 'tok')
  })
})

describe('OrgAPI.getPendingCount', () => {
  it('returns pending count', async () => {
    mockFetch(async () => jsonResponse({ pending_count: 5 }))

    const result = await orgAPI.getPendingCount('tok')
    expect(result.pending_count).toBe(5)
  })
})

describe('OrgAPI.checkApprovalStatus', () => {
  it('passes action_type and resource_id as query params', async () => {
    mockFetch(async (url: string) => {
      expect(url).toContain('action_type=delete_file')
      expect(url).toContain('resource_id=file-1')
      return jsonResponse({ approved: true, approval_id: 'appr-1' })
    })

    const result = await orgAPI.checkApprovalStatus(
      { action_type: 'delete_file', resource_id: 'file-1' },
      'tok'
    )
    expect(result.approved).toBe(true)
  })
})
