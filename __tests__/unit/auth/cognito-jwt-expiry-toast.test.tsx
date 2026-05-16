/**
 * Phase: SOC2 Remediation — Cognito JWT expiry vs connector OAuth UX.
 *
 * Targets:
 *   - lib/error-toast.ts                          (Fix 1, Fix 2)
 *   - modules/connectors/api/base.ts              (Fix 3)
 *   - modules/files/api/file-upload-api.ts        (Fix 3)
 *   - modules/auth/hooks/use-auth.ts              (Fix 4 — threshold parity)
 *
 * Bug being fixed:
 *   The "Session expired — Sign in again to continue. (Click Sign in)"
 *   toast surfaced inside the GoogleDrive Import dialog whenever Cognito
 *   JWT refresh failed. The wording made users think the GoogleDrive
 *   connector had expired (it hadn't — their app sign-in had).
 *
 * No network. No Cognito SDK. No real React tree (we exercise the toast
 * descriptor mapper + the pluggable handlers directly).
 */

import {
  mapErrorToToast,
  setReconnectHandler,
  setSigninHandler,
  setSignOutHandler,
} from "@/lib/error-toast";
import { ApiError } from "@/modules/shared/api-error";

// ─── Fix 1: signin toast copy ──────────────────────────────────────────

describe("mapErrorToToast — action='signin'", () => {
  afterEach(() => {
    setReconnectHandler(null);
    setSigninHandler(null);
    setSignOutHandler(null);
  });

  it("uses the new 'Your sign-in session has expired' copy (NOT 'Session expired')", () => {
    const err = new ApiError({
      status: 401,
      message: "Token refresh failed",
      action: "signin",
    });
    const toast = mapErrorToToast(err);

    // The OLD copy must never reappear — that's the regression.
    expect(toast.title).not.toBe("Session expired");
    expect(toast.title).toBe("Your sign-in session has expired");
    expect(toast.description).toBe("Please sign in again to continue.");
    expect(toast.action?.label).toBe("Sign in");
    expect(toast.variant).toBe("destructive");
  });

  it("does NOT mention any provider when no provider tag is present", () => {
    const err = new ApiError({
      status: 401,
      message: "Token refresh failed",
      action: "signin",
    });
    const toast = mapErrorToToast(err);

    // The whole point of Fix 1 — never let a Cognito 401 read like a
    // connector-specific failure.
    expect(toast.title.toLowerCase()).not.toContain("google");
    expect(toast.title.toLowerCase()).not.toContain("drive");
    expect(toast.title.toLowerCase()).not.toContain("quickbooks");
  });

  it("optionally surfaces the provider when the backend tagged the 401 with one", () => {
    const err = new ApiError({
      status: 401,
      message: "Re-auth required",
      action: "signin",
      provider: "googledrive",
    });
    const toast = mapErrorToToast(err);

    expect(toast.title).toBe("Google Drive requires sign-in");
    expect(toast.description).toBe("Please sign in again to continue.");
    expect(toast.action?.label).toBe("Sign in");
  });
});

// ─── action='reconnect' must remain unchanged ──────────────────────────

describe("mapErrorToToast — action='reconnect' (regression guard)", () => {
  afterEach(() => {
    setReconnectHandler(null);
  });

  it("still produces 'Google Drive session expired' + Reconnect label", () => {
    const err = new ApiError({
      status: 401,
      message: "Google Drive session expired",
      action: "reconnect",
      provider: "googledrive",
      code: "ConnectionExpiredError",
    });
    const toast = mapErrorToToast(err);

    expect(toast.title).toBe("Google Drive session expired");
    expect(toast.action?.label).toBe("Reconnect");
    expect(toast.variant).toBe("destructive");
  });

  it("calls the registered reconnect handler with the provider on click", () => {
    const reconnectFn = jest.fn();
    setReconnectHandler(reconnectFn);

    const err = new ApiError({
      status: 401,
      message: "Google Drive session expired",
      action: "reconnect",
      provider: "googledrive",
    });
    const toast = mapErrorToToast(err);
    toast.action?.onClick();

    expect(reconnectFn).toHaveBeenCalledWith("googledrive");
  });
});

// ─── Fix 2: signOut() before router.push("/auth/login") ────────────────

