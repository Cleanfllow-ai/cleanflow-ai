"use client"

/**
 * SalesforceSetupModal — BYO Connected App setup + reconnect UI.
 *
 * Two modes:
 *   - "byo"    (recommended for enterprise): customer brings their own
 *              Connected App (Consumer Key + Secret + Login URL).
 *   - "shared" (when CleanFlowAI's shared app is generally available):
 *              one-click OAuth using our app — disabled when the BE reports
 *              `shared_app_available=false`.
 *
 * On submit the BE returns an `auth_url`. We must navigate the FULL PAGE to
 * it (`window.location.assign`) — Salesforce blocks popups + iframes for
 * the OAuth screen and either silently fails or shows "refused to connect".
 *
 * The callback hits /connectors/callback?provider=salesforce&success=true
 * which posts a message back to the opener. In this BYO flow the opener IS
 * the same tab (no popup), so the callback page simply lands the user back
 * on the connectors hub after a brief "Connecting…" screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/shared/hooks/use-toast"

import {
  salesforceByoAPI,
  type SalesforceByoInitRequest,
  type SalesforceEnvironment,
  type SalesforceOAuthMode,
  type SalesforceSetupInfo,
} from "@/modules/connectors/api/salesforce-byo-api"

// ─── Validation helpers ─────────────────────────────────────────────────────

const SF_LOGIN_URL_REGEX =
  /^https:\/\/(login|test)\.salesforce\.com$|^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.my\.salesforce\.com$/

function isValidConsumerKey(key: string): boolean {
  // Salesforce Consumer Keys conventionally start with "3MVG9".
  // We allow any starting prefix because the BE validates definitively;
  // this is just a soft hint so we can show inline feedback before submit.
  return key.trim().length >= 40
}

function isValidConsumerSecret(secret: string): boolean {
  return secret.trim().length >= 30
}

function isValidLoginUrl(url: string): boolean {
  return SF_LOGIN_URL_REGEX.test(url.trim())
}

// ─── Component props ────────────────────────────────────────────────────────

export type SalesforceSetupModalMode = "create" | "manage" | "reconnect"

export interface SalesforceSetupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * `create` — first-time connect.
   * `manage` — existing connection; edit settings or rotate creds.
   * `reconnect` — needs_reconnect=true; same UI as manage but with red banner.
   */
  modalMode?: SalesforceSetupModalMode
  /** Pre-fill values for manage / reconnect paths. Client_id is NOT secret. */
  existingConnection?: {
    oauth_mode?: SalesforceOAuthMode
    client_id?: string
    login_url?: string
    environment?: SalesforceEnvironment
  } | null
  /** Called after a successful redirect kick-off so the parent can clean up. */
  onAuthRedirect?: () => void
}

type EnvironmentChoice = SalesforceEnvironment | "custom"

// ─── Main component ─────────────────────────────────────────────────────────

