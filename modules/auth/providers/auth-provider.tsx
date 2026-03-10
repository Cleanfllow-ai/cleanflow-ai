"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth as useAuthHook } from "@/modules/auth/hooks/use-auth";
import { orgAPI } from "@/modules/auth/api/org-api";
import { usePathname } from "next/navigation";

interface MfaSetupData {
  secretCode: string;
  qrCodeUrl: string;
}

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
  // Auth functions
  signup: (email: string, password: string, confirmPassword: string, name?: string) => Promise<any>;
  confirmSignup: (email: string, code: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  // MFA functions
  verifyMfaCode: (mfaCode: string) => Promise<any>;
  setupMfa: (accessToken: string) => Promise<MfaSetupData>;
  setupMfaWithSession: (session: string, email: string) => Promise<MfaSetupData & { session: string }>;
  confirmMfaSetup: (accessToken: string, mfaCode: string) => Promise<any>;
  confirmMfaSetupWithSession: (session: string, mfaCode: string, username: string) => Promise<any>;
  cancelMfa: () => void;
  // Password functions
  completeNewPassword: (newPassword: string) => Promise<any>;
  permissions: Record<string, boolean>;
  permissionsLoaded: boolean;
  userRole: string | null;
  hasPermission: (key: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthHook();
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const refreshPermissions = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.idToken) return;
    try {
      const me = await orgAPI.getMe(auth.idToken);
      if (me?.role_permissions) {
        setPermissions(me.role_permissions);
      }
      if (me?.membership?.role) {
        setUserRole(me.membership.role);
        // Also sync to localStorage for legacy components/hard refreshes
        window.localStorage.setItem("cleanflowai.currentRole", me.membership.role);
      }
      setPermissionsLoaded(true);
    } catch {
      setPermissionsLoaded(true);
      // User may not have an org yet — silently ignore
    }
  }, [auth.isAuthenticated, auth.idToken]);

  // Fetch permissions when auth state changes
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  // Re-fetch permissions on page navigation
  useEffect(() => {
    if (auth.isAuthenticated) {
      refreshPermissions();
    }
  }, [pathname, auth.isAuthenticated, refreshPermissions]);

  // Clear cached RBAC state on sign-out.
  useEffect(() => {
    if (auth.isAuthenticated) return;
    setPermissions({});
    setUserRole(null);
    setPermissionsLoaded(false);
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
        // Auth functions
        signup: auth.signup,
        confirmSignup: auth.confirmSignup,
        login: auth.login,
        logout: auth.logout,
        // MFA functions
        verifyMfaCode: auth.verifyMfaCode,
        setupMfa: auth.setupMfa,
        setupMfaWithSession: auth.setupMfaWithSession,
        confirmMfaSetup: auth.confirmMfaSetup,
        confirmMfaSetupWithSession: auth.confirmMfaSetupWithSession,
        cancelMfa: auth.cancelMfa,
        // Password functions
        completeNewPassword: auth.completeNewPassword,
        // Permissions
        permissions,
        permissionsLoaded,
        userRole,
        hasPermission,
        refreshPermissions,
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
