import { Loader2 } from "lucide-react"

/**
 * Loading shell for the /connectors -> /admin?tab=connectors redirect.
 * Rendered during the brief server-side redirect window so users don't
 * see a flash of empty content.
 */
export default function ConnectorsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading connectors</p>
      </div>
    </div>
  )
}