export function SalesforceSetupModal({
  open,
  onOpenChange,
  modalMode = "create",
  existingConnection,
  onAuthRedirect,
}: SalesforceSetupModalProps) {
  const { toast } = useToast()
  const triggerRef = useRef<HTMLElement | null>(null)

  // Setup info from BE
  const [setupInfo, setSetupInfo] = useState<SalesforceSetupInfo | null>(null)
  const [setupInfoLoading, setSetupInfoLoading] = useState(false)
  const [setupInfoError, setSetupInfoError] = useState<string | null>(null)

  // Form state
  const [mode, setMode] = useState<SalesforceOAuthMode>(
    existingConnection?.oauth_mode ?? "byo",
  )
  const [clientId, setClientId] = useState<string>(
    existingConnection?.client_id ?? "",
  )
  const [clientSecret, setClientSecret] = useState<string>("")
  const [showSecret, setShowSecret] = useState(false)
  const [environment, setEnvironment] = useState<EnvironmentChoice>(
    existingConnection?.login_url &&
      !["https://login.salesforce.com", "https://test.salesforce.com"].includes(
        existingConnection.login_url,
      )
      ? "custom"
      : (existingConnection?.environment ?? "production")
  )
  const [customLoginUrl, setCustomLoginUrl] = useState<string>(
    existingConnection?.login_url &&
      !["https://login.salesforce.com", "https://test.salesforce.com"].includes(
        existingConnection.login_url,
      )
      ? existingConnection.login_url
      : "",
  )

  // Action state
  const [testing, setTesting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // ─── Load setup info on open ─────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    // Capture the currently-focused element so we can return focus on close.
    triggerRef.current = (document.activeElement as HTMLElement) || null

    setSetupInfoError(null)
    setSetupInfoLoading(true)
    salesforceByoAPI
      .getSetupInfo()
      .then((info) => {
        setSetupInfo(info)
        // If the shared app is unavailable, force BYO regardless of how the
        // modal was opened. (The radio is disabled below as well.)
        if (!info.shared_app_available && mode === "shared") {
          setMode("byo")
        }
      })
      .catch((err) => {
        console.error("[Salesforce:getSetupInfo]", err)
        setSetupInfoError(
          "Could not load Salesforce setup info. Please close and retry.",
        )
      })
      .finally(() => setSetupInfoLoading(false))
    // We intentionally only refetch on open transitions; subsequent state
    // changes inside the modal must not re-trigger this network call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Reset form errors when the user switches mode.
  useEffect(() => {
    setInlineError(null)
  }, [mode])

  // ─── Derived state ───────────────────────────────────────────────────────

  const callbackUrl = setupInfo?.callback_url ?? ""
  const requiredScopes = setupInfo?.required_scopes ?? [
    "api",
    "refresh_token",
    "offline_access",
  ]

  const computedLoginUrl = useMemo<string>(() => {
    if (mode === "shared") {
      return environment === "sandbox"
        ? setupInfo?.login_urls?.sandbox ?? "https://test.salesforce.com"
        : setupInfo?.login_urls?.production ?? "https://login.salesforce.com"
    }
    if (environment === "custom") return customLoginUrl.trim()
    return environment === "sandbox"
      ? setupInfo?.login_urls?.sandbox ?? "https://test.salesforce.com"
      : setupInfo?.login_urls?.production ?? "https://login.salesforce.com"
  }, [
    mode,
    environment,
    customLoginUrl,
    setupInfo?.login_urls?.sandbox,
    setupInfo?.login_urls?.production,
  ])

  const isReconnectFlow = modalMode === "reconnect"
  const isManageFlow = modalMode === "manage" || modalMode === "reconnect"

  // For manage flow: allow blank secret (BE keeps existing).
  // For create flow: secret is required.
  const secretRequired = mode === "byo" && !isManageFlow
  const secretValid = clientSecret === ""
    ? !secretRequired
    : isValidConsumerSecret(clientSecret)

  const clientIdValid = mode === "byo" ? isValidConsumerKey(clientId) : true
  const loginUrlValid =
    mode === "byo" && environment === "custom"
      ? isValidLoginUrl(customLoginUrl)
      : true

  const canSubmit =
    !!setupInfo &&
    !submitting &&
    !testing &&
    (mode === "shared"
      ? !!setupInfo.shared_app_available
      : clientIdValid && secretValid && loginUrlValid)

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!callbackUrl) return
    try {
      await navigator.clipboard.writeText(callbackUrl)
      setCopySuccess(true)
      toast({
        title: "Copied!",
        description: "Callback URL copied to clipboard.",
      })
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error("[Salesforce:copy]", err)
      toast({
        title: "Could not copy",
        description: "Please copy the URL manually.",
        variant: "destructive",
      })
    }
  }, [callbackUrl, toast])

  const buildByoRequest = useCallback((): SalesforceByoInitRequest | null => {
    if (mode !== "byo") return null
    const loginUrl = computedLoginUrl
    if (!loginUrl) return null
    return {
      mode: "byo",
      client_id: clientId.trim(),
      client_secret: clientSecret, // never trim — secrets may be sensitive
      login_url: loginUrl,
      environment: environment === "custom" ? "production" : environment,
    }
  }, [mode, clientId, clientSecret, environment, computedLoginUrl])

  const handleTest = useCallback(async () => {
    const req = buildByoRequest()
    if (!req) return
    setInlineError(null)
    setTesting(true)
    try {
      const result = await salesforceByoAPI.testConfig(req)
      if (result.ok) {
        toast({
          title: "Configuration looks good",
          description:
            "Your Connected App credentials reached Salesforce successfully.",
        })
      } else {
        const msg =
          result.error ||
          "We could not validate the credentials. Double-check the Consumer Key, Secret, and Login URL."
        setInlineError(msg)
        toast({
          title: "Could not validate",
          description: msg,
          variant: "destructive",
        })
      }
    } finally {
      setTesting(false)
    }
  }, [buildByoRequest, toast])

  const handleSubmit = useCallback(async () => {
    setInlineError(null)
    setSubmitting(true)
    try {
      const body =
        mode === "shared"
          ? ({
              mode: "shared" as const,
              environment:
                environment === "custom" ? "production" : environment,
            })
          : buildByoRequest()
      if (!body) {
        setInlineError("Form is incomplete. Please fill in all required fields.")
        return
      }
      const resp = await salesforceByoAPI.init(body)
      if (!resp.auth_url) {
        setInlineError(
          "We did not receive an authorization URL. Please try again.",
        )
        return
      }
      // Best-effort: callers may want to flush UI state before we navigate away.
      try {
        onAuthRedirect?.()
      } catch {
        // ignore
      }
      // FULL PAGE redirect — Salesforce iframes/popup are blocked.
      window.location.assign(resp.auth_url)
    } catch (err) {
      const message =
        (err as { message?: string })?.message ||
        "Could not start Salesforce authorization. Please try again."
      console.error("[Salesforce:init]", err)
      // Translate well-known BE error codes into friendly copy.
      const code = (err as { code?: string })?.code || ""
      const friendly =
        code === "invalid_byo_credentials"
          ? "Salesforce rejected the Consumer Key/Secret. Double-check the values you copied from your Connected App."
          : code === "invalid_login_url"
          ? "Your Login URL doesn't look right. For production use https://login.salesforce.com; for sandbox use https://test.salesforce.com; or paste your full My Domain URL."
          : code === "redirect_uri_mismatch"
          ? "Your Callback URL doesn't match. Copy the exact URL from the box above into your Salesforce Connected App."
          : message
      setInlineError(friendly)
    } finally {
      setSubmitting(false)
    }
  }, [mode, environment, buildByoRequest, onAuthRedirect])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Reset transient state on close so a future open is clean.
      setInlineError(null)
      setShowSecret(false)
      setCopySuccess(false)
      // Return focus to the trigger if it still exists in the DOM.
      try {
        triggerRef.current?.focus()
      } catch {
        /* noop */
      }
    }
    onOpenChange(next)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="salesforce-setup-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500" />
            {isReconnectFlow
              ? "Reconnect Salesforce"
              : isManageFlow
              ? "Manage Salesforce connection"
              : "Connect Salesforce"}
          </DialogTitle>
          <DialogDescription>
            {isReconnectFlow
              ? "Refresh your Salesforce credentials to restore the connection."
              : "Connect your Salesforce account so CleanFlowAI can read and write to it on your behalf."}
          </DialogDescription>
        </DialogHeader>

        {isReconnectFlow && (
          <Alert variant="destructive" data-testid="salesforce-reconnect-banner">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Reconnect required</AlertTitle>
            <AlertDescription>
              Your Salesforce credentials need to be refreshed. This typically
              happens when you rotated the Consumer Secret in Salesforce, or
              when an admin revoked the Connected App.
            </AlertDescription>
          </Alert>
        )}

        {setupInfoLoading ? (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading setup info…</span>
          </div>
        ) : setupInfoError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Couldn't load setup info</AlertTitle>
            <AlertDescription>{setupInfoError}</AlertDescription>
          </Alert>
        ) : !setupInfo ? null : (
          <div className="space-y-6">
            {/* ─── Mode picker ─────────────────────────────────────────── */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Connection mode
              </Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as SalesforceOAuthMode)}
                className="gap-3"
                data-testid="salesforce-mode-radio"
              >
                <label
                  htmlFor="sf-mode-byo"
                  className="flex items-start gap-3 rounded-md border border-border bg-background p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                >
                  <RadioGroupItem value="byo" id="sf-mode-byo" className="mt-1" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      Use my company's own Connected App
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Recommended for enterprise. You stay in control of the
                      OAuth credentials, scopes, and IP allow-lists in your
                      Salesforce org.
                    </div>
                  </div>
                </label>
                <label
                  htmlFor="sf-mode-shared"
                  className={`flex items-start gap-3 rounded-md border border-border bg-background p-3 transition-colors ${
                    setupInfo.shared_app_available
                      ? "cursor-pointer hover:bg-accent/40"
                      : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <RadioGroupItem
                    value="shared"
                    id="sf-mode-shared"
                    className="mt-1"
                    disabled={!setupInfo.shared_app_available}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      Use CleanFlowAI's shared Connected App
                      {!setupInfo.shared_app_available && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400">
                          Currently unavailable
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      One-click setup. No Salesforce admin work required.
                    </div>
                  </div>
                </label>
              </RadioGroup>
              {!setupInfo.shared_app_available && (
                <Alert className="mt-3 border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
                    Our shared Connected App is temporarily restricted while
                    Salesforce reviews additional permitted users. Choose the
                    BYO option below for now — setup takes about 5 minutes.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* ─── BYO mode panel ──────────────────────────────────────── */}
            {mode === "byo" && (
              <>
                <div className="border-t border-border/60" />

                {/* Step 1 — Callback URL */}
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Step 1 — Create a Connected App in Salesforce
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      In Salesforce, go to <strong>Setup → App Manager → New
                      Connected App</strong>. Enable OAuth Settings and paste
                      the Callback URL below into the "Callback URL" field.
                    </p>
                  </div>

                  <div>
                    <Label
                      htmlFor="sf-callback-url"
                      className="text-xs text-muted-foreground"
                    >
                      Callback URL (paste this into your Connected App, exactly)
                    </Label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        id="sf-callback-url"
                        readOnly
                        value={callbackUrl}
                        className="font-mono text-xs"
                        onFocus={(e) => e.currentTarget.select()}
                        data-testid="salesforce-callback-url"
                        aria-label="Callback URL"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="shrink-0"
                        data-testid="salesforce-callback-copy"
                        aria-label="Copy callback URL"
                      >
                        {copySuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      Must match exactly. No trailing slash. Must use https.
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="text-xs font-medium mb-1">
                      What CleanFlowAI is allowed to do
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Add these OAuth scopes in your Connected App:
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {requiredScopes.map((scope) => (
                        <code
                          key={scope}
                          className="rounded bg-background border border-border px-1.5 py-0.5 text-[11px] font-mono"
                        >
                          {scope}
                        </code>
                      ))}
                    </div>
                  </div>

                  {setupInfo.setup_doc_url && (
                    <a
                      href={setupInfo.setup_doc_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Step-by-step guide with screenshots
                    </a>
                  )}
                </section>

                <div className="border-t border-border/60" />

                {/* Step 2 — Credentials */}
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Step 2 — Paste your Connected App credentials
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      In Salesforce, click "Manage Consumer Details" on your
                      Connected App. Copy these two values into the fields
                      below.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="sf-client-id" className="text-xs">
                      Consumer Key (Client ID)
                      <span className="text-red-500 ml-0.5">*</span>
                    </Label>
                    <Input
                      id="sf-client-id"
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="3MVG9..."
                      className="mt-1.5 font-mono text-xs"
                      autoComplete="off"
                      spellCheck={false}
                      data-testid="salesforce-client-id"
                      aria-invalid={clientId.length > 0 && !clientIdValid}
                    />
                    {clientId.length > 0 && !clientIdValid && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                        Consumer Keys are usually 80+ characters. Double-check
                        you copied the whole value.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="sf-client-secret" className="text-xs">
                      Consumer Secret
                      {!isManageFlow && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </Label>
                    <div className="mt-1.5 relative">
                      <Input
                        id="sf-client-secret"
                        type={showSecret ? "text" : "password"}
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder={
                          isManageFlow
                            ? "Leave blank to keep existing"
                            : "Your Consumer Secret"
                        }
                        className="font-mono text-xs pr-20"
                        autoComplete="off"
                        spellCheck={false}
                        data-testid="salesforce-client-secret"
                        aria-invalid={
                          clientSecret.length > 0 && !secretValid
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((s) => !s)}
                        className="absolute right-1 top-1 bottom-1 px-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded transition-colors"
                        data-testid="salesforce-show-secret"
                        aria-label={showSecret ? "Hide secret" : "Show secret"}
                      >
                        {showSecret ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> Show
                          </>
                        )}
                      </button>
                    </div>
                    {clientSecret.length > 0 && !secretValid && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                        Consumer Secrets are usually 30+ characters.
                      </p>
                    )}
                    {isManageFlow && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Leave this blank to keep your existing secret. Only
                        fill it in if you rotated the secret in Salesforce.
                      </p>
                    )}
                  </div>
                </section>

                <div className="border-t border-border/60" />

                {/* Step 3 — Environment */}
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Step 3 — Choose your environment
                    </h3>
                  </div>

                  <RadioGroup
                    value={environment}
                    onValueChange={(v) =>
                      setEnvironment(v as EnvironmentChoice)
                    }
                    className="gap-2"
                    data-testid="salesforce-env-radio"
                  >
                    <label
                      htmlFor="sf-env-prod"
                      className="flex items-center gap-3 rounded-md border border-border bg-background p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <RadioGroupItem value="production" id="sf-env-prod" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Production</div>
                        <div className="text-xs text-muted-foreground">
                          login.salesforce.com
                        </div>
                      </div>
                    </label>
                    <label
                      htmlFor="sf-env-sandbox"
                      className="flex items-center gap-3 rounded-md border border-border bg-background p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <RadioGroupItem value="sandbox" id="sf-env-sandbox" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Sandbox</div>
                        <div className="text-xs text-muted-foreground">
                          test.salesforce.com
                        </div>
                      </div>
                    </label>
                    <label
                      htmlFor="sf-env-custom"
                      className="flex items-center gap-3 rounded-md border border-border bg-background p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <RadioGroupItem value="custom" id="sf-env-custom" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          Custom My Domain (advanced)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Use your own My Domain URL.
                        </div>
                      </div>
                    </label>
                  </RadioGroup>

                  {environment === "custom" && (
                    <div>
                      <Label htmlFor="sf-custom-domain" className="text-xs">
                        My Domain URL
                        <span className="text-red-500 ml-0.5">*</span>
                      </Label>
                      <Input
                        id="sf-custom-domain"
                        type="url"
                        value={customLoginUrl}
                        onChange={(e) => setCustomLoginUrl(e.target.value)}
                        placeholder="https://your-org.my.salesforce.com"
                        className="mt-1.5 font-mono text-xs"
                        autoComplete="off"
                        spellCheck={false}
                        data-testid="salesforce-custom-domain"
                        aria-invalid={
                          customLoginUrl.length > 0 && !loginUrlValid
                        }
                      />
                      {customLoginUrl.length > 0 && !loginUrlValid && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                          Must be an https:// My Domain URL, e.g.
                          https://your-org.my.salesforce.com
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ─── Shared mode panel ───────────────────────────────────── */}
            {mode === "shared" && setupInfo.shared_app_available && (
              <>
                <div className="border-t border-border/60" />
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Choose your environment
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      We'll handle the OAuth handshake using CleanFlowAI's
                      shared Connected App.
                    </p>
                  </div>
                  <RadioGroup
                    value={environment === "custom" ? "production" : environment}
                    onValueChange={(v) =>
                      setEnvironment(v as EnvironmentChoice)
                    }
                    className="gap-2"
                    data-testid="salesforce-shared-env-radio"
                  >
                    <label
                      htmlFor="sf-shared-env-prod"
                      className="flex items-center gap-3 rounded-md border border-border bg-background p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <RadioGroupItem
                        value="production"
                        id="sf-shared-env-prod"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Production</div>
                        <div className="text-xs text-muted-foreground">
                          login.salesforce.com
                        </div>
                      </div>
                    </label>
                    <label
                      htmlFor="sf-shared-env-sandbox"
                      className="flex items-center gap-3 rounded-md border border-border bg-background p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <RadioGroupItem
                        value="sandbox"
                        id="sf-shared-env-sandbox"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Sandbox</div>
                        <div className="text-xs text-muted-foreground">
                          test.salesforce.com
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </section>
              </>
            )}

            {inlineError && (
              <Alert variant="destructive" data-testid="salesforce-inline-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{inlineError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2">
          <div>
            {mode === "byo" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={
                  testing ||
                  submitting ||
                  !clientIdValid ||
                  !secretValid ||
                  clientSecret.length === 0 ||
                  !loginUrlValid
                }
                data-testid="salesforce-test-config"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Testing…
                  </>
                ) : (
                  "Test connection"
                )}
              </Button>
            )}
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              data-testid="salesforce-connect-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Redirecting…
                </>
              ) : isReconnectFlow ? (
                <>
                  Reconnect
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </>
              ) : (
                <>
                  Connect
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SalesforceSetupModal
