"use client"

import { useAuth } from '@/modules/auth/providers/auth-provider'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

/** Pages exempt from the onboarding gate — must never trigger a redirect loop. */
const ONBOARDING_EXEMPT_PATHS = ['/create-organization', '/auth']

export function AuthGuard({ children, redirectTo = '/auth/login' }: AuthGuardProps) {
  const { isAuthenticated, isLoading, permissionsLoaded, onboardingRequired } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Validate redirectTo to prevent open redirects
      const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/auth/login'
      router.push(safeRedirect)
    }
  }, [isAuthenticated, isLoading, redirectTo, router])

  // Onboarding gate: authenticated user has no org membership → send to setup.
  useEffect(() => {
    if (!isAuthenticated || !permissionsLoaded) return
    if (!onboardingRequired) return
    const exempt = ONBOARDING_EXEMPT_PATHS.some((p) => pathname?.startsWith(p))
    if (!exempt) {
      router.replace('/create-organization')
    }
  }, [isAuthenticated, permissionsLoaded, onboardingRequired, pathname, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-full h-10 w-10 border-2 border-muted-foreground"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect in useEffect
  }

  // While permissions are loading, show spinner to avoid a flash of 403-prone content.
  if (!permissionsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-full h-10 w-10 border-2 border-muted-foreground"></div>
      </div>
    )
  }

  // Onboarding in progress — render nothing; the useEffect above will navigate.
  if (onboardingRequired && !ONBOARDING_EXEMPT_PATHS.some((p) => pathname?.startsWith(p))) {
    return null
  }

  return <>{children}</>
}
