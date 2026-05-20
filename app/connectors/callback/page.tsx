"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { AWS_CONFIG } from "@/shared/config/aws-config"

/**
 * Generic OAuth Callback Page for all connectors.
 *
 * Two entry paths:
 *   1. PROVIDER → FE directly (Salesforce BYO):
 *        ?provider=salesforce&code=...&state=...
 *      We must FORWARD code+state to the BE so the token exchange + DDB row
 *      write actually happens. Without this forward, the BE never runs
 *      `handle_callback`, no ConnectorConnections-V2 row is written, and the
 *      parent Connectors page stays on "Not connected" even though the popup
 *      shows success. (P0 bug fix, 2026-05-20.)
 *
 *   2. BE → FE after exchange (QB, Zoho, Snowflake, GoogleDrive, and
 *      Salesforce shared-app where the BE was the OAuth redirect_uri):
 *        ?provider=quickbooks&success=true  (or &error=...)
 *      We just show success/error and notify the opener.
 *
 * This page sends a postMessage to the opener window so the
 * ConnectorsHub / ERPImport popup flow completes correctly.
 *
 * On success: shows countdown (3…2…1) then auto-closes.
 * On error: stays open with a friendly explanation, "Try again" and "Cancel"
 * buttons (auto-close on error removed for better UX).
 *
 * No AuthGuard, no MainLayout, no sidebar — this is a stripped shell.
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
  salesforce: "Salesforce",
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
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  )
  const [message, setMessage] = useState("Completing connection...")
  const [provider, setProvider] = useState("unknown")
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cannotClose, setCannotClose] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const providerParam = params.get("provider") || "unknown"
    const success = params.get("success")
    const error = params.get("error")
    const errorDesc = params.get("error_description")
    const code = params.get("code")
    const state = params.get("state")

    setProvider(providerParam)

    // ── BE forward (Salesforce BYO P0 fix, 2026-05-20) ───────────────────
    // When SF redirects DIRECTLY here (code+state present, no success/error
    // marker), the BE has NOT yet exchanged the code for tokens, so no
    // ConnectorConnections-V2 row exists. We MUST forward to the BE callback
    // endpoint so the token exchange + DDB write happens. The BE will then
    // 302-redirect this same popup back here with `success=true`, which
    // re-enters this effect and runs the success path below.
    if (code && state && !success && !error) {
      const apiBase = AWS_CONFIG.API_BASE_URL || ""
      if (!apiBase) {
        // No API base URL baked in — surface as a real error rather than
        // silently dropping the auth code.
        setStatus("error")
        setMessage(
          "Connection misconfigured (missing API base URL). Please contact support.",
        )
        setErrorCode("config_missing")
        return
      }
      // Build BE callback URL: /connectors/callback/{provider}?code=...&state=...
      // (API GW route is NO AUTH; the BE matches state HMAC and runs
      // handle_callback which writes the connection row.)
      const beCallback = new URL(
        `${apiBase}/connectors/callback/${encodeURIComponent(providerParam)}`,
      )
      beCallback.searchParams.set("code", code)
      beCallback.searchParams.set("state", state)
      beCallback.searchParams.set("provider", providerParam)
      // Realm ID for QB; harmless for other providers.
      const realmId = params.get("realmId")
      if (realmId) beCallback.searchParams.set("realmId", realmId)
      // Replace navigation so the browser doesn't keep the raw code in
      // history (which would also stop the back button from re-triggering
      // the exchange on a stale code).
      window.location.replace(beCallback.toString())
      return
    }

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

    function startCountdownAndClose(seconds: number) {
      setCountdown(seconds)
      let remaining = seconds
      const tick = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearInterval(tick)
          setCountdown(0)
          try { window.close() } catch { /* noop */ }
          // If the window is still open ~500ms later, we're in a
          // direct-navigation (non-popup) scenario — show a manual-close hint.
          setTimeout(() => {
            if (!window.closed) {
              setCannotClose(true)
            }
          }, 500)
        } else {
          setCountdown(remaining)
        }
      }, 1000)
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
      notifyOpener(`${providerParam}-auth-success`, {
        realmId: params.get("realmId") || undefined,
      })
      startCountdownAndClose(3)
      return
    }

    // No explicit success/error — assume success (backend already processed
    // the callback)
    setStatus("success")
    notifyOpener(`${providerParam}-auth-success`, {})
    startCountdownAndClose(3)
  }, [])

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
            <h2 className="text-lg font-semibold mb-1">
              {providerLabel(provider)} connected
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Your account has been linked successfully.
            </p>
            {cannotClose ? (
              <p className="text-xs text-muted-foreground">
                You can close this tab now.
              </p>
            ) : countdown !== null && countdown > 0 ? (
              <p className="text-xs text-muted-foreground">
                This window will close in {countdown}…
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Closing window…
              </p>
            )}
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
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
