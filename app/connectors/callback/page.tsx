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
 *
 * On success: auto-closes after 2s.
 * On error: stays open with a friendly explanation, "Try again" and "Cancel"
 * buttons (auto-close on error has been removed for better UX).
 */

const ERROR_COPY: Record<string, string> = {
  access_denied:
    "You declined to authorize {provider}. Try again to grant access.",
  invalid_grant: "Authorization link expired. Try again.",
  state_mismatch: "Security check failed. Please reconnect.",
  oauth_callback_failed:
    "Connection failed. Please try again — if the problem persists, contact support.",
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  googledrive: "Google Drive",
  onedrive: "OneDrive",
  dropbox: "Dropbox",
  quickbooks: "QuickBooks",
  zohobooks: "Zoho Books",
  snowflake: "Snowflake",
}

function providerLabel(p: string): string {
  if (!p || p === "unknown") return "the provider"
  return (
    PROVIDER_DISPLAY_NAMES[p.toLowerCase()] ||
    p.charAt(0).toUpperCase() + p.slice(1)
  )
}

function buildErrorMessage(
  provider: string,
  errorCode: string,
  errorDesc: string | null,
): string {
  const template = ERROR_COPY[errorCode]
  if (template) {
    return template.replace("{provider}", providerLabel(provider))
  }
  // Unknown code — fall back to "<code>: <description>"
  if (errorDesc) return `${errorCode}: ${errorDesc}`
  return errorCode
}

export default function ConnectorCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  )
  const [message, setMessage] = useState("Completing connection...")
  const [provider, setProvider] = useState("unknown")
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const providerParam = params.get("provider") || "unknown"
    const success = params.get("success")
    const error = params.get("error")
    const errorDesc = params.get("error_description")

    setProvider(providerParam)

    function notifyOpener(type: string, data: Record<string, unknown>) {
      const payload = { type, ...data }

      // Channel 1: window.opener.postMessage — fastest, but blocked under
      // strict COOP / cross-origin-opener-policy isolation.
      try {
        if (window.opener) {
          window.opener.postMessage(payload, window.location.origin)
        }
      } catch {
        // Opener access blocked by COOP — fall through to the other channels.
      }

      // Channel 2: BroadcastChannel — works across documents in the same
      // browsing context group even when the opener reference is severed
      // by COOP.
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("cleanflowai-oauth")
          channel.postMessage(payload)
          // Closing immediately is safe — the message has already been
          // dispatched synchronously to other listeners.
          channel.close()
        }
      } catch {
        // BroadcastChannel unavailable — fall through to the storage fallback.
      }

      // Channel 3: localStorage — last resort. Browsers fire a `storage`
      // event in OTHER same-origin windows whenever a key changes value,
      // so the parent window can pick up the signal even when neither
      // postMessage nor BroadcastChannel works.
      try {
        const provider = (payload.type || "").split("-auth-")[0] || "unknown"
        const key = `cleanflowai-oauth:${provider}`
        // Stamp with a unique nonce so consecutive successes/failures still
        // fire a `storage` event (the event only dispatches when newValue
        // differs from the previous value).
        const stamped = { ...payload, _nonce: `${Date.now()}-${Math.random()}` }
        window.localStorage.setItem(key, JSON.stringify(stamped))
        // The parent does its own removal after acting on the signal, but
        // we schedule a defensive cleanup in case the parent never wakes.
        setTimeout(() => {
          try { window.localStorage.removeItem(key) } catch { /* noop */ }
        }, 30_000)
      } catch {
        // localStorage may be disabled (third-party-cookie blocking,
        // private mode, quota). At this point the popup has done its best
        // — the user will see the success/error UI in the popup and the
        // parent will fall back to its safety timeout.
      }
    }

    function autoClose(delay: number) {
      setTimeout(() => {
        // Always TRY to close — browsers permit window.close() on
        // popups opened by window.open(), even when COOP has severed
        // the window.opener reference. If close fails we surface a
        // "you can close this tab" message rather than redirecting
        // through AuthGuard (which would land on /auth/login since
        // this popup window has no Cognito session of its own).
        try { window.close() } catch { /* noop */ }
        // If the window is still open ~500ms later, we're in a
        // direct-navigation (non-popup) scenario — only THEN redirect.
        setTimeout(() => {
          if (!window.closed) {
            // Show a permanent "you can close this tab" instead of
            // redirecting. The parent already got the postMessage and
            // refreshed its connector status.
            setMessage("You can close this tab.")
          }
        }, 500)
      }, delay)
    }

    if (error) {
      const friendly = buildErrorMessage(providerParam, error, errorDesc)
      setStatus("error")
      setMessage(friendly)
      setErrorCode(error)
      notifyOpener(`${providerParam}-auth-error`, {
        error: friendly,
        code: error,
      })
      // No auto-close on error — let the user read it and decide.
      return
    }

    if (success === "true") {
      setStatus("success")
      setMessage("Connected successfully!")
      notifyOpener(`${providerParam}-auth-success`, {
        realmId: params.get("realmId") || undefined,
      })
      autoClose(2000)
      return
    }

    // No explicit success/error — assume success (backend already processed
    // the callback)
    setStatus("success")
    setMessage("Connected successfully!")
    notifyOpener(`${providerParam}-auth-success`, {})
    autoClose(2000)
  }, [router])

  const handleTryAgain = () => {
    // Notify opener so it can re-trigger the OAuth flow, then close.
    try {
      if (window.opener) {
        window.opener.postMessage(
          { type: `${provider}-auth-retry`, code: errorCode ?? undefined },
          window.location.origin,
        )
      }
    } catch { /* COOP severed opener — best-effort */ }
    try { window.close() } catch { /* noop */ }
  }

  const handleCancel = () => {
    try { window.close() } catch { /* noop */ }
  }

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
            <p className="text-xs text-muted-foreground">
              This window will close automatically...
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto bg-destructive/10 rounded-full flex items-center justify-center mb-5">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-1">
              Connection Failed
            </h2>
            <p className="text-sm text-muted-foreground mb-5">{message}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 inline-flex items-center justify-center rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
