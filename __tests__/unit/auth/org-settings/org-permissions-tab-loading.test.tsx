/**
 * org-permissions-tab-loading.test.tsx
 *
 * Regression for the "permissions matrix stuck on INITIAL_PERMISSIONS"
 * bug: OrgPermissionsTab had no separate loading state, so during a slow
 * GET /org/permissions the matrix rendered with the hard-coded defaults
 * with no visible spinner — users couldn't tell whether the toggles
 * reflected server truth or stale defaults.
 *
 * Covers:
 *  - isLoadingPermissions=true → spinner row renders
 *  - permissionsLoadError set + not loading → retry banner renders
 *  - both off → matrix is interactive (no spinner, no banner)
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OrgPermissionsTab } from "@/modules/auth/components/org-settings/org-permissions-tab";
import type { PermissionRow } from "@/modules/auth/components/org-settings/use-org-settings";

jest.mock("@/modules/auth/components/permission-wrapper", () => ({
  PermissionWrapper: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const SAMPLE_PERMISSIONS: PermissionRow[] = [
  {
    id: "files",
    name: "File Management",
    description: "Upload, download, and manage files",
    superadmin: true,
    admin: true,
    dataSteward: true,
  },
];

function defaultProps(overrides: Partial<Parameters<typeof OrgPermissionsTab>[0]> = {}) {
  return {
    currentUserRole: "Super Admin" as const,
    canChangeAllRoles: true,
    canManageDataStewards: false,
    permissions: SAMPLE_PERMISSIONS,
    isSavingPermissions: false,
    togglePermission: jest.fn(),
    handleSavePermissions: jest.fn(),
    ...overrides,
  };
}

describe("OrgPermissionsTab — loading state", () => {
  it("renders spinner row when isLoadingPermissions=true", () => {
    render(
      <OrgPermissionsTab
        {...defaultProps({ isLoadingPermissions: true })}
      />,
    );
    expect(screen.getByText("Loading role permissions...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not render spinner when isLoadingPermissions=false", () => {
    render(<OrgPermissionsTab {...defaultProps({ isLoadingPermissions: false })} />);
    expect(screen.queryByText("Loading role permissions...")).not.toBeInTheDocument();
  });
});

describe("OrgPermissionsTab — error banner", () => {
  it("renders retry banner when permissionsLoadError is set", () => {
    render(
      <OrgPermissionsTab
        {...defaultProps({
          permissionsLoadError: "HTTP 500",
          isLoadingPermissions: false,
        })}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Could not load role permissions: HTTP 500/),
    ).toBeInTheDocument();
  });

  it("hides error banner while loading (loading state takes precedence)", () => {
    render(
      <OrgPermissionsTab
        {...defaultProps({
          permissionsLoadError: "HTTP 500",
          isLoadingPermissions: true,
        })}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders neither spinner nor banner when both unset", () => {
    render(<OrgPermissionsTab {...defaultProps()} />);
    expect(screen.queryByText("Loading role permissions...")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Matrix is still rendered
    expect(screen.getByText("File Management")).toBeInTheDocument();
  });
});
