/**
 * org-api-error-envelope.test.ts
 *
 * Regression for fix(fe/org-settings): propagate ApiError envelope from
 * org-api. makeRequest used to throw a plain Error, collapsing the
 * structured backend body { error, code, action, provider } down to just
 * a message — every isApiError() check downstream silently returned
 * false, so the last-admin guard / invite-email-taken / permission-denied
 * branches never fired.
 *
 * Covers:
 *  - 422 OrgLastAdminError preserves code + action
 *  - 422 InviteEmailTakenError preserves code
 *  - 403 PermissionDeniedError preserves code
 *  - 200 returns parsed JSON unchanged
 */

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}));

import { orgAPI } from "@/modules/auth/api/org-api";
import { ApiError, isApiError } from "@/modules/shared/api-error";

const originalFetch = global.fetch;

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("orgAPI — ApiError envelope propagation", () => {
  it("preserves OrgLastAdminError code + cancel action on 422", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          error: "Cannot remove the last admin",
          code: "OrgLastAdminError",
          action: "cancel",
          provider: null,
        },
        422,
      ),
    ) as any;

    try {
      await orgAPI.removeMember("u-1", "tok");
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("OrgLastAdminError");
      expect(apiErr.action).toBe("cancel");
      expect(apiErr.status).toBe(422);
      expect(apiErr.message).toBe("Cannot remove the last admin");
    }
  });

  it("preserves InviteEmailTakenError code on 422", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          error: "Email is already registered with another org",
          code: "InviteEmailTakenError",
          action: "signin",
          provider: null,
        },
        422,
      ),
    ) as any;

    try {
      await orgAPI.createInvite("foo@bar.com", "Data Steward", undefined, "tok");
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("InviteEmailTakenError");
      expect(apiErr.action).toBe("signin");
    }
  });

  it("preserves PermissionDeniedError code on 403", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          error: "User lacks permission to remove members",
          code: "PermissionDeniedError",
          provider: null,
          action: null,
        },
        403,
      ),
    ) as any;

    try {
      await orgAPI.removeMember("u-1", "tok");
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      expect((err as ApiError).code).toBe("PermissionDeniedError");
      expect((err as ApiError).status).toBe(403);
    }
  });

  it("preserves DuplicateInviteError code on 409", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          error: "Invite already exists",
          code: "DuplicateInviteError",
        },
        409,
      ),
    ) as any;

    try {
      await orgAPI.createInvite("foo@bar.com", "Data Steward", undefined, "tok");
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      expect((err as ApiError).code).toBe("DuplicateInviteError");
    }
  });

  it("infers signin action on bare 401 with no code", async () => {
    global.fetch = jest.fn(async () => jsonResponse({}, 401)) as any;

    try {
      await orgAPI.getMe("tok");
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      // parseApiError falls back to "signin" on 401 with no code
      expect((err as ApiError).action).toBe("signin");
      expect((err as ApiError).status).toBe(401);
    }
  });

  it("returns parsed JSON unchanged on 200", async () => {
    const payload = {
      organization: { org_id: "org-1" },
      membership: { org_id: "org-1", user_id: "u-1", role: "Admin" },
      permissions_by_role: {},
      role_permissions: { settings: true },
    };
    global.fetch = jest.fn(async () => jsonResponse(payload, 200)) as any;

    const me = await orgAPI.getMe("tok");
    expect(me.organization.org_id).toBe("org-1");
  });

  it("still throws a regular Error-shaped object (message preserved for legacy callers)", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ error: "Generic failure" }, 500),
    ) as any;

    await expect(orgAPI.getMe("tok")).rejects.toThrow("Generic failure");
  });
});
