"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth as useAuthHook } from "@/modules/auth/hooks/use-auth";
import type { MfaSetupData } from "@/modules/auth/types/auth.types";
import { orgAPI } from "@/modules/auth/api/org-api";
import { setValidTokenGetter } from "@/modules/shared/auth-token-bridge";
import {
  setReconnectHandler,
  setConnectHandler,
  setSigninHandler,
  setSignOutHandler,
} from "@/lib/error-toast";

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  idToken: string | null;
  accessToken: string | null;
  // MFA state
  mfaRequired: boolean;
  mfaSession: string | null;
  mfaUsername: string | null;
  // Idle timeout warning (case 5)
  idleWarnSecondsRemaining: number | null;
  // Auth functions
  signup: (email: string, password: string, confirmPassword: string, name?: string) => Promise<any>;
  confirmSignup: (email: string, code: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  logoutExpired: () => void;
  dismissIdleWarning: () => void;
  // MFA functions
  verifyMfaCode: (mfaCode: string) => Promise<any>;
  setupMfa: (accessToken: string) => Promise<MfaSetupData>;
  setupMfaWithSession: (session: string, email: string) => Promise<MfaSetupData & { session: string }>;
  confirmMfaSetup: (accessToken: string, mfaCode: string) => Promise<any>;
  confirmMfaSetupWithSession: (session: string, mfaCode: string, username: string) => Promise<any>;
  cancelMfa: () => void;
  // Password functions
  completeNewPassword: (newPassword: string) => Promise<any>;
  // Token refresh
  getValidToken: () => Promise<string>;
  permissions: Record<string, boolean>;
  permissionsLoaded: boolean;
  /** True when the last /org/me request errored (network blip, 5xx, abort,
   *  timeout, etc). The catch block in refreshPermissions sets
   *  permissionsLoaded=true so that AuthGuard releases the spinner, but the
   *  permissions map remains empty — which would previously cause
   *  hasPermission("...") to return false and surface a destructive
   *  "Permission denied" toast on the user's first click. UI gates that
   *  bind to permissions (Import/Upload/Delete/Stop buttons in /files)
   *  must check this flag and show a friendly "Loading your permissions"
   *  toast + trigger a retry instead of a destructive deny. */
  permissionsError: boolean;
  userRole: string | null;
  hasPermission: (key: string) => boolean;
  refreshPermissions: () => Promise<void>;
  /** True when /org/me returns onboarding_required=true or no membership exists.
   *  AuthGuard uses this to redirect to /create-organization. */
  onboardingRequired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthHook();
  const router = useRouter();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  // P0-1 fix (2026-05-19): track /org/me failure separately. Previously the
  // catch block flipped permissionsLoaded=true with an empty permissions map,
  // which caused hasPermission("files") to return false on the user's first
  // click and surface a destructive "Permission denied" toast even for Super
  // Admins. UI callers now key off permissionsError to show a friendly
  // loading toast + auto-retry instead.
  const [permissionsError, setPermissionsError] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  // ── Wire API-error toast handlers + 401 token-refresh bridge ──────
  // These run once at boot; non-React code (api/base.ts, file-upload-api.ts,
  // lib/error-toast.ts) calls into the registered functions.
  useEffect(() => {
    setValidTokenGetter(() => auth.getValidToken());
    setReconnectHandler((provider: string | null) => {
      const qs = provider ? `?reconnect=${encodeURIComponent(provider)}` : "";
      router.push(`/connectors${qs}`);
    });
    setConnectHandler((provider: string | null) => {
      const qs = provider ? `?connect=${encodeURIComponent(provider)}` : "";
      router.push(`/connectors${qs}`);
    });
    setSigninHandler(() => {
      router.push("/auth/login");
    });
    // Sign-out helper invoked BEFORE redirect to /auth/login. Clears stored
    // tokens + in-memory auth state so a "Back" press can't land the user
    // in the same broken-JWT loop. `auth.logout()` is synchronous (just
    // clears localStorage + resets useState), so this returns synchronously.
    setSignOutHandler(() => {
      auth.logout();
    });
    return () => {
      setValidTokenGetter(null);
      setReconnectHandler(null);
      setConnectHandler(null);
      setSigninHandler(null);
      setSignOutHandler(null);
    };
    // `getValidToken` / `logout` are recreated on every render of
    // useAuthHook, so we intentionally re-register them whenever they
    // change to capture the latest auth state closure.
  }, [auth.getValidToken, auth.logout, router]);

  const refreshPermissions = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.idToken) return;
    try {
      const me = await orgAPI.getMe(auth.idToken);
      // BE trap-state signal: HTTP 200 but no membership exists
      if (me?.onboarding_required || !me?.membership?.org_id) {
        setOnboardingRequired(true);
        setPermissionsLoaded(true);
        setPermissionsError(false);
        return;
      }
      // Normal path: membership present
      setOnboardingRequired(false);
      if (me?.role_permissions) {
        setPermissions(me.role_permissions);
      }
      if (me?.membership?.role) {
        setUserRole(me.membership.role);
        // Also sync to localStorage for legacy components/hard refreshes
        window.localStorage.setItem("cleanflowai.currentRole", me.membership.role);
      }
      setPermissionsLoaded(true);
      setPermissionsError(false);
    } catch {
      // P0-1 (2026-05-19): /org/me failed (network blip, 5xx, abort, timeout).
      // We still flip permissionsLoaded=true so AuthGuard releases the spinner
      // — keeping the page interactive — but mark permissionsError so action
      // gates (ensureFilesPermission etc) can distinguish "load failed and
      // retry needed" from "loaded with denial" and avoid firing a destructive
      // toast on the user's first click while the underlying retry is in flight.
      setPermissionsLoaded(true);
      setPermissionsError(true);
      // User may not have an org yet — silently ignore otherwise
    }
  }, [auth.isAuthenticated, auth.idToken]);

  // Fetch permissions once when auth resolves. Freshness is handled by the
  // 30s interval and focus/visibility listeners below.
  useEffect(() => {
    if (auth.isAuthenticated) {
      refreshPermissions();
    }
  }, [auth.isAuthenticated, refreshPermissions]);

  // Clear cached RBAC state on sign-out.
  useEffect(() => {
    if (auth.isAuthenticated) return;
    setPermissions({});
    setUserRole(null);
    setPermissionsLoaded(false);
    setPermissionsError(false);
    setOnboardingRequired(false);
  }, [auth.isAuthenticated]);

  // Keep permissions fresh even without navigation.
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const interval = window.setInterval(() => {
      refreshPermissions();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [auth.isAuthenticated, refreshPermissions]);

  // Refresh permissions on focus/visibility changes.
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const handleFocus = () => refreshPermissions();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshPermissions();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [auth.isAuthenticated, refreshPermissions]);

  // Cross-tab signal for immediate RBAC refresh in same-browser sessions.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "cleanflowai.permissionsUpdatedAt") {
        refreshPermissions();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshPermissions]);

  const hasPermission = useCallback(
    (key: string) => {
      // If permissions haven't loaded yet, deny by default to avoid flickering
      if (!permissionsLoaded) return false;
      return permissions[key] === true;
    },
    [permissions, permissionsLoaded]
  );

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        idToken: auth.idToken,
        accessToken: auth.accessToken,
        // MFA state
        mfaRequired: auth.mfaRequired,
        mfaSession: auth.mfaSession,
        mfaUsername: auth.mfaUsername,
        // Idle timeout warning (case 5)
        idleWarnSecondsRemaining: auth.idleWarnSecondsRemaining ?? null,
        // Auth functions
        signup: auth.signup,
        confirmSignup: auth.confirmSignup,
        login: auth.login,
        logout: auth.logout,
        logoutExpired: auth.logoutExpired,
        dismissIdleWarning: auth.dismissIdleWarning,
        // MFA functions
        verifyMfaCode: auth.verifyMfaCode,
        setupMfa: auth.setupMfa,
        setupMfaWithSession: auth.setupMfaWithSession,
        confirmMfaSetup: auth.confirmMfaSetup,
        confirmMfaSetupWithSession: auth.confirmMfaSetupWithSession,
        cancelMfa: auth.cancelMfa,
        // Password functions
        completeNewPassword: auth.completeNewPassword,
        // Token refresh
        getValidToken: auth.getValidToken,
        // Permissions
        permissions,
        permissionsLoaded,
        permissionsError,
        userRole,
        hasPermission,
        refreshPermissions,
        onboardingRequired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
