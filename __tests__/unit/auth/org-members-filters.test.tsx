/**
 * Filter 7 — Org Members role filter + search
 * Asserts: defaults, search narrows by name/email, role filter narrows, clearing restores all.
 */
import "@testing-library/jest-dom"
import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== "undefined") {
  if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
  if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
  if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: {
    API_BASE_URL: "https://api.test.com",
    COGNITO: { USER_POOL_ID: "test", CLIENT_ID: "test", REGION: "ap-south-1" },
  },
}))

jest.mock("@/modules/auth/components/permission-wrapper", () => ({
  PermissionWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock("@/modules/auth", () => ({
  useAuth: () => ({ idToken: "tok", user: { email: "u@x.com" }, currentUserRole: "Super Admin" }),
}))

import { OrgMembersTab } from "@/modules/auth/components/org-settings/org-members-tab"
import type { AppRole } from "@/modules/auth/components/org-settings/use-org-settings"

type MemberRow = Parameters<typeof OrgMembersTab>[0]["allMembers"][0]

function makeMember(id: string, name: string, email: string, role: AppRole): MemberRow {
  return {
    id, isInvite: false, displayId: id, displayName: name,
    displayEmail: email, displayStatus: "Active", displayRole: role,
    displayJoined: "2024-01-01", displayLastLogin: "2024-05-01", displayAvatar: "",
  }
}

const MEMBERS: MemberRow[] = [
  makeMember("u1", "Alice Admin", "alice@example.com", "Admin"),
  makeMember("u2", "Bob Steward", "bob@example.com", "Data Steward"),
  makeMember("u3", "Carol Member", "carol@example.com", "Member"),
]

function defaultProps(overrides: Partial<Parameters<typeof OrgMembersTab>[0]> = {}) {
  return {
    currentUserRole: "Super Admin" as AppRole,
    currentUserId: "current-user",
    canViewMembersPermission: true,
    canManageMembersPermission: true,
    canInviteMembers: true,
    canChangeAllRoles: true,
    canManageDataStewards: true,
    allMembers: MEMBERS,
    isLoadingOrg: false,
    revokingInviteId: null,
    inviteHelpText: "",
    handleInviteMember: jest.fn(),
    handleRevokeInvite: jest.fn(),
    confirmRevokeInvite: jest.fn(),
    pendingRevokeInvite: null,
    setPendingRevokeInvite: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    confirmRemoveMember: jest.fn(),
    pendingRemoveMember: null,
    setPendingRemoveMember: jest.fn(),
    ...overrides,
  }
}

describe("OrgMembersTab — search + role filter (Filter 7)", () => {
  it("defaults show all members", () => {
    render(<OrgMembersTab {...defaultProps()} />)
    expect(screen.getByText("Alice Admin")).toBeInTheDocument()
    expect(screen.getByText("Bob Steward")).toBeInTheDocument()
    expect(screen.getByText("Carol Member")).toBeInTheDocument()
  })

  it("search by name narrows rows", async () => {
    const user = userEvent.setup()
    render(<OrgMembersTab {...defaultProps()} />)
    await user.type(screen.getByTestId("members-search"), "Alice")
    expect(screen.getByText("Alice Admin")).toBeInTheDocument()
    expect(screen.queryByText("Bob Steward")).not.toBeInTheDocument()
    expect(screen.queryByText("Carol Member")).not.toBeInTheDocument()
  })

  it("search by email narrows rows", async () => {
    const user = userEvent.setup()
    render(<OrgMembersTab {...defaultProps()} />)
    await user.type(screen.getByTestId("members-search"), "carol@")
    expect(screen.getByText("Carol Member")).toBeInTheDocument()
    expect(screen.queryByText("Alice Admin")).not.toBeInTheDocument()
  })

  it("clearing search restores all rows", async () => {
    const user = userEvent.setup()
    render(<OrgMembersTab {...defaultProps()} />)
    await user.type(screen.getByTestId("members-search"), "Alice")
    await user.clear(screen.getByTestId("members-search"))
    expect(screen.getByText("Alice Admin")).toBeInTheDocument()
    expect(screen.getByText("Bob Steward")).toBeInTheDocument()
    expect(screen.getByText("Carol Member")).toBeInTheDocument()
  })

  it("role filter to 'Data Steward' hides others", async () => {
    const user = userEvent.setup()
    render(<OrgMembersTab {...defaultProps()} />)
    await user.click(screen.getByTestId("role-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "Data Steward" }))
    expect(screen.getByText("Bob Steward")).toBeInTheDocument()
    expect(screen.queryByText("Alice Admin")).not.toBeInTheDocument()
    expect(screen.queryByText("Carol Member")).not.toBeInTheDocument()
  })

  it("resetting role filter to 'All roles' restores all", async () => {
    const user = userEvent.setup()
    render(<OrgMembersTab {...defaultProps()} />)
    await user.click(screen.getByTestId("role-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "Admin" }))
    await user.click(screen.getByTestId("role-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "All roles" }))
    expect(screen.getByText("Alice Admin")).toBeInTheDocument()
    expect(screen.getByText("Bob Steward")).toBeInTheDocument()
    expect(screen.getByText("Carol Member")).toBeInTheDocument()
  })
})
