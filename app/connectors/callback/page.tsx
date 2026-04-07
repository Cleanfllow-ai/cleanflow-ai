"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

/**
 * Generic OAuth Callback Page for all connectors.
 *
 * The backend redirects here after OAuth with query params:
 *   ?provider=quickbooks&success=true  (or &error=...)
 *
 * This page sends a postMessage to the opener window so the
 * ConnectorsHub / ERPImport popup flow completes correctly.
 */
export default function ConnectorCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [message, setMessage] = useState("Completing connection...")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const provider = params.get("provider") || "unknown"
    const success = params.get("success")
    const error = params.get("error")
    const errorDesc = params.get("error_description")

    function notifyOpener(type: string, data: Record<string, unknown>) {
      if (window.opener) {
        window.opener.postMessage({ type, ...data }, window.location.origin)
      }
    }

    function autoClose(delay: number) {
      setTimeout(() => {
        if (window.opener) {
          window.close()
        } else {
          router.push("/admin")
        }
      }, delay)
    }

    if (error) {
      setStatus("error")
      setMessage(errorDesc || error || "Authorization failed")
      notifyOpener(`${provider}-auth-error`, {
        error: errorDesc || error || "Connection failed",
      })
      autoClose(5000)
      return
    }

    if (success === "true") {
      setStatus("success")
      setMessage("Connected successfully!")
      notifyOpener(`${provider}-auth-success`, {
        realmId: params.get("realmId") || undefined,
      })
      autoClose(1500)
      return
    }

    // No explicit success/error — assume success (backend already processed the callback)
    setStatus("success")
    setMessage("Connected successfully!")
    notifyOpener(`${provider}-auth-success`, {})
    autoClose(1500)
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl shadow-lg p-8 max-w-sm w-full">
        {status === "processing" && (
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin mb-5" />
            <h2 className="text-lg font-semibold mb-1">Connecting</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}
        {status === "success" && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-5">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Connected</h2>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <p className="text-xs text-muted-foreground">This window will close automatically...</p>
          </div>
        )}
        {status === "error" && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto bg-destructive/10 rounded-full flex items-center justify-center mb-5">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Connection Failed</h2>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <p className="text-xs text-muted-foreground">This window will close shortly...</p>
          </div>
        )}
      </div>
    </div>
  )
}
