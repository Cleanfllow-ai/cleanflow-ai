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
  Clock,
  ChevronDown,
  Settings2,
  AlertTriangle,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import type {
  ConnectionStatus,
  ProviderInfo,
  PostAuthConfigField,
} from "@/modules/connectors/api/connectors-api"
import {
  prefetchERPEntities,
  prefetchDatabaseDeep,
  setCachedDefaults,
  invalidateMetadataCache,
  getCachedERPEntities,
} from "@/modules/connectors/hooks/use-connector-metadata-cache"
import { warehouseConnectorsAPI } from "@/modules/connectors/api/warehouse-connectors-api"
import type { WarehouseMetadataItem } from "@/modules/connectors/api/warehouse-connectors-api"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProviderWithStatus extends ProviderInfo {
  connectionStatus: ConnectionStatus | null
  statusLoading: boolean
  comingSoon?: boolean
}

const SAMPLE_PROVIDER_IDS = new Set(["sap", "salesforce", "netsuite", "epicor", "qad", "dynamics"])

// ─── Provider accent colors (subtle, only used for the left border stripe) ──

const PROVIDER_ACCENT: Record<string, string> = {
  quickbooks: "border-l-emerald-500",
  zohobooks: "border-l-red-500",
  snowflake: "border-l-cyan-500",
  googledrive: "border-l-amber-500",
  sap: "border-l-blue-600",
  salesforce: "border-l-sky-500",
  netsuite: "border-l-orange-500",
  epicor: "border-l-violet-500",
  qad: "border-l-teal-500",
  dynamics: "border-l-indigo-500",
}

// ─── Category metadata ──────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; description: string; icon: typeof Database }> = {
  erp: { label: "ERP Systems", description: "Accounting & business management", icon: Database },
  warehouse: { label: "Data Warehouses", description: "Cloud analytics platforms", icon: HardDrive },
  storage: { label: "Cloud Storage", description: "File storage & document management", icon: Cloud },
}

