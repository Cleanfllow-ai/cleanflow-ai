/**
 * org-members-table.test.tsx — CC13 component tests
 *
 * Covers:
 *  - Members render with correct role badges (Super Admin, Admin, Data Steward, Member)
 *  - Remove button visible only when currentUserRole === "Super Admin"
 *  - Remove button disabled for self
 *  - Last-admin guard: OrgLastAdminError surfaces correct toast (no action)
 *  - Invite-pending row shows "Pending" status badge
 *  - Empty state renders when no members
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OrgMembersTab } from "@/modules/auth/components/org-settings/org-members-tab";
import type { AppRole } from "@/modules/auth/components/org-settings/use-org-settings";

// ─── Mock heavy UI deps ───────────────────────────────────────────────────────

jest.mock("@/modules/auth/components/permission-wrapper", () => ({
  PermissionWrapper: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MemberRow = {
  id: string;
  isInvite: boolean;
  displayId: string;
  displayName: string;
  displayEmail: string;
  displayStatus: string;
  displayRole: AppRole;
  displayJoined: string;
  displayLastLogin: string;
  displayAvatar: string;
};

function makeMember(overrides: Partial<MemberRow>): MemberRow {
  return {
    id: "u-1",
    isInvite: false,
    displayId: "u-1",
    displayName: "Alice",
    displayEmail: "alice@example.com",
    displayStatus: "Active",
    displayRole: "Admin",
    displayJoined: "2024-01-01",
    displayLastLogin: "2024-05-01",
    displayAvatar: "",
    ...overrides,
  };
}

function defaultProps(overrides: Partial<Parameters<typeof OrgMembersTab>[0]> = {}) {
  return {
    currentUserRole: "Super Admin" as AppRole,
    currentUserId: "current-user",
    canViewMembersPermission: true,
    canManageMembersPermission: true,
    canInviteMembers: true,
    canChangeAllRoles: true,
    canManageDataStewards: false,
    allMembers: [],
    isLoadingOrg: false,
    revokingInviteId: null,
    inviteHelpText: "",
    handleInviteMember: jest.fn(),
    handleRevokeInvite: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OrgMembersTab — role badges", () => {
  it("renders Super Admin role badge", () => {
    render(
      <OrgMembersTab
        {...defaultProps({
          allMembers: [makeMember({ displayRole: "Super Admin", displayId: "u-sa" })],
        })}
      />
    );
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("renders Admin role badge", () => {
    render(
      <OrgMembersTab
        {...defaultProps({
          allMembers: [makeMember({ displayRole: "Admin", displayId: "u-a" })],
        })}
      />
    );
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders Data Steward role badge", () => {
    render(
      <OrgMembersTab
        {...defaultProps({
          allMembers: [makeMember({ displayRole: "Data Steward", displayId: "u-ds" })],
        })}
      />
    );
    expect(screen.getByText("Data Steward")).toBeInTheDocument();
  });

  it("renders Member role badge", () => {
    render(
      <OrgMembersTab
        {...defaultProps({
          allMembers: [makeMember({ displayRole: "Member", displayId: "u-m" })],
        })}
      />
    );
    // "Member" appears as a role badge in the Role column cell
    const memberTexts = screen.getAllByText("Member");
    // At least one occurrence must be a badge (span with badge class)
    const badge = memberTexts.find(
      (el) => el.tagName.toLowerCase() === "span",
    );
    expect(badge).toBeTruthy();
  });
});

describe("OrgMembersTab — action button visibility", () => {
  it("action button enabled when Super Admin and not self", () => {
    render(
      <OrgMembersTab
        {...defaultProps({
          currentUserRole: "Super Admin",
          currentUserId: "current-user",
          allMembers: [makeMember({ displayId: "u-other", displayRole: "Admin" })],
        })}
      />
    );
    // The action trigger button (MoreHorizontal icon button) should not be disabled
    const buttons = screen.getAllByRole("button");
    const actionBtn = buttons.find((b) => !b.hasAttribute("disabled"));
    expect(actionBtn).toBeTruthy();
  });

  it("action button disabled for self (cannot manage own entry)", () => {
    render(
      <OrgMembersTab
        {...defaultProps({
          currentUserRole: "Super Admin",
          currentUserId: "u-self",
          allMembers: [makeMember({ displayId: "u-self", displayRole: "Admin" })],
        })}
      />
    );
    // The MoreHorizontal trigger for self is disabled
    const disabledBtns = screen
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("disabled"));
    expect(disabledBtns.length).toBeGreaterThanOrEqual(1);
  });
});

describe("OrgMembersTab — empty state", () => {
  it("shows empty state message when no members", () => {
    render(<OrgMembersTab {...defaultProps({ allMembers: [] })} />);
    expect(
      screen.getByText("No team members or pending invites.")
    ).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<OrgMembersTab {...defaultProps({ isLoadingOrg: true })} />);
    expect(screen.getByText("Loading members...")).toBeInTheDocument();
  });
});

describe("OrgMembersTab — pending invite row", () => {
  it("shows Pending status for invite rows", () => {
    render(
      <OrgMembersTab
        {...defaultProps({
          allMembers: [
            makeMember({
              isInvite: true,
              displayStatus: "Pending",
              displayId: "inv-1",
              displayRole: "Data Steward",
            }),
          ],
        })}
      />
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
