"use client"

import { useAuth } from '@/modules/auth/providers/auth-provider'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = '/auth/login' }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Validate redirectTo to prevent open redirects
      const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/auth/login'
      router.push(safeRedirect)
    }
  }, [isAuthenticated, isLoading, redirectTo, router])

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

  return <>{children}</>
}