describe("goToLogin invokes signOut BEFORE redirect", () => {
  afterEach(() => {
    setSigninHandler(null);
    setSignOutHandler(null);
  });

  it("calls the sign-out helper before the navigation handler", () => {
    const callOrder: string[] = [];
    const signOutFn = jest.fn(() => {
      callOrder.push("signOut");
    });
    const navigateFn = jest.fn(() => {
      callOrder.push("navigate");
    });
    setSignOutHandler(signOutFn);
    setSigninHandler(navigateFn);

    const err = new ApiError({
      status: 401,
      message: "expired",
      action: "signin",
    });
    const toast = mapErrorToToast(err);
    toast.action?.onClick();

    expect(signOutFn).toHaveBeenCalledTimes(1);
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["signOut", "navigate"]);
  });

  it("still navigates if no signOut handler is registered (no boot race)", () => {
    const navigateFn = jest.fn();
    setSigninHandler(navigateFn);
    // Deliberately no setSignOutHandler.

    const err = new ApiError({
      status: 401,
      message: "expired",
      action: "signin",
    });
    const toast = mapErrorToToast(err);
    toast.action?.onClick();

    expect(navigateFn).toHaveBeenCalledTimes(1);
  });

  it("does not block navigation when signOut throws", () => {
    const signOutFn = jest.fn(() => {
      throw new Error("revoke endpoint flaked");
    });
    const navigateFn = jest.fn();
    setSignOutHandler(signOutFn);
    setSigninHandler(navigateFn);

    const err = new ApiError({
      status: 401,
      message: "expired",
      action: "signin",
    });
    const toast = mapErrorToToast(err);
    toast.action?.onClick();

    expect(signOutFn).toHaveBeenCalledTimes(1);
    expect(navigateFn).toHaveBeenCalledTimes(1);
  });

  it("does not block navigation when signOut returns a rejecting Promise", async () => {
    const signOutFn = jest.fn(() => Promise.reject(new Error("network blip")));
    const navigateFn = jest.fn();
    setSignOutHandler(signOutFn);
    setSigninHandler(navigateFn);

    const err = new ApiError({
      status: 401,
      message: "expired",
      action: "signin",
    });
    const toast = mapErrorToToast(err);
    toast.action?.onClick();

    // Navigate should fire synchronously despite the pending promise.
    expect(navigateFn).toHaveBeenCalledTimes(1);

    // Drain microtasks so the rejection handler runs (and is swallowed).
    await Promise.resolve();
    await Promise.resolve();

    // The unhandled-rejection .catch in goToLogin must have absorbed it.
    expect(signOutFn).toHaveBeenCalledTimes(1);
  });
});

// ─── Fix 3: refreshTokenWithRetry — base.ts ────────────────────────────

describe("refreshTokenWithRetry (connectors/api/base.ts)", () => {
  // This test exercises the retry helper through the bridge. We import
  // both modules fresh per test so the bridge state is isolated.
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retries once after a transient throw, then succeeds", async () => {
    const bridge = require("@/modules/shared/auth-token-bridge");
    const base = require("@/modules/connectors/api/base");

    let calls = 0;
    bridge.setValidTokenGetter(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("ECONNRESET");
      }
      return "fresh-token-after-retry";
    });

    const promise = base.refreshTokenWithRetry();
    // Drain the 500 ms backoff before awaiting the result.
    await jest.advanceTimersByTimeAsync(500);
    const token = await promise;

    expect(token).toBe("fresh-token-after-retry");
    expect(calls).toBe(2);
  });

  it("surrenders on the SECOND throw (one retry only)", async () => {
    const bridge = require("@/modules/shared/auth-token-bridge");
    const base = require("@/modules/connectors/api/base");

    let calls = 0;
    bridge.setValidTokenGetter(async () => {
      calls += 1;
      throw new Error("ECONNRESET");
    });

    // Pre-attach the rejection assertion BEFORE advancing fake timers.
    // Otherwise the second throw lands as an unhandled rejection during
    // `advanceTimersByTimeAsync` and Jest fails the test even though our
    // helper does propagate the error.
    const promise = base.refreshTokenWithRetry();
    const assertion = expect(promise).rejects.toThrow("ECONNRESET");
    await jest.advanceTimersByTimeAsync(500);
    await assertion;
    expect(calls).toBe(2);
  });

  it("does NOT retry NotAuthorizedException (refresh token genuinely revoked)", async () => {
    const bridge = require("@/modules/shared/auth-token-bridge");
    const base = require("@/modules/connectors/api/base");

    let calls = 0;
    bridge.setValidTokenGetter(async () => {
      calls += 1;
      const e = new Error("Refresh Token has expired");
      (e as Error & { name: string }).name = "NotAuthorizedException";
      throw e;
    });

    await expect(base.refreshTokenWithRetry()).rejects.toThrow(
      "Refresh Token has expired",
    );
    expect(calls).toBe(1);
  });
});

// ─── Fix 4: getValidToken / auto-refresh threshold parity ──────────────

describe("Fix 4 — refresh threshold parity", () => {
  it("getValidToken source uses the same 300 s (5 min) threshold as the auto-refresh interval", () => {
    // We assert the two thresholds match by reading the source — a runtime
    // assertion would require a full React render of useAuth which is
    // overkill for a single numeric guard. The point of this test is to
    // FAIL LOUDLY if someone tweaks one threshold and forgets the other.
    //
    // (jsdom + Cognito SDK + setInterval is a poor fit; the source check
    // is sufficient for the parity invariant.)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../modules/auth/hooks/use-auth.ts"),
      "utf8",
    );

    // Auto-refresh interval threshold (line ~76): `expiresIn < 300`
    expect(src).toMatch(/expiresIn\s*<\s*300/);

    // getValidToken threshold (line ~555): `> 300` — the 5-min match.
    expect(src).toMatch(/payload\.exp\s*-\s*Date\.now\(\)\s*\/\s*1000\s*>\s*300/);

    // Regression guard: the OLD 600-second threshold MUST be gone.
    expect(src).not.toMatch(/payload\.exp\s*-\s*Date\.now\(\)\s*\/\s*1000\s*>\s*600/);
  });
});
