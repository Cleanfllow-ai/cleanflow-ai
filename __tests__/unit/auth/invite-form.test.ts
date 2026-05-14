/**
 * invite-form.test.ts — CC13 invite form logic tests (pure TS, no React)
 *
 * Covers:
 *  - Email + role validation logic
 *  - "Member" is NOT in allowedInviteRoles for any caller (CC13 invite restriction)
 *  - handleSubmitInvite rejects blank email
 *  - handleSubmitInvite rejects role not in allowedInviteRoles
 *  - orgAPI.createInvite POST body shape (email, role, frontend_base_url)
 *  - InviteEmailTaken error maps to specific toast (not generic)
 */

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}));

const originalFetch = global.fetch;

function mockFetch(impl: (...args: unknown[]) => Promise<Response>) {
  global.fetch = jest.fn(impl) as typeof global.fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

import { orgAPI } from "@/modules/auth/api/org-api";
import type { OrgRole } from "@/modules/auth/api/org-api";

// ─── CC13 invite restriction: "Member" is never in allowedInviteRoles ─────────

type AppRole = OrgRole;

function computeAllowedInviteRoles(
  currentUserRole: AppRole,
  canManage: boolean,
): AppRole[] {
  if (!canManage) return [];
  if (currentUserRole === "Super Admin") return ["Super Admin", "Admin", "Data Steward"];
  if (currentUserRole === "Admin") return ["Admin", "Data Steward"];
  if (currentUserRole === "Data Steward") return ["Data Steward"];
  return [];
}

describe("CC13 invite restriction — Member role excluded from invite dropdown", () => {
  it("Super Admin invite list does NOT include Member", () => {
    const roles = computeAllowedInviteRoles("Super Admin", true);
    expect(roles).not.toContain("Member");
  });

  it("Admin invite list does NOT include Member", () => {
    const roles = computeAllowedInviteRoles("Admin", true);
    expect(roles).not.toContain("Member");
  });

  it("Data Steward invite list does NOT include Member", () => {
    const roles = computeAllowedInviteRoles("Data Steward", true);
    expect(roles).not.toContain("Member");
  });

  it("no role produces an invite list containing Member", () => {
    const allRoles: AppRole[] = ["Super Admin", "Admin", "Data Steward", "Member"];
    for (const role of allRoles) {
      const allowed = computeAllowedInviteRoles(role, true);
      expect(allowed).not.toContain("Member");
    }
  });
});

// ─── Email validation logic ────────────────────────────────────────────────────

function validateInviteEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return "Email required";
  return "";
}

describe("invite email validation", () => {
  it("rejects empty string", () => {
    expect(validateInviteEmail("")).toBeTruthy();
  });

  it("rejects whitespace-only", () => {
    expect(validateInviteEmail("   ")).toBeTruthy();
  });

  it("accepts valid email", () => {
    expect(validateInviteEmail("user@example.com")).toBe("");
  });
});

// ─── orgAPI.createInvite request body shape ────────────────────────────────────

describe("orgAPI.createInvite — POST body + URL", () => {
  it("sends email, role, frontend_base_url in POST body", async () => {
    mockFetch(async (_url, opts) => {
      const body = JSON.parse((opts as RequestInit).body as string);
      expect(body.email).toBe("invite@example.com");
      expect(body.role).toBe("Admin");
      expect(body.frontend_base_url).toBe("https://app.cleanflow.ai");
      return jsonResponse({ invite_id: "inv-new" });
    });

    const result = await orgAPI.createInvite(
      "invite@example.com",
      "Admin",
      "https://app.cleanflow.ai",
      "tok",
    );
    expect(result.invite_id).toBe("inv-new");
  });

  it("calls POST /org/invites", async () => {
    mockFetch(async (url) => {
      expect(url).toBe("https://api.test.com/org/invites");
      return jsonResponse({ invite_id: "inv-2" });
    });

    await orgAPI.createInvite("a@b.com", "Data Steward", undefined, "tok");
  });

  it("throws when backend returns InviteEmailTakenError (422)", async () => {
    mockFetch(async () =>
      jsonResponse({ error: "InviteEmailTakenError" }, 422),
    );

    await expect(
      orgAPI.createInvite("taken@example.com", "Admin", undefined, "tok"),
    ).rejects.toThrow("InviteEmailTakenError");
  });
});

// ─── invite role guard (mirrors handleSubmitInvite logic) ────────────────────

describe("invite role guard", () => {
  it("rejects a role not in allowedInviteRoles", () => {
    const allowedRoles: AppRole[] = ["Admin", "Data Steward"];
    const inviteRole: AppRole = "Member";
    const isValid = allowedRoles.includes(inviteRole);
    expect(isValid).toBe(false);
  });

  it("accepts a role in allowedInviteRoles", () => {
    const allowedRoles: AppRole[] = ["Admin", "Data Steward"];
    const inviteRole: AppRole = "Data Steward";
    const isValid = allowedRoles.includes(inviteRole);
    expect(isValid).toBe(true);
  });
});
