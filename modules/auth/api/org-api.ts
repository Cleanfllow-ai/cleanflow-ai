import { AWS_CONFIG } from "@/shared/config/aws-config";

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || "";

export type OrgRole = "Super Admin" | "Admin" | "Data Steward";

export interface OrgRecord {
  org_id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  subscription_plan?: string;
  logo_key?: string;
  logo_url?: string;
  logo_data_url?: string;
  industry?: string;
  gst?: string;
  pan?: string;
  contact_person?: string;
  superadmin_user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrgMembership {
  org_id: string;
  user_id: string;
  email?: string;
  role: OrgRole;
  status?: string;
  invited_by?: string;
  invite_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type PermissionsByRole = Record<OrgRole, Record<string, boolean>>;

export interface OrgMeResponse {
  organization: OrgRecord;
  membership: OrgMembership;
  permissions_by_role: Record<string, Record<string, boolean>>;
  role_permissions: Record<string, boolean>;
}

export interface OrgMembersResponse {
  members: OrgMembership[];
  count: number;
}

export interface OrgInvite {
  org_id: string;
  invite_id: string;
  email: string;
  role: OrgRole;
  status: string;
  invited_by?: string;
  created_at?: string;
  updated_at?: string;
  accepted_at?: string;
  accepted_by?: string;
}

export interface OrgInvitesResponse {
  invites: OrgInvite[];
  count: number;
}

export interface OrgPermissionsResponse {
  permissions_by_role: Record<string, Record<string, boolean>>;
}

function getAuthTokenFromStorage(): string | null {
  try {
    const raw = window.localStorage.getItem("authTokens");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.idToken || parsed?.accessToken || null;
  } catch {
    return null;
  }
}

class OrgAPI {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async makeRequest(endpoint: string, authToken?: string | null, options: RequestInit = {}) {
    const token = authToken ?? getAuthTokenFromStorage();
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  getMe(authToken?: string | null): Promise<OrgMeResponse> {
    return this.makeRequest("/org/me", authToken, { method: "GET" });
  }

  registerOrg(
    details: {
      name: string;
      email: string;
      phone: string;
      address: string;
      industry?: string;
      gst?: string;
      pan?: string;
      contact_person?: string;
      subscriptionPlan?: string;
    },
    authToken?: string | null
  ) {
    return this.makeRequest("/org/register", authToken, {
      method: "POST",
      body: JSON.stringify(details),
    });
  }

  uploadLogo(logoDataUrl: string, authToken?: string | null) {
    return this.makeRequest("/org/logo", authToken, {
      method: "POST",
      body: JSON.stringify({ logo_data_url: logoDataUrl }),
    });
  }

  listMembers(authToken?: string | null): Promise<OrgMembersResponse> {
    return this.makeRequest("/org/members", authToken, { method: "GET" });
  }

  updateMemberRole(userId: string, role: OrgRole, authToken?: string | null) {
    return this.makeRequest(`/org/members/${encodeURIComponent(userId)}/role`, authToken, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  }

  listInvites(authToken?: string | null): Promise<OrgInvitesResponse> {
    return this.makeRequest("/org/invites", authToken, { method: "GET" });
  }

  createInvite(
    email: string,
    role: OrgRole,
    frontendBaseUrl?: string,
    authToken?: string | null
  ) {
    return this.makeRequest("/org/invites", authToken, {
      method: "POST",
      body: JSON.stringify({ email, role, frontend_base_url: frontendBaseUrl }),
    });
  }

  acceptInvite(orgId: string, inviteId: string, token: string, authToken?: string | null) {
    return this.makeRequest("/org/invites/accept", authToken, {
      method: "POST",
      body: JSON.stringify({ org_id: orgId, invite_id: inviteId, token }),
    });
  }

  setInvitePassword(
    orgId: string,
    inviteId: string,
    token: string,
    email: string,
    password: string,
    authToken?: string | null
  ) {
    return this.makeRequest("/org/invites/set-password", authToken, {
      method: "POST",
      body: JSON.stringify({ org_id: orgId, invite_id: inviteId, token, email, password }),
    });
  }

  revokeInvite(inviteId: string, authToken?: string | null) {
    return this.makeRequest(`/org/invites/${encodeURIComponent(inviteId)}`, authToken, {
      method: "DELETE",
    });
  }

  removeMember(userId: string, authToken?: string | null) {
    return this.makeRequest(`/org/members/${encodeURIComponent(userId)}`, authToken, {
      method: "DELETE",
    });
  }

  listPermissions(authToken?: string | null): Promise<OrgPermissionsResponse> {
    return this.makeRequest("/org/permissions", authToken, { method: "GET" });
  }

  updateRolePermissions(role: OrgRole, permissions: Record<string, boolean>, authToken?: string | null) {
    return this.makeRequest(`/org/permissions/${encodeURIComponent(role)}`, authToken, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    });
  }
}

export const orgAPI = new OrgAPI();
export default orgAPI;
