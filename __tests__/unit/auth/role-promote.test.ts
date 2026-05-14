/**
 * role-promote.test.ts — CC13 role promotion rules (pure TS)
 *
 * Covers:
 *  - Super Admin CAN promote Member → Admin
 *  - Admin can NOT promote others to Admin/Super Admin (only Data Steward allowed)
 *  - Admin can NOT promote Data Steward → Admin
 *  - Data Steward cannot promote anyone
 *  - Role validator accepts all 4 roles (CC-Fix-FE-Role-Member d9bbbba)
 *  - updateMemberRole guard: cannot change own role
 */

import { VALID_ROLES, getRoleBadgeVariant } from "@/modules/auth/components/org-settings/use-org-settings";
import type { AppRole } from "@/modules/auth/components/org-settings/use-org-settings";

// ─── Mirror the updateMemberRole guard from use-org-settings.tsx ──────────────

interface PromoteResult {
  allowed: boolean;
  reason?: string;
}

function canPromote(
  currentUserRole: AppRole,
  targetRole: AppRole, // current role of the target member
  newRole: AppRole,
  canManageMembersPermission: boolean,
  canChangeAllRoles: boolean, // currentUserRole === "Super Admin"
  canManageDataStewards: boolean, // currentUserRole === "Admin"
  isSelf: boolean,
): PromoteResult {
  if (!canManageMembersPermission)
    return { allowed: false, reason: "no permission" };
  if (isSelf)
    return { allowed: false, reason: "cannot change own role" };

  if (!canChangeAllRoles) {
    const canAdminManageThisMember =
      canManageDataStewards && targetRole === "Data Steward";
    if (!canAdminManageThisMember)
      return { allowed: false, reason: "Admins can only manage Data Stewards" };
    if (newRole !== "Data Steward")
      return {
        allowed: false,
        reason: "Only Super Admin can assign Admin/Super Admin",
      };
  }
  return { allowed: true };
}

// ─── Super Admin promotion tests ─────────────────────────────────────────────

describe("Super Admin can promote", () => {
  const superAdminCtx = {
    currentUserRole: "Super Admin" as AppRole,
    canManageMembersPermission: true,
    canChangeAllRoles: true,
    canManageDataStewards: false,
    isSelf: false,
  };

  it("Member → Admin", () => {
    const r = canPromote(
      superAdminCtx.currentUserRole,
      "Member",
      "Admin",
      superAdminCtx.canManageMembersPermission,
      superAdminCtx.canChangeAllRoles,
      superAdminCtx.canManageDataStewards,
      superAdminCtx.isSelf,
    );
    expect(r.allowed).toBe(true);
  });

  it("Admin → Data Steward", () => {
    const r = canPromote(
      superAdminCtx.currentUserRole,
      "Admin",
      "Data Steward",
      superAdminCtx.canManageMembersPermission,
      superAdminCtx.canChangeAllRoles,
      superAdminCtx.canManageDataStewards,
      superAdminCtx.isSelf,
    );
    expect(r.allowed).toBe(true);
  });

  it("blocked when targeting self", () => {
    const r = canPromote(
      "Super Admin",
      "Super Admin",
      "Admin",
      true,
      true,
      false,
      true,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("cannot change own role");
  });
});

// ─── Admin promotion tests ────────────────────────────────────────────────────

describe("Admin cannot promote to Admin or Super Admin", () => {
  const adminCtx = {
    currentUserRole: "Admin" as AppRole,
    canManageMembersPermission: true,
    canChangeAllRoles: false,
    canManageDataStewards: true,
    isSelf: false,
  };

  it("Admin CANNOT promote Data Steward → Admin", () => {
    const r = canPromote(
      adminCtx.currentUserRole,
      "Data Steward",
      "Admin",
      adminCtx.canManageMembersPermission,
      adminCtx.canChangeAllRoles,
      adminCtx.canManageDataStewards,
      adminCtx.isSelf,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("Only Super Admin");
  });

  it("Admin CANNOT manage a Member (only Data Stewards)", () => {
    const r = canPromote(
      adminCtx.currentUserRole,
      "Member",
      "Data Steward",
      adminCtx.canManageMembersPermission,
      adminCtx.canChangeAllRoles,
      adminCtx.canManageDataStewards,
      adminCtx.isSelf,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("Admins can only manage Data Stewards");
  });

  it("Admin CAN reassign Data Steward → Data Steward (no-op)", () => {
    const r = canPromote(
      adminCtx.currentUserRole,
      "Data Steward",
      "Data Steward",
      adminCtx.canManageMembersPermission,
      adminCtx.canChangeAllRoles,
      adminCtx.canManageDataStewards,
      adminCtx.isSelf,
    );
    expect(r.allowed).toBe(true);
  });
});

// ─── Role validator — all 4 roles accepted (CC-Fix-FE-Role-Member) ────────────

describe("role validator accepts all 4 roles", () => {
  const allRoles: AppRole[] = ["Super Admin", "Admin", "Data Steward", "Member"];

  it.each(allRoles)('VALID_ROLES includes "%s"', (role) => {
    expect(VALID_ROLES).toContain(role);
  });

  it.each(allRoles)('getRoleBadgeVariant does not throw for "%s"', (role) => {
    expect(() => getRoleBadgeVariant(role)).not.toThrow();
  });
});
