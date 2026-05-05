"use client"

import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root-level error boundary for the App Router.
 * Catches uncaught render errors anywhere under app/ and presents a recovery
 * UI with a retry button (re-renders the segment) and a home link.
 *
 * The auth/redux/theme providers from layout.tsx still wrap this — only the
 * children are replaced — so the page can still call hooks that depend on
 * those providers.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Surface to the console so it shows up in error monitoring without
    // being a silent black hole.
    console.error("[app/error.tsx] caught render error", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-destructive" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-sans text-xl font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            We hit an unexpected error. You can try again, or head back to the
            dashboard.
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono tabular-nums text-muted-foreground/70 pt-1">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
          <Button
            variant="default"
            size="sm"
            onClick={() => reset()}
            aria-label="Retry the failed action"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Try again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/dashboard"
            }}
            aria-label="Go to dashboard"
          >
            <Home className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
