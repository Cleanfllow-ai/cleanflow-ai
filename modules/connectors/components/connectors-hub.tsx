"use client"

import { useEffect, useState, useCallback } from "react"
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Power,
  RefreshCw,
  Database,
  HardDrive,
  Cloud,
  Unplug,
  LinkIcon,
  Clock,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  MotionDiv,
  MotionSection,
  staggerContainer,
  fadeInUp,
} from "@/components/ui/motion"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import type {
  ConnectionStatus,
  ProviderInfo,
  PostAuthConfigField,
} from "@/modules/connectors/api/connectors-api"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProviderWithStatus extends ProviderInfo {
  connectionStatus: ConnectionStatus | null
  statusLoading: boolean
}

// ─── Provider brand system ──────────────────────────────────────────────────

const PROVIDER_BRANDS: Record<
  string,
  {
    accent: string       // left bar + icon bg
    accentText: string   // icon fg
    glow: string         // connected card shadow
    connectedBg: string  // connected card background tint
    connectedBorder: string
  }
> = {
  quickbooks: {
    accent: "bg-emerald-500",
    accentText: "text-emerald-600 dark:text-emerald-400",
    glow: "shadow-emerald-500/8",
    connectedBg: "bg-emerald-50/40 dark:bg-emerald-950/15",
    connectedBorder: "border-emerald-200/60 dark:border-emerald-800/40",
  },
  zohobooks: {
    accent: "bg-red-500",
    accentText: "text-red-600 dark:text-red-400",
    glow: "shadow-red-500/8",
    connectedBg: "bg-red-50/40 dark:bg-red-950/15",
    connectedBorder: "border-red-200/60 dark:border-red-800/40",
  },
  snowflake: {
    accent: "bg-cyan-500",
    accentText: "text-cyan-600 dark:text-cyan-400",
    glow: "shadow-cyan-500/8",
    connectedBg: "bg-cyan-50/40 dark:bg-cyan-950/15",
    connectedBorder: "border-cyan-200/60 dark:border-cyan-800/40",
  },
  googledrive: {
    accent: "bg-amber-500",
    accentText: "text-amber-600 dark:text-amber-400",
    glow: "shadow-amber-500/8",
    connectedBg: "bg-amber-50/40 dark:bg-amber-950/15",
    connectedBorder: "border-amber-200/60 dark:border-amber-800/40",
  },
}

const DEFAULT_BRAND = {
  accent: "bg-primary",
  accentText: "text-primary",
  glow: "shadow-primary/8",
  connectedBg: "bg-primary/5",
  connectedBorder: "border-primary/20",
}

function getBrand(providerId: string) {
  return PROVIDER_BRANDS[providerId] || DEFAULT_BRAND
}

// ─── Category metadata ──────────────────────────────────────────────────────

const CATEGORIES: Record<
  string,
  { label: string; description: string; icon: typeof Database }
> = {
  erp: {
    label: "ERP Systems",
    description: "Accounting & business management",
    icon: Database,
  },
  warehouse: {
    label: "Data Warehouses",
    description: "Cloud analytics platforms",
    icon: HardDrive,
  },
  storage: {
    label: "Cloud Storage",
    description: "File storage & document management",
    icon: Cloud,
  },
}

// ─── Provider logo initials ─────────────────────────────────────────────────