function getInitials(displayName: string): string {
  return (displayName || "?").split(/[\s-]+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?"
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch { return iso }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConnectorsHub() {
  const [providers, setProviders] = useState<ProviderWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null)
  const [savingConfig, setSavingConfig] = useState<string | null>(null)
  const [warehouseMeta, setWarehouseMeta] = useState<Record<string, { warehouses: WarehouseMetadataItem[]; databases: WarehouseMetadataItem[] }>>({})

  const loadProviders = useCallback(async () => {
    try {
      setError(null)
      const resp = await connectorsAPI.listProviders()
      const list: ProviderInfo[] = resp.providers || []
      const withStatus: ProviderWithStatus[] = list.map((p) => ({
        ...p, connectionStatus: null, statusLoading: !SAMPLE_PROVIDER_IDS.has(p.provider_id), comingSoon: SAMPLE_PROVIDER_IDS.has(p.provider_id),
      }))
      setProviders(withStatus)
      setLoading(false)

      const realProviders = list.filter((p) => !SAMPLE_PROVIDER_IDS.has(p.provider_id))
      const results = await Promise.all(
        realProviders.map(async (p) => {
          try {
            const status = await connectorsAPI.getConnectionStatus(p.provider_id)
            return { id: p.provider_id, status, category: p.category }
          } catch {
            return { id: p.provider_id, status: { connected: false } as ConnectionStatus, category: p.category }
          }
        }),
      )
      setProviders((prev) => prev.map((p) => {
        const result = results.find((r) => r.id === p.provider_id)
        return result ? { ...p, connectionStatus: result.status, statusLoading: false } : { ...p, statusLoading: false }
      }))
      for (const result of results) {
        if (result.status.connected && result.category === "warehouse") {
          Promise.all([
            warehouseConnectorsAPI.listWarehouses(result.id).catch(() => []),
            warehouseConnectorsAPI.listDatabases(result.id).catch(() => []),
          ]).then(([wh, dbs]) => setWarehouseMeta((prev) => ({ ...prev, [result.id]: { warehouses: wh, databases: dbs } })))
        }
        if (result.status.connected && result.category === "erp") {
          prefetchERPEntities(result.id).catch(() => {})
        }
      }
    } catch (err) {
      setError((err as Error).message || "Failed to load connectors")
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProviders() }, [loadProviders])

  const handleConnect = async (providerId: string) => {
    setConnectingProvider(providerId)
    try {
      const provider = providers.find((p) => p.provider_id === providerId)
      const result = await connectorsAPI.openOAuthPopupForProvider(providerId)
      if (result.success) {
        const status = await connectorsAPI.getConnectionStatus(providerId)
        setProviders((prev) => prev.map((p) => p.provider_id === providerId ? { ...p, connectionStatus: status, statusLoading: false } : p))
        if (provider?.category === "warehouse") {
          Promise.all([
            warehouseConnectorsAPI.listWarehouses(providerId).catch(() => []),
            warehouseConnectorsAPI.listDatabases(providerId).catch(() => []),
          ]).then(([wh, dbs]) => setWarehouseMeta((prev) => ({ ...prev, [providerId]: { warehouses: wh, databases: dbs } })))
        } else if (provider?.category === "erp") {
          prefetchERPEntities(providerId).catch(() => {})
        }
      }
    } catch { /* popup closed */ } finally { setConnectingProvider(null) }
  }

  const handleDisconnect = async (providerId: string, displayName: string) => {
    if (!confirm(`Disconnect from ${displayName}? You can reconnect anytime.`)) return
    setDisconnectingProvider(providerId)
    try {
      await connectorsAPI.disconnect(providerId)
      invalidateMetadataCache(providerId)
      setProviders((prev) => prev.map((p) => p.provider_id === providerId ? { ...p, connectionStatus: { connected: false } } : p))
    } catch { /* ignore */ } finally { setDisconnectingProvider(null) }
  }

  const handleSaveConfig = async (providerId: string, key: string, value: string) => {
    setSavingConfig(providerId)
    try {
      await connectorsAPI.saveConfig(providerId, { [key]: value })
      const status = await connectorsAPI.getConnectionStatus(providerId)
      setProviders((prev) => prev.map((p) => p.provider_id === providerId ? { ...p, connectionStatus: status } : p))
    } catch { /* ignore */ } finally { setSavingConfig(null) }
  }

  const handleSaveWarehouseDefault = async (providerId: string, key: "warehouse" | "database", value: string) => {
    setSavingConfig(providerId)
    try {
      await connectorsAPI.saveConfig(providerId, { [key]: value })
      setCachedDefaults(providerId, { [key]: value })
      const status = await connectorsAPI.getConnectionStatus(providerId)
      setProviders((prev) => prev.map((p) => p.provider_id === providerId ? { ...p, connectionStatus: status } : p))
      if (key === "database" && value) prefetchDatabaseDeep(providerId, value).catch(() => {})
    } catch { /* ignore */ } finally { setSavingConfig(null) }
  }

  const grouped = providers.reduce<Record<string, ProviderWithStatus[]>>((acc, p) => {
    const cat = p.category || "erp"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  const connectedCount = providers.filter((p) => p.connectionStatus?.connected).length
  const totalReal = providers.filter((p) => !p.comingSoon).length

  if (loading) {
    return (
      <div className="space-y-10 py-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-5 w-40 rounded bg-muted/40 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(i === 0 ? 2 : 1)].map((_, j) => (
                <div key={j} className="h-[160px] rounded-lg border bg-card animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-10 py-2">
      {/* Status summary */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{totalReal} connectors</span>
        {connectedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            {connectedCount} active
          </span>
        )}
        {connectedCount === 0 && totalReal > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Unplug className="w-4 h-4" />
            No active connections
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Category sections */}
      {Object.entries(CATEGORIES).map(([catKey, catMeta]) => {
        const catProviders = grouped[catKey]
        if (!catProviders || catProviders.length === 0) return null
        const CatIcon = catMeta.icon

        return (
          <section key={catKey} className="space-y-4">
            <div className="flex items-center gap-3">
              <CatIcon className="w-4 h-4 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">{catMeta.label}</h2>
                <p className="text-xs text-muted-foreground">{catMeta.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {catProviders.map((provider) => (
                <ConnectorCard
                  key={provider.provider_id}
                  provider={provider}
                  isConnecting={connectingProvider === provider.provider_id}
                  isDisconnecting={disconnectingProvider === provider.provider_id}
                  isSavingConfig={savingConfig === provider.provider_id}
                  warehouseMetadata={warehouseMeta[provider.provider_id]}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onSaveConfig={handleSaveConfig}
                  onSaveWarehouseDefault={handleSaveWarehouseDefault}
                />
              ))}
            </div>
          </section>
        )
      })}

      {providers.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Unplug className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-medium mb-1">No connectors available</h3>
          <p className="text-xs text-muted-foreground">Connectors will appear here once configured.</p>
        </div>
      )}
    </div>
  )
}

// ─── Connector Card ─────────────────────────────────────────────────────────

function ConnectorCard({
  provider, isConnecting, isDisconnecting, isSavingConfig, warehouseMetadata,
  onConnect, onDisconnect, onSaveConfig, onSaveWarehouseDefault,
}: {
  provider: ProviderWithStatus
  isConnecting: boolean
  isDisconnecting: boolean
  isSavingConfig: boolean
  warehouseMetadata?: { warehouses: WarehouseMetadataItem[]; databases: WarehouseMetadataItem[] }
  onConnect: (id: string) => void
  onDisconnect: (id: string, name: string) => void
  onSaveConfig: (id: string, key: string, value: string) => void
  onSaveWarehouseDefault: (id: string, key: "warehouse" | "database", value: string) => void
}) {
  const pid = provider.provider_id
  const displayName = provider.display_name
  const isConnected = provider.connectionStatus?.connected
  const isComingSoon = provider.comingSoon === true
  const conn = provider.connectionStatus?.connection
  const linkedAt = conn?.linked_at ? String(conn.linked_at) : null
  const isWarehouse = provider.category === "warehouse"
  const isERP = provider.category === "erp"
  const accent = PROVIDER_ACCENT[pid] || "border-l-border"

  const currentWarehouse = conn?.warehouse ? String(conn.warehouse) : ""
  const currentDatabase = conn?.database ? String(conn.database) : ""

  const [erpEntities, setErpEntities] = useState<Array<{ key: string; label: string }>>([])
  useEffect(() => {
    if (isConnected && isERP) {
      const cached = getCachedERPEntities(pid)
      if (cached.length > 0) setErpEntities(cached)
      prefetchERPEntities(pid).then(entities => {
        if (entities.length > 0) setErpEntities(entities)
      }).catch(() => {})
    }
  }, [isConnected, isERP, pid])

  const warehouseList = warehouseMetadata?.warehouses || []
  const databaseList = warehouseMetadata?.databases || []
  const metaLoading = isWarehouse && isConnected && !warehouseMetadata
  const warehouseNotConfigured = isWarehouse && isConnected && !metaLoading && !currentWarehouse && !currentDatabase

  return (
    <div
      className={`
        relative rounded-lg border-l-[3px] bg-card border border-border/60 transition-shadow
        ${isComingSoon ? `opacity-50 ${accent}` : isConnected ? accent : `border-l-transparent`}
        ${!isComingSoon && !isConnected ? "hover:shadow-sm" : ""}
      `}
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-muted/60 flex items-center justify-center text-xs font-bold text-foreground/70">
              {getInitials(displayName)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{displayName}</h3>
              {isComingSoon ? (
                <span className="text-xs text-muted-foreground">Coming soon</span>
              ) : provider.statusLoading ? (
                <span className="text-xs text-muted-foreground">Checking...</span>
              ) : isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                  {linkedAt && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(linkedAt)}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Not connected</span>
              )}
            </div>
          </div>

          {isSavingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {provider.statusLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/30" />}
        </div>

        {/* Post-auth config fields */}
        {!isComingSoon && isConnected &&
          provider.connectionStatus?.post_auth_config?.map((field: PostAuthConfigField) => (
            <div key={field.key}>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === "select" && field.options ? (
                <div className="relative">
                  <select
                    className="w-full h-9 text-sm rounded-md border border-border bg-background px-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors"
                    value={field.current_value || ""}
                    disabled={isSavingConfig}
                    onChange={(e) => onSaveConfig(pid, field.key, e.target.value)}
                  >
                    {!field.current_value && <option value="">Select {field.label}...</option>}
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              ) : field.type === "text" ? (
                <input
                  type="text"
                  className="w-full h-9 text-sm rounded-md border border-border bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors"
                  defaultValue={field.current_value || ""}
                  placeholder={`Enter ${field.label}...`}
                  onBlur={(e) => {
                    if (e.target.value !== (field.current_value || "")) onSaveConfig(pid, field.key, e.target.value)
                  }}
                />
              ) : null}
            </div>
          ))}

        {/* Warehouse config */}
        {!isComingSoon && isConnected && isWarehouse && (
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Connection Settings</span>
              </div>
              {warehouseNotConfigured && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Setup required
                </span>
              )}
            </div>

            {metaLoading ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading metadata...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {warehouseList.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">Warehouse</label>
                    <div className="relative">
                      <select
                        className="w-full h-9 text-sm rounded-md border border-border bg-background px-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors"
                        value={currentWarehouse}
                        disabled={isSavingConfig}
                        onChange={(e) => onSaveWarehouseDefault(pid, "warehouse", e.target.value)}
                      >
                        <option value="">Select warehouse...</option>
                        {warehouseList.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                )}
                {databaseList.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">Database</label>
                    <div className="relative">
                      <select
                        className="w-full h-9 text-sm rounded-md border border-border bg-background px-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors"
                        value={currentDatabase}
                        disabled={isSavingConfig}
                        onChange={(e) => onSaveWarehouseDefault(pid, "database", e.target.value)}
                      >
                        <option value="">Select database...</option>
                        {databaseList.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                )}
                {warehouseList.length === 0 && databaseList.length === 0 && (
                  <p className="text-xs text-muted-foreground">No warehouses or databases found. Check your connection permissions.</p>
                )}
                {(currentWarehouse || currentDatabase) && (
                  <p className="text-[11px] text-muted-foreground">Used across all import, export, and job workflows.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ERP entity summary */}
        {!isComingSoon && isConnected && isERP && erpEntities.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Discovered Entities</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {erpEntities.length} available
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {erpEntities.slice(0, 6).map(e => e.label).join(", ")}
              {erpEntities.length > 6 && `, +${erpEntities.length - 6} more`}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {isComingSoon ? (
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" disabled>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Connect
            </Button>
          ) : isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-border"
                onClick={() => onDisconnect(pid, displayName)}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1.5" />}
                Disconnect
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3"
                onClick={() => onConnect(pid)}
                disabled={isConnecting}
                title="Reconnect"
              >
                {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </>
          ) : (
            <Button size="sm" className="flex-1 h-9 text-xs" onClick={() => onConnect(pid)} disabled={isConnecting}>
              {isConnecting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Connecting...</>
              ) : (
                <><ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Connect</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
