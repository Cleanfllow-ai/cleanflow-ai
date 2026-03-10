// ─── Auth types ───────────────────────────────────────────────────────────────
// Extracted from hooks/useAuth.ts

export interface User {
    email: string
    sub: string
    username: string
    name: string
}

export interface AuthState {
    user: User | null
    isLoading: boolean
    isAuthenticated: boolean
    idToken: string | null
    accessToken: string | null
    refreshToken: string | null
    // MFA state
    mfaRequired: boolean
    mfaSession: string | null
    mfaUsername: string | null
}

export interface MfaSetupData {
    secretCode: string
    qrCodeUrl: string
}
