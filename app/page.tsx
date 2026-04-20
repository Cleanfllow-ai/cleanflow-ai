"use client"

import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { loadStoredTokens, parseJWT } from "@/modules/auth/hooks/auth-session"

// Decide the landing route synchronously from localStorage rather than waiting
// for AuthProvider to finish its async init — shaves one render cycle off the
// cold-load redirect waterfall. AuthGuard on the destination page still
// enforces access if the token turns out to be invalid.
function resolveLandingRoute(): string {
  if (typeof window === "undefined") return "/auth/login"
  try {
    const tokens = loadStoredTokens()
    if (!tokens?.idToken) return "/auth/login"
    const payload = parseJWT(tokens.idToken)
    if (!payload || payload.exp <= Date.now() / 1000) {
      // Expired — if we have a refresh token, let the dashboard's auth flow
      // handle silent refresh; otherwise go straight to login.
      return tokens.refreshToken ? "/dashboard" : "/auth/login"
    }
    return "/dashboard"
  } catch {
    return "/auth/login"
  }
}

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(resolveLandingRoute())
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Loading</p>
      </div>
    </div>
  )
}
