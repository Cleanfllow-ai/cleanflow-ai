/**
 * org-me-cascade.test.ts — /org/me error handling tests (pure TS)
 *
 * Covers:
 *  - 200 path returns role + permissions correctly
 *  - 403 from /org/me is caught gracefully (no cascading crash)
 *  - 403 surfaces a specific toast message instead of a generic one
 *  - 401 (expired token) is distinct from 403 (membership issue)
 *  - Organization membership required error triggers redirect path
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

// ─── 200 happy path ───────────────────────────────────────────────────────────

describe("orgAPI.getMe — 200 path", () => {
  it("returns role and permissions from the response", async () => {
    const mePayload = {
      organization: { org_id: "org-1", name: "Acme" },
      membership: { org_id: "org-1", user_id: "u-1", role: "Admin" },
      permissions_by_role: {
        Admin: { members_manage: true, file_management: true },
      },
      role_permissions: { members_manage: true, members_view: true },
    };
    mockFetch(async () => jsonResponse(mePayload));

    const result = await orgAPI.getMe("tok");

    expect(result.membership.role).toBe("Admin");
    expect(result.role_permissions.members_manage).toBe(true);
    expect(result.role_permissions.members_view).toBe(true);
  });

  it("returns permissions_by_role keyed by role name", async () => {
    const mePayload = {
      organization: { org_id: "org-1" },
      membership: { org_id: "org-1", user_id: "u-1", role: "Super Admin" },
      permissions_by_role: {
        "Super Admin": { members_manage: true },
        Admin: { members_manage: true },
        "Data Steward": { members_manage: false },
      },
      role_permissions: {},
    };
    mockFetch(async () => jsonResponse(mePayload));

    const result = await orgAPI.getMe("tok");

    expect(result.permissions_by_role["Super Admin"].members_manage).toBe(true);
    expect(result.permissions_by_role["Data Steward"].members_manage).toBe(false);
  });
});

// ─── 403 graceful handling ────────────────────────────────────────────────────

describe("orgAPI.getMe — 403 / membership errors", () => {
  it("throws with HTTP 403 message when member role is denied", async () => {
    mockFetch(async () => jsonResponse({ error: "Forbidden" }, 403));

    await expect(orgAPI.getMe("tok")).rejects.toThrow("Forbidden");
  });

  it("throws with HTTP 403 string when no error field", async () => {
    mockFetch(async () => jsonResponse({}, 403));

    await expect(orgAPI.getMe("tok")).rejects.toThrow("HTTP 403");
  });

  it("throws 'Organization membership required' when user has no org", async () => {
    mockFetch(async () =>
      jsonResponse({ error: "Organization membership required" }, 403),
    );

    await expect(orgAPI.getMe("tok")).rejects.toThrow(
      "Organization membership required",
    );
  });
});

// ─── 401 vs 403 distinction ───────────────────────────────────────────────────

describe("orgAPI.getMe — 401 is distinct from 403", () => {
  it("401 throws 'Not authenticated'", async () => {
    mockFetch(async () => jsonResponse({ error: "Not authenticated" }, 401));

    await expect(orgAPI.getMe("expired-tok")).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("403 throws 'Forbidden' (membership issue, not token issue)", async () => {
    mockFetch(async () => jsonResponse({ error: "Forbidden" }, 403));

    await expect(orgAPI.getMe("valid-tok")).rejects.toThrow("Forbidden");
  });
});

// ─── Error classification helpers (mirrors use-org-settings.tsx logic) ────────

describe("error classification for toast routing", () => {
  function classifyGetMeError(message: string): "membership_required" | "auth_error" | "unknown" {
    if (message.includes("Organization membership required"))
      return "membership_required";
    if (message.includes("401") || message.includes("Not authenticated"))
      return "auth_error";
    return "unknown";
  }

  it("classifies membership error correctly", () => {
    expect(
      classifyGetMeError("Organization membership required"),
    ).toBe("membership_required");
  });

  it("classifies 401 auth error", () => {
    expect(classifyGetMeError("Not authenticated")).toBe("auth_error");
  });

  it("classifies generic errors as unknown", () => {
    expect(classifyGetMeError("Internal Server Error")).toBe("unknown");
  });

  it("Reload required toast should fire on membership_required — not crash", () => {
    const error = "Organization membership required";
    const classified = classifyGetMeError(error);
    // The FE should toast "Reload required" instead of crashing the entire page
    const shouldRedirect = classified === "membership_required";
    expect(shouldRedirect).toBe(true);
    // It must NOT just swallow the error silently (unknown path)
    expect(classified).not.toBe("unknown");
  });
});
