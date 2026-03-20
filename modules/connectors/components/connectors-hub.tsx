"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Cable,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Loader2,
  Power,
  RefreshCw,
  Database,
  HardDrive,
  FolderOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import type { ConnectionStatus, ProviderInfo, PostAuthConfigField } from "@/modules/connectors/api/connectors-api"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProviderWithStatus extends ProviderInfo {
  connectionStatus: ConnectionStatus | null
  statusLoading: boolean
}

// Category display metadata
const CATEGORIES: Record<string, { label: string; description: string; icon: typeof Database }> = {
  erp: {
    label: "ERP Systems",
    description: "Accounting, invoicing, and business management platforms",
    icon: Database,
  },
  warehouse: {
    label: "Data Warehouses",
    description: "Cloud data platforms for analytics and storage",
    icon: HardDrive,
  },
  storage: {
    label: "Cloud Storage",
    description: "File storage and document management services",
    icon: FolderOpen,
  },
}

// Provider accent colors for visual distinction
const PROVIDER_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  quickbooks: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
  zohobooks: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", ring: "ring-red-500/20" },
  netsuite: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", ring: "ring-sky-500/20" },
  dynamics: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/20" },
  snowflake: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/20" },
  googledrive: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
}

const DEFAULT_COLORS = { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" }

function getColors(providerId: string) {
  return PROVIDER_COLORS[providerId] || DEFAULT_COLORS
}

function getInitials(displayName: string): string {
  return (displayName || "?")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConnectorsHub() {
  const [providers, setProviders] = useState<ProviderWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null)
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

      // Fetch connection status for each provider in parallel
      const results = await Promise.all(
        list.map(async (p) => {
          try {
            const status = await connectorsAPI.getConnectionStatus(p.provider_id)
            return { id: p.provider_id, status }
          } catch {
            return { id: p.provider_id, status: { connected: false } as ConnectionStatus }
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

  const handleDisconnect = async (providerId: string, displayName: string) => {
    if (!confirm(`Disconnect from ${displayName}? You can reconnect anytime.`)) return

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
  const handleSaveConfig = async (providerId: string, key: string, value: string) => {
    setSavingConfig(providerId)
    try {
      await connectorsAPI.saveConfig(providerId, { [key]: value })
      // Refresh connection status to get updated current_value
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
  const grouped = providers.reduce<Record<string, ProviderWithStatus[]>>((acc, p) => {
    const cat = p.category || "erp"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  const connectedCount = providers.filter((p) => p.connectionStatus?.connected).length

  // ─── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-56 rounded-md bg-muted" />
        <div className="h-5 w-80 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Cable className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Connectors</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage connections to ERP systems, data warehouses, and cloud storage.
            {connectedCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {connectedCount} active
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadProviders}
          className="self-start sm:self-auto gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ─── Category Sections ───────────────────────────────────── */}
      {Object.entries(CATEGORIES).map(([catKey, catMeta]) => {
        const catProviders = grouped[catKey]
        if (!catProviders || catProviders.length === 0) return null

        const CatIcon = catMeta.icon
        return (
          <section key={catKey}>
            <div className="flex items-center gap-2 mb-3">
              <CatIcon className="w-4 h-4 text-muted-foreground/70" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                {catMeta.label}
              </h2>
              <span className="text-xs text-muted-foreground/50">{catMeta.description}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {catProviders.map((provider) => {
                const pid = provider.provider_id
                const displayName = provider.display_name
                const isConnected = provider.connectionStatus?.connected
                const isConnecting = connectingProvider === pid
                const isDisconnecting = disconnectingProvider === pid
                const colors = getColors(pid)

                return (
                  <div
                    key={pid}
                    className={`
                      relative group rounded-xl border transition-all duration-200
                      ${isConnected
                        ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10"
                        : "border-border bg-card hover:border-border/80 hover:shadow-sm"
                      }
                    `}
                  >
                    <div className="p-4">
                      {/* Provider header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`
                              w-10 h-10 rounded-lg flex items-center justify-center
                              text-xs font-bold tracking-tight ring-1
                              ${colors.bg} ${colors.text} ${colors.ring}
                            `}
                          >
                            {getInitials(displayName)}
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold leading-tight">{displayName}</h3>
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {catMeta.label}
                            </span>
                          </div>
                        </div>

                        {/* Status indicator */}
                        {provider.statusLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
                        ) : isConnected ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                          </span>
                        ) : null}
                      </div>

                      {/* Connection info & post-auth config */}
                      {isConnected && provider.connectionStatus && (
                        <div className="mb-3 space-y-2">
                          {/* Connection metadata */}
                          <div className="px-2.5 py-1.5 rounded-md bg-muted/50 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                            {provider.connectionStatus.connection?.email ? (
                              <span>{String(provider.connectionStatus.connection.email)}</span>
                            ) : null}
                            {provider.connectionStatus.connection?.linked_at ? (
                              <span>
                                Since{" "}
                                {new Date(
                                  String(provider.connectionStatus.connection.linked_at),
                                ).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>

                          {/* Dynamic post-auth config fields */}
                          {provider.connectionStatus.post_auth_config?.map((field: PostAuthConfigField) => (
                            <div key={field.key} className="px-2.5">
                              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-0.5">*</span>}
                              </label>
                              {field.type === "select" && field.options ? (
                                <select
                                  className="w-full h-7 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                  value={field.current_value || ""}
                                  disabled={savingConfig === pid}
                                  onChange={(e) => handleSaveConfig(pid, field.key, e.target.value)}
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
                                      handleSaveConfig(pid, field.key, e.target.value)
                                    }
                                  }}
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {isConnected ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800/40"
                              onClick={() => handleDisconnect(pid, displayName)}
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
                              className="h-8 text-xs"
                              onClick={() => handleConnect(pid)}
                              disabled={isConnecting}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Reconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90"
                            onClick={() => handleConnect(pid)}
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

                    {/* Hover arrow */}
                    {!isConnected && !isConnecting && (
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground/30 transition-all duration-200 group-hover:translate-x-0.5" />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Empty state */}
      {providers.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Cable className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-base font-medium mb-1">No connectors available</h3>
          <p className="text-sm text-muted-foreground">
            Connectors will appear here once configured in the backend.
          </p>
        </div>
      )}
    </div>
  )
}
