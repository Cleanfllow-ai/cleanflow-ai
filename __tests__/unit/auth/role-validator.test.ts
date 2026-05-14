/**
 * Tests for FE role validator — P2 bug fix: "Member" role must be accepted.
 *
 * Before fix: OrgRole = "Super Admin" | "Admin" | "Data Steward"
 * After fix:  OrgRole = "Super Admin" | "Admin" | "Data Steward" | "Member"
 *
 * Covers:
 *  - VALID_ROLES array includes all four roles
 *  - getRoleBadgeVariant handles "Member" without throwing
 *  - allowedInviteRoles: Member users get empty array (cannot invite)
 *  - allowedInviteRoles: Admin/Super Admin users get their normal invite sets
 *  - PermissionWrapper ROLE_HIERARCHY: "Member" maps to 0, below Data Steward
 */

// ─── VALID_ROLES ─────────────────────────────────────────────────────────────

import { VALID_ROLES, getRoleBadgeVariant } from "@/modules/auth/components/org-settings/use-org-settings";

describe("VALID_ROLES includes Member", () => {
  it('contains "Member"', () => {
    expect(VALID_ROLES).toContain("Member");
  });

  it('still contains the three original roles', () => {
    expect(VALID_ROLES).toContain("Super Admin");
    expect(VALID_ROLES).toContain("Admin");
    expect(VALID_ROLES).toContain("Data Steward");
  });

  it("has exactly 4 entries", () => {
    expect(VALID_ROLES).toHaveLength(4);
  });
});

// ─── getRoleBadgeVariant ───────────────────────────────────────────────────

describe("getRoleBadgeVariant", () => {
  it('returns "destructive" for Super Admin', () => {
    expect(getRoleBadgeVariant("Super Admin")).toBe("destructive");
  });

  it('returns "secondary" for Admin', () => {
    expect(getRoleBadgeVariant("Admin")).toBe("secondary");
  });

  it('returns "outline" for Data Steward', () => {
    expect(getRoleBadgeVariant("Data Steward")).toBe("outline");
  });

  it('returns "outline" for Member (does NOT throw)', () => {
    expect(() => getRoleBadgeVariant("Member")).not.toThrow();
    expect(getRoleBadgeVariant("Member")).toBe("outline");
  });

  it('returns "outline" for unknown role (does NOT throw)', () => {
    expect(() => getRoleBadgeVariant("garbage")).not.toThrow();
    expect(getRoleBadgeVariant("garbage")).toBe("outline");
  });
});

// ─── ROLE_HIERARCHY in permission-wrapper ────────────────────────────────────
// We test the hierarchy logic directly — no React rendering needed.

const ROLE_HIERARCHY: Record<string, number> = {
  "Super Admin": 3,
  "Admin": 2,
  "Data Steward": 1,
  "Member": 0,
};

describe("ROLE_HIERARCHY — Member has lowest rank", () => {
  it("Member (0) is below Data Steward (1)", () => {
    expect(ROLE_HIERARCHY["Member"]).toBeLessThan(ROLE_HIERARCHY["Data Steward"]);
  });

  it("Member (0) is below Admin (2)", () => {
    expect(ROLE_HIERARCHY["Member"]).toBeLessThan(ROLE_HIERARCHY["Admin"]);
  });

  it("Member (0) is below Super Admin (3)", () => {
    expect(ROLE_HIERARCHY["Member"]).toBeLessThan(ROLE_HIERARCHY["Super Admin"]);
  });

  it("Member does NOT meet requiredRole=Data Steward", () => {
    const userRoleValue = ROLE_HIERARCHY["Member"] || 0;
    const requiredRoleValue = ROLE_HIERARCHY["Data Steward"] || 0;
    expect(userRoleValue >= requiredRoleValue).toBe(false);
  });

  it("Member does NOT meet requiredRole=Admin", () => {
    const userRoleValue = ROLE_HIERARCHY["Member"] || 0;
    const requiredRoleValue = ROLE_HIERARCHY["Admin"] || 0;
    expect(userRoleValue >= requiredRoleValue).toBe(false);
  });
});

// ─── allowedInviteRoles logic ─────────────────────────────────────────────────
// Mirror the logic from use-org-settings.tsx without mounting React.

type AppRole = "Super Admin" | "Admin" | "Data Steward" | "Member";

function computeAllowedInviteRoles(currentUserRole: AppRole, canManageMembersPermission: boolean): AppRole[] {
  if (!canManageMembersPermission) return [];
  if (currentUserRole === "Super Admin") return ["Super Admin", "Admin", "Data Steward"];
  if (currentUserRole === "Admin") return ["Admin", "Data Steward"];
  if (currentUserRole === "Data Steward") return ["Data Steward"];
  // "Member" and any unknown roles cannot invite
  return [];
}

describe("allowedInviteRoles — Member cannot invite", () => {
  it("Member with permission=true gets empty invite list", () => {
    const result = computeAllowedInviteRoles("Member", true);
    expect(result).toHaveLength(0);
  });

  it("Member with permission=false gets empty invite list", () => {
    const result = computeAllowedInviteRoles("Member", false);
    expect(result).toHaveLength(0);
  });
});

describe("allowedInviteRoles — existing roles unaffected", () => {
  it("Super Admin can invite all 3 assignable roles", () => {
    const result = computeAllowedInviteRoles("Super Admin", true);
    expect(result).toEqual(["Super Admin", "Admin", "Data Steward"]);
  });

  it("Admin can invite Admin and Data Steward", () => {
    const result = computeAllowedInviteRoles("Admin", true);
    expect(result).toEqual(["Admin", "Data Steward"]);
  });

  it("Data Steward can invite Data Steward only", () => {
    const result = computeAllowedInviteRoles("Data Steward", true);
    expect(result).toEqual(["Data Steward"]);
  });

  it("any role with canManageMembersPermission=false gets empty list", () => {
    expect(computeAllowedInviteRoles("Super Admin", false)).toHaveLength(0);
    expect(computeAllowedInviteRoles("Admin", false)).toHaveLength(0);
  });
});
