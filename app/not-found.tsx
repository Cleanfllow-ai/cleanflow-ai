"use client"

import { FileQuestion, Home } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

/**
 * Root-level 404 page for the App Router.
 * Replaces the default Next.js 404 page with a branded, on-theme view that
 * matches the rest of the app's design language and gives users a clear
 * recovery path.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <FileQuestion className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            404
          </p>
          <h1 className="font-sans text-xl font-semibold text-foreground">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>
        </div>
        <div className="pt-1">
          <Link href="/dashboard">
            <Button variant="default" size="sm" aria-label="Go to dashboard">
              <Home className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
