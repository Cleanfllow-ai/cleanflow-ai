"use client"

import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <div>
          <h2 className="font-sans text-lg font-semibold text-foreground">
            Loading Data Tools
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Connecting to transformation engine...</p>
        </div>
      </div>
    </div>
  )
}