function getInitials(displayName: string): string {
  return (
    (displayName || "?")
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConnectorsHub() {
  const [providers, setProviders] = useState<ProviderWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  )
  const [disconnectingProvider, setDisconnectingProvider] = useState<
    string | null
  >(null)
  const [savingConfig, setSavingConfig] = useState<string | null>(null)

  // ─── Load providers from backend ────────────────────────────────
  const loadProviders = useCallback(async () => {
    try {
      setError(null)
      const resp = await connectorsAPI.listProviders()
      const list: ProviderInfo[] = resp.providers || []

      const withStatus: ProviderWithStatus[] = list.map((p) => ({
        ...p,
        connectionStatus: null,
        statusLoading: true,
      }))
      setProviders(withStatus)
      setLoading(false)

      const results = await Promise.all(
        list.map(async (p) => {
          try {
            const status = await connectorsAPI.getConnectionStatus(
              p.provider_id,
            )
            return { id: p.provider_id, status }
          } catch {
            return {
              id: p.provider_id,
              status: { connected: false } as ConnectionStatus,
            }
          }
        }),
      )

      setProviders((prev) =>
        prev.map((p) => {
          const result = results.find((r) => r.id === p.provider_id)
          return result
            ? { ...p, connectionStatus: result.status, statusLoading: false }
            : { ...p, statusLoading: false }
        }),
      )
    } catch (err) {
      setError((err as Error).message || "Failed to load connectors")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  // ─── Connect / Disconnect ──────────────────────────────────────
  const handleConnect = async (providerId: string) => {
    setConnectingProvider(providerId)
    try {
      const result = await connectorsAPI.openOAuthPopupForProvider(providerId)
      if (result.success) {
        const status = await connectorsAPI.getConnectionStatus(providerId)
        setProviders((prev) =>
          prev.map((p) =>
            p.provider_id === providerId
              ? { ...p, connectionStatus: status, statusLoading: false }
              : p,
          ),
        )
      }
    } catch {
      // popup closed or error
    } finally {
      setConnectingProvider(null)
    }
  }

  const handleDisconnect = async (
    providerId: string,
    displayName: string,
  ) => {
    if (!confirm(`Disconnect from ${displayName}? You can reconnect anytime.`))
      return

    setDisconnectingProvider(providerId)
    try {
      await connectorsAPI.disconnect(providerId)
      setProviders((prev) =>
        prev.map((p) =>
          p.provider_id === providerId
            ? { ...p, connectionStatus: { connected: false } }
            : p,
        ),
      )
    } catch {
      // ignore
    } finally {
      setDisconnectingProvider(null)
    }
  }

  // ─── Save post-auth config ─────────────────────────────────────
  const handleSaveConfig = async (
    providerId: string,
    key: string,
    value: string,
  ) => {
    setSavingConfig(providerId)
    try {
      await connectorsAPI.saveConfig(providerId, { [key]: value })
      const status = await connectorsAPI.getConnectionStatus(providerId)
      setProviders((prev) =>
        prev.map((p) =>
          p.provider_id === providerId
            ? { ...p, connectionStatus: status }
            : p,
        ),
      )
    } catch {
      // ignore
    } finally {
      setSavingConfig(null)
    }
  }

  // ─── Group by category ─────────────────────────────────────────
  const grouped = providers.reduce<Record<string, ProviderWithStatus[]>>(
    (acc, p) => {
      const cat = p.category || "erp"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(p)
      return acc
    },
    {},
  )

  const connectedCount = providers.filter(
    (p) => p.connectionStatus?.connected,
  ).length

  // ─── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Summary skeleton */}
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-9 w-28 rounded-lg bg-muted/60 animate-pulse"
            />
          ))}
        </div>
        {/* Card skeletons */}
        <div className="space-y-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2.5">
              <div className="h-4 w-32 rounded bg-muted/50 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[...Array(i === 0 ? 2 : 1)].map((_, j) => (
                  <div
                    key={j}
                    className="h-32 rounded-xl border border-border bg-card animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────
  return (
    <MotionDiv
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* ─── Summary bar ───────────────────────────────────────── */}
      <MotionDiv variants={fadeInUp} className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
          <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {providers.length} available
          </span>
        </div>
        {connectedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-200/40 dark:border-emerald-800/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {connectedCount} connected
            </span>
          </div>
        )}
        {connectedCount === 0 && providers.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/8 border border-amber-200/40 dark:border-amber-800/30">
            <Unplug className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              No active connections
            </span>
          </div>
        )}
      </MotionDiv>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ─── Category sections ─────────────────────────────────── */}
      {Object.entries(CATEGORIES).map(([catKey, catMeta]) => {
        const catProviders = grouped[catKey]
        if (!catProviders || catProviders.length === 0) return null

        const CatIcon = catMeta.icon
        return (
          <MotionSection key={catKey} variants={fadeInUp}>
            {/* Category header */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-6 h-6 rounded-md bg-muted/60 flex items-center justify-center">
                <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">
                  {catMeta.label}
                </h2>
                <span className="text-[10px] text-muted-foreground/60">
                  {catMeta.description}
                </span>
              </div>
            </div>

            {/* Provider cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {catProviders.map((provider) => (
                <ConnectorCard
                  key={provider.provider_id}
                  provider={provider}
                  isConnecting={connectingProvider === provider.provider_id}
                  isDisconnecting={
                    disconnectingProvider === provider.provider_id
                  }
                  isSavingConfig={savingConfig === provider.provider_id}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onSaveConfig={handleSaveConfig}
                />
              ))}
            </div>
          </MotionSection>
        )
      })}

      {/* Empty state */}
      {providers.length === 0 && !error && (
        <MotionDiv
          variants={fadeInUp}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
            <Unplug className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-semibold mb-1">
            No connectors available
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Connectors will appear here once configured in the backend.
          </p>
        </MotionDiv>
      )}
    </MotionDiv>
  )
}

// ─── Connector Card ─────────────────────────────────────────────────────────

function ConnectorCard({
  provider,
  isConnecting,
  isDisconnecting,
  isSavingConfig,
  onConnect,
  onDisconnect,
  onSaveConfig,
}: {
  provider: ProviderWithStatus
  isConnecting: boolean
  isDisconnecting: boolean
  isSavingConfig: boolean
  onConnect: (id: string) => void
  onDisconnect: (id: string, name: string) => void
  onSaveConfig: (id: string, key: string, value: string) => void
}) {
  const pid = provider.provider_id
  const displayName = provider.display_name
  const isConnected = provider.connectionStatus?.connected
  const brand = getBrand(pid)
  const conn = provider.connectionStatus?.connection
  const email = conn?.email ? String(conn.email) : null
  const linkedAt = conn?.linked_at ? String(conn.linked_at) : null

  return (
    <MotionDiv
      variants={fadeInUp}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`
        relative overflow-hidden rounded-xl border transition-colors duration-200
        ${
          isConnected
            ? `${brand.connectedBorder} ${brand.connectedBg} shadow-md ${brand.glow}`
            : "border-border bg-card hover:border-border/80 hover:shadow-sm"
        }
      `}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300 ${
          isConnected ? brand.accent : "bg-muted-foreground/15"
        }`}
      />

      <div className="p-4 pl-5">
        {/* ─── Header row ──────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Provider avatar */}
            <div
              className={`
                w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold tracking-tight
                ${isConnected ? `${brand.accent}/15 ${brand.accentText}` : "bg-muted/70 text-muted-foreground"}
                transition-colors duration-300
              `}
            >
              {getInitials(displayName)}
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">
                {displayName}
              </h3>
              {provider.statusLoading ? (
                <span className="text-[10px] text-muted-foreground/50">
                  Checking...
                </span>
              ) : isConnected ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  Connected
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/60">
                  Not connected
                </span>
              )}
            </div>
          </div>

          {/* Status loading spinner */}
          {provider.statusLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/30" />
          )}
        </div>

        {/* ─── Connection metadata ─────────────────────────────── */}
        {isConnected && (email || linkedAt) && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-md bg-background/60 dark:bg-background/30 border border-border/40">
            {email && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Mail className="w-3 h-3 text-muted-foreground/50" />
                {email}
              </span>
            )}
            {linkedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3 text-muted-foreground/50" />
                {formatDate(linkedAt)}
              </span>
            )}
          </div>
        )}

        {/* ─── Post-auth config fields ─────────────────────────── */}
        {isConnected &&
          provider.connectionStatus?.post_auth_config?.map(
            (field: PostAuthConfigField) => (
              <div key={field.key} className="mb-3 px-0.5">
                <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground block mb-1">
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </label>
                {field.type === "select" && field.options ? (
                  <select
                    className="w-full h-7 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={field.current_value || ""}
                    disabled={isSavingConfig}
                    onChange={(e) =>
                      onSaveConfig(pid, field.key, e.target.value)
                    }
                  >
                    {!field.current_value && (
                      <option value="">Select {field.label}...</option>
                    )}
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "text" ? (
                  <input
                    type="text"
                    className="w-full h-7 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    defaultValue={field.current_value || ""}
                    placeholder={`Enter ${field.label}...`}
                    onBlur={(e) => {
                      if (e.target.value !== (field.current_value || "")) {
                        onSaveConfig(pid, field.key, e.target.value)
                      }
                    }}
                  />
                ) : null}
              </div>
            ),
          )}

        {/* ─── Actions ─────────────────────────────────────────── */}
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200/60 dark:border-red-800/40"
                onClick={() => onDisconnect(pid, displayName)}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Power className="w-3 h-3 mr-1" />
                )}
                Disconnect
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => onConnect(pid)}
                disabled={isConnecting}
                title="Reconnect"
              >
                {isConnecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90"
              onClick={() => onConnect(pid)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  Connect
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </MotionDiv>
  )
}
