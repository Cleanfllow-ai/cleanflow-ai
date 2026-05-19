"use client"

/**
 * EndpointsStep — wizard step 1.
 *
 * Side-by-side panels: Source (left), Destination (right). Each panel renders
 * a vertical stack of `EndpointEntry` rows with a "+ Add" footer.
 *
 * **M:N is supported** — the cardinality is derived from the count of
 * configured endpoints on each side; manual column mapping per (src, dst)
 * pair is handled in the next wizard step.
 *
 * Live cardinality banner at the top reads from `pipelineState.cardinality`
 * and shows a one-line summary like "1:1 — QB customers → Zoho customers".
 */

import { useEffect, useState } from "react"
import { Loader2, Plus, Trash2, Database, HardDrive, FileText, AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/shared/lib/utils"
import { ConnectorLogo } from "@/modules/connectors/components/connector-logo"
import {
    connectorsAPI,
    erpConnectorsAPI,
    warehouseConnectorsAPI,
    storageConnectorsAPI,
    type WarehouseMetadataItem,
    type StorageFile,
} from "@/modules/connectors"
import type { PipelineState, SourceEndpoint, DestEndpoint, Cardinality } from "./use-pipeline-builder"
import type { ProviderCategory } from "./use-job-dialog"
import { CATEGORY_LABELS, getProviderDisplayName } from "./job-dialog-constants"

// ─── Category options ─────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { label: string; value: ProviderCategory }[] = [
    { label: "Applications", value: "erp" },
    { label: "Data Warehouses", value: "warehouse" },
    { label: "Cloud Storage", value: "storage" },
]

const CATEGORY_ICON: Record<ProviderCategory, React.ReactNode> = {
    erp: <FileText className="h-3 w-3" />,
    warehouse: <Database className="h-3 w-3" />,
    storage: <HardDrive className="h-3 w-3" />,
}

// ─── Cardinality banner ───────────────────────────────────────────────────────

function CardinalityBanner({
    cardinality,
    sources,
    destinations,
}: {
    cardinality: Cardinality
    sources: SourceEndpoint[]
    destinations: DestEndpoint[]
}) {
    // Build a one-line summary like "QB customers → Zoho customers + Snowflake ANALYTICS_DB.PUBLIC.customers"
    const srcSummary = sources
        .filter(s => s.provider)
        .map(s => `${getProviderDisplayName(s.provider)} ${s.entities.join(", ") || "(no entities)"}`)
        .join(" + ") || "—"
    const dstSummary = destinations
        .filter(d => d.provider)
        .map(d => `${getProviderDisplayName(d.provider)} ${d.entities.join(", ") || "(no entities)"}`)
        .join(" + ") || "—"

    return (
        <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border text-xs",
            cardinality === "1:1" && "bg-emerald-1000/10 border-emerald-500/30 text-emerald-400",
            cardinality === "1:N" && "bg-blue-1000/10 border-blue-500/30 text-blue-400",
            cardinality === "N:1" && "bg-purple-1000/10 border-purple-500/30 text-purple-400",
            cardinality === "M:N" && "bg-amber-1000/10 border-amber-500/30 text-amber-400",
        )}>
            <Badge variant="outline" className="font-mono text-[10px] bg-white/60">
                {cardinality}
            </Badge>
            <span className="truncate">{srcSummary}</span>
            <ArrowRight className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{dstSummary}</span>
        </div>
    )
}

// ─── Endpoint entry ───────────────────────────────────────────────────────────

interface EndpointEntryProps {
    side: "source" | "destination"
    endpoint: SourceEndpoint | DestEndpoint
    /** All providers from /connectors/available filtered by category + connection. */
    availableProviders: { provider_id: string; display_name?: string; category: string; connected: boolean }[]
    providersLoading: boolean
    isPrimary: boolean
    canRemove: boolean
    onCategoryChange: (cat: ProviderCategory) => void
    onProviderChange: (provider: string) => void
    onConfigChange: (key: string, value: any) => void
    onToggleEntity: (entityValue: string) => void
    onRemove?: () => void
    /** When this is the primary endpoint, the parent passes pre-fetched
     *  schema/table lists from the dialog so we don't re-issue the same API
     *  calls (which were silently failing). Also passes the admin-saved
     *  connector config (warehouse/database) so we render those as read-only. */
    presetConnectorConfig?: { warehouse?: string; database?: string }
    presetSchemas?: WarehouseMetadataItem[]
    presetTables?: WarehouseMetadataItem[]
    configMissing?: boolean
}

function EndpointEntry({
    side,
    endpoint,
    availableProviders,
    providersLoading,
    isPrimary,
    canRemove,
    onCategoryChange,
    onProviderChange,
    onConfigChange,
    onToggleEntity,
    onRemove,
    presetConnectorConfig,
    presetSchemas,
    presetTables,
    configMissing,
}: EndpointEntryProps) {
    const filteredProviders = availableProviders
        .filter(p => p.category === endpoint.category)
        .filter(p => p.connected)

    return (
        <div className="rounded-lg border border-white/20 bg-card p-3 space-y-2.5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] gap-1">
                        {CATEGORY_ICON[endpoint.category]}
                        {CATEGORY_LABELS[endpoint.category]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {side === "source" ? "Source" : "Destination"}{isPrimary && " (primary)"}
                    </span>
                </div>
                {canRemove && onRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRemove}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                )}
            </div>

            {/* Category + Provider */}
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Category</Label>
                    <Select
                        value={endpoint.category}
                        onValueChange={v => onCategoryChange(v as ProviderCategory)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORY_OPTIONS.map(c => (
                                <SelectItem key={c.value} value={c.value} className="text-xs">
                                    {c.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Provider</Label>
                    {providersLoading ? (
                        <div className="flex items-center gap-1.5 h-8 px-2 border rounded-md text-[11px] text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                        </div>
                    ) : filteredProviders.length === 0 ? (
                        <div className="flex items-center h-8 px-2 border rounded-md text-[10px] text-muted-foreground border-dashed">
                            No connected {CATEGORY_LABELS[endpoint.category]?.toLowerCase()}
                        </div>
                    ) : (
                        <Select value={endpoint.provider} onValueChange={onProviderChange}>
                            <SelectTrigger className="h-8 text-xs">
                                {endpoint.provider ? (
                                    <span className="flex items-center gap-1.5 truncate">
                                        <ConnectorLogo provider={endpoint.provider} size="sm" />
                                        <span className="truncate">{getProviderDisplayName(endpoint.provider)}</span>
                                    </span>
                                ) : (
                                    <SelectValue placeholder="Select provider" />
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                {filteredProviders.map(p => (
                                    <SelectItem key={p.provider_id} value={p.provider_id} className="text-xs">
                                        <span className="flex items-center gap-1.5">
                                            <ConnectorLogo provider={p.provider_id} size="sm" />
                                            <span>{p.display_name || getProviderDisplayName(p.provider_id)}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Category-aware entity picker */}
            {endpoint.provider && (
                <CategoryEntityPicker
                    side={side}
                    endpoint={endpoint}
                    onConfigChange={onConfigChange}
                    onToggleEntity={onToggleEntity}
                    presetConnectorConfig={presetConnectorConfig}
                    presetSchemas={presetSchemas}
                    presetTables={presetTables}
                    configMissing={configMissing}
                />
            )}
        </div>
    )
}

// ─── Category-aware entity picker ─────────────────────────────────────────────

function CategoryEntityPicker({
    side,
    endpoint,
    onConfigChange,
    onToggleEntity,
    presetConnectorConfig,
    presetSchemas,
    presetTables,
    configMissing,
}: {
    side: "source" | "destination"
    endpoint: SourceEndpoint | DestEndpoint
    onConfigChange: (key: string, value: any) => void
    onToggleEntity: (entityValue: string) => void
    presetConnectorConfig?: { warehouse?: string; database?: string }
    presetSchemas?: WarehouseMetadataItem[]
    presetTables?: WarehouseMetadataItem[]
    configMissing?: boolean
}) {
    if (endpoint.category === "erp") {
        return <ErpEntityPicker endpoint={endpoint} onToggleEntity={onToggleEntity} />
    }
    if (endpoint.category === "warehouse") {
        return (
            <WarehouseEntityPicker
                side={side}
                endpoint={endpoint}
                onConfigChange={onConfigChange}
                onToggleEntity={onToggleEntity}
                presetConnectorConfig={presetConnectorConfig}
                presetSchemas={presetSchemas}
                presetTables={presetTables}
                configMissing={configMissing}
            />
        )
    }
    if (endpoint.category === "storage") {
        return <StorageEntityPicker endpoint={endpoint} onToggleEntity={onToggleEntity} />
    }
    return null
}

// ─── ERP picker ───────────────────────────────────────────────────────────────

function ErpEntityPicker({
    endpoint,
    onToggleEntity,
}: {
    endpoint: SourceEndpoint | DestEndpoint
    onToggleEntity: (entityValue: string) => void
}) {
    const [available, setAvailable] = useState<{ label: string; value: string }[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!endpoint.provider) return
        let cancelled = false
        setLoading(true)
        erpConnectorsAPI.discoverEntities(endpoint.provider).then(res => {
            if (cancelled) return
            const opts = (res.entities || []).map(e => ({
                label: e.label || e.entity || e.name || "",
                value: e.entity || e.value || e.name || "",
            })).filter(o => o.value)
            setAvailable(opts)
        }).catch(() => {
            if (!cancelled) setAvailable([])
        }).finally(() => {
            if (!cancelled) setLoading(false)
        })
        return () => { cancelled = true }
    }, [endpoint.provider])

    return (
        <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Entities</Label>
            {loading ? (
                <div className="flex items-center gap-1.5 h-8 px-2 border rounded-md text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading entities...
                </div>
            ) : available.length === 0 ? (
                <div className="flex items-center h-8 px-2 border rounded-md text-[10px] text-muted-foreground border-dashed">
                    No entities available
                </div>
            ) : (
                <div className="border rounded-md max-h-32 overflow-y-auto p-1 space-y-0.5">
                    {available.map(e => {
                        const selected = endpoint.entities.includes(e.value)
                        return (
                            <button
                                type="button"
                                key={e.value}
                                onClick={() => onToggleEntity(e.value)}
                                className={cn(
                                    "flex items-center gap-1.5 px-1.5 py-1 rounded text-xs hover:bg-accent/50 transition-colors w-full text-left",
                                    selected && "bg-accent",
                                )}
                            >
                                <span className={cn(
                                    "h-3 w-3 rounded-full border flex-shrink-0 flex items-center justify-center",
                                    selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                                )}>
                                    {selected && <span className="h-1 w-1 rounded-full bg-white" />}
                                </span>
                                {e.label}
                            </button>
                        )
                    })}
                </div>
            )}
            {endpoint.entities.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                    {endpoint.entities.map(e => (
                        <Badge key={e} variant="secondary" className="text-[10px] gap-0.5 pr-0.5">
                            {available.find(a => a.value === e)?.label || e}
                            <button
                                type="button"
                                onClick={() => onToggleEntity(e)}
                                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                            >
                                <span className="text-[9px]">×</span>
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Warehouse picker — Database → Schema → Tables (multi) ───────────────────

function WarehouseEntityPicker({
    side,
    endpoint,
    onConfigChange,
    onToggleEntity,
    presetConnectorConfig,
    presetSchemas,
    presetTables,
    configMissing,
}: {
    side: "source" | "destination"
    endpoint: SourceEndpoint | DestEndpoint
    onConfigChange: (key: string, value: any) => void
    onToggleEntity: (entityValue: string) => void
    presetConnectorConfig?: { warehouse?: string; database?: string }
    presetSchemas?: WarehouseMetadataItem[]
    presetTables?: WarehouseMetadataItem[]
    configMissing?: boolean
}) {
    // For PRIMARY endpoints (`presetConnectorConfig` is provided), the parent
    // dialog has already fetched databases/schemas/tables and pre-filled
    // endpoint.config from the connector's admin record. We use those instead
    // of issuing duplicate API calls (which were sometimes failing silently
    // and leaving the schema dropdown empty).
    const isPrimaryWithPreset = presetConnectorConfig !== undefined

    const [databases, setDatabases] = useState<WarehouseMetadataItem[]>([])
    const [extraSchemas, setExtraSchemas] = useState<WarehouseMetadataItem[]>([])
    const [extraTables, setExtraTables] = useState<WarehouseMetadataItem[]>([])
    const [dbLoading, setDbLoading] = useState(false)
    const [schLoading, setSchLoading] = useState(false)
    const [tblLoading, setTblLoading] = useState(false)

    // Effective lists: use parent-provided when available, otherwise fetch our own.
    const schemas = isPrimaryWithPreset ? (presetSchemas ?? []) : extraSchemas
    const tables = isPrimaryWithPreset ? (presetTables ?? []) : extraTables

    // Create-new-table input (destinations only)
    const [showNewTableInput, setShowNewTableInput] = useState(false)
    const [newTableName, setNewTableName] = useState("")

    const db = endpoint.config.database || ""
    const schema = endpoint.config.schema || ""

    // Fetch databases ourselves only for non-primary endpoints (extras don't
    // route through the dialog). For primary, the dialog auto-populates
    // endpoint.config.database from the admin connector record.
    useEffect(() => {
        if (isPrimaryWithPreset) return
        if (!endpoint.provider) return
        let cancelled = false
        setDbLoading(true)
        warehouseConnectorsAPI.listDatabases(endpoint.provider).then(items => {
            if (!cancelled) setDatabases(items)
        }).catch(() => {
            if (!cancelled) setDatabases([])
        }).finally(() => {
            if (!cancelled) setDbLoading(false)
        })
        return () => { cancelled = true }
    }, [endpoint.provider, isPrimaryWithPreset])

    useEffect(() => {
        if (isPrimaryWithPreset) return    // primary uses presetSchemas
        if (!endpoint.provider || !db) {
            setExtraSchemas([])
            return
        }
        let cancelled = false
        setSchLoading(true)
        warehouseConnectorsAPI.listSchemas(endpoint.provider, db).then(items => {
            if (!cancelled) setExtraSchemas(items)
        }).catch(() => {
            if (!cancelled) setExtraSchemas([])
        }).finally(() => {
            if (!cancelled) setSchLoading(false)
        })
        return () => { cancelled = true }
    }, [endpoint.provider, db, isPrimaryWithPreset])

    useEffect(() => {
        if (isPrimaryWithPreset) return    // primary uses presetTables
        if (!endpoint.provider || !db || !schema) {
            setExtraTables([])
            return
        }
        let cancelled = false
        setTblLoading(true)
        warehouseConnectorsAPI.listTables(endpoint.provider, db, schema).then(items => {
            if (!cancelled) setExtraTables(items)
        }).catch(() => {
            if (!cancelled) setExtraTables([])
        }).finally(() => {
            if (!cancelled) setTblLoading(false)
        })
        return () => { cancelled = true }
    }, [endpoint.provider, db, schema, isPrimaryWithPreset])

    return (
        <div className="space-y-1.5">
            {/* Admin-config indicator (primary only). Read-only chips for the
                pre-configured warehouse + database; "Change" link goes to admin. */}
            {isPrimaryWithPreset && configMissing && (
                <Alert className="border-amber-500/30 bg-amber-1000/10 py-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-400">
                        Warehouse / database not configured.{" "}
                        <a href="/admin" className="font-medium underline">Configure in Admin &gt; Connectors</a>
                    </AlertDescription>
                </Alert>
            )}
            {isPrimaryWithPreset && !configMissing && (presetConnectorConfig?.warehouse || presetConnectorConfig?.database) && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/40">
                    <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {presetConnectorConfig?.warehouse && (
                            <span className="inline-flex items-center gap-0.5">
                                <HardDrive className="h-2.5 w-2.5" />
                                {presetConnectorConfig.warehouse}
                            </span>
                        )}
                        {presetConnectorConfig?.warehouse && presetConnectorConfig?.database && (
                            <span className="text-muted-foreground/30">/</span>
                        )}
                        {presetConnectorConfig?.database && (
                            <span className="inline-flex items-center gap-0.5">
                                <Database className="h-2.5 w-2.5" />
                                {presetConnectorConfig.database}
                            </span>
                        )}
                    </div>
                    <a href="/admin" className="ml-auto text-[9px] text-primary hover:underline">
                        Change in Admin
                    </a>
                </div>
            )}

            <div className={cn("grid gap-1.5", isPrimaryWithPreset ? "grid-cols-1" : "grid-cols-2")}>
                {/* Database — only as a dropdown for non-primary endpoints. Primary
                    inherits from admin (read-only chip above). */}
                {!isPrimaryWithPreset && (
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Database</Label>
                        <Select value={db} onValueChange={v => onConfigChange("database", v)}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={dbLoading ? "Loading..." : "Database"} />
                            </SelectTrigger>
                            <SelectContent>
                                {databases.map(d => (
                                    <SelectItem key={d.name} value={d.name} className="text-xs">
                                        {d.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Schema</Label>
                    <Select value={schema} onValueChange={v => onConfigChange("schema", v)} disabled={!db}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={
                                !db ? "Pick database first" :
                                schemas.length === 0 ? "Loading schemas..." :
                                "Schema"
                            } />
                        </SelectTrigger>
                        <SelectContent>
                            {schemas.map(s => (
                                <SelectItem key={s.name} value={s.name} className="text-xs">
                                    {s.name}
                                </SelectItem>
                            ))}
                            {schemas.length === 0 && (
                                <div className="px-2 py-1 text-[10px] text-muted-foreground italic">
                                    No schemas returned. Check the connector's permissions in Admin.
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                    Tables {side === "destination" ? "(pick existing or create new)" : "(multi-select)"}
                </Label>
                {tblLoading ? (
                    <div className="flex items-center gap-1.5 h-8 px-2 border rounded-md text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading tables...
                    </div>
                ) : (
                    <div className="border rounded-md max-h-32 overflow-y-auto p-1 space-y-0.5">
                        {tables.length === 0 && !showNewTableInput && (
                            <div className="px-2 py-1 text-[10px] text-muted-foreground italic">
                                {db && schema ? "No existing tables — create one below." : "Pick database + schema first."}
                            </div>
                        )}
                        {tables.map(t => {
                            const selected = endpoint.entities.includes(t.name)
                            return (
                                <button
                                    type="button"
                                    key={t.name}
                                    onClick={() => onToggleEntity(t.name)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-1.5 py-1 rounded text-xs hover:bg-accent/50 transition-colors w-full text-left font-mono",
                                        selected && "bg-accent",
                                    )}
                                >
                                    <span className={cn(
                                        "h-3 w-3 rounded-full border flex-shrink-0 flex items-center justify-center",
                                        selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                                    )}>
                                        {selected && <span className="h-1 w-1 rounded-full bg-white" />}
                                    </span>
                                    {t.name}
                                </button>
                            )
                        })}

                        {/* Create-new-table — destination only */}
                        {side === "destination" && db && schema && (
                            showNewTableInput ? (
                                <div className="flex items-center gap-1 px-1.5 py-1 border-t border-border/40 mt-1 pt-1.5">
                                    <input
                                        type="text"
                                        value={newTableName}
                                        onChange={e => setNewTableName(e.target.value.toUpperCase())}
                                        placeholder="NEW_TABLE_NAME"
                                        className="flex-1 h-6 px-1.5 text-[11px] font-mono bg-background border border-border/60 rounded outline-none focus:border-primary"
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === "Enter" && newTableName.trim()) {
                                                onToggleEntity(newTableName.trim())
                                                setNewTableName("")
                                                setShowNewTableInput(false)
                                            }
                                            if (e.key === "Escape") {
                                                setNewTableName("")
                                                setShowNewTableInput(false)
                                            }
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            if (newTableName.trim()) {
                                                onToggleEntity(newTableName.trim())
                                                setNewTableName("")
                                                setShowNewTableInput(false)
                                            }
                                        }}
                                        className="h-6 px-2 text-[10px]"
                                        disabled={!newTableName.trim()}
                                    >
                                        Add
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewTableName("")
                                            setShowNewTableInput(false)
                                        }}
                                        className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowNewTableInput(true)}
                                    className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs text-primary hover:bg-primary/5 transition-colors w-full text-left border-t border-border/40 mt-1 pt-1.5"
                                >
                                    <Plus className="h-3 w-3" />
                                    <span className="font-mono">Create new table…</span>
                                </button>
                            )
                        )}
                    </div>
                )}

                {/* Pills for created-but-not-yet-listed tables */}
                {endpoint.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                        {endpoint.entities.map(e => {
                            const isExisting = tables.some(t => t.name === e)
                            return (
                                <Badge
                                    key={e}
                                    variant={isExisting ? "secondary" : "default"}
                                    className="text-[10px] gap-0.5 pr-0.5 font-mono"
                                    title={isExisting ? "existing table" : "will be created on first run"}
                                >
                                    {!isExisting && <span className="text-[8px] mr-0.5">+NEW</span>}
                                    {e}
                                    <button
                                        type="button"
                                        onClick={() => onToggleEntity(e)}
                                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                    >
                                        <span className="text-[9px]">×</span>
                                    </button>
                                </Badge>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Storage picker — file picker ─────────────────────────────────────────────

function StorageEntityPicker({
    endpoint,
    onToggleEntity,
}: {
    endpoint: SourceEndpoint | DestEndpoint
    onToggleEntity: (entityValue: string) => void
}) {
    const [files, setFiles] = useState<StorageFile[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!endpoint.provider) return
        let cancelled = false
        setLoading(true)
        storageConnectorsAPI.listFiles(endpoint.provider).then(res => {
            if (!cancelled) setFiles(res.files || [])
        }).catch(() => {
            if (!cancelled) setFiles([])
        }).finally(() => {
            if (!cancelled) setLoading(false)
        })
        return () => { cancelled = true }
    }, [endpoint.provider])

    return (
        <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">File</Label>
            {loading ? (
                <div className="flex items-center gap-1.5 h-8 px-2 border rounded-md text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading files...
                </div>
            ) : files.length === 0 ? (
                <div className="flex items-center h-8 px-2 border rounded-md text-[10px] text-muted-foreground border-dashed">
                    No files found
                </div>
            ) : (
                <div className="border rounded-md max-h-28 overflow-y-auto p-1 space-y-0.5">
                    {files.map(f => {
                        const selected = endpoint.entities.includes(f.id)
                        return (
                            <button
                                type="button"
                                key={f.id}
                                onClick={() => onToggleEntity(f.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-1.5 py-1 rounded text-xs hover:bg-accent/50 transition-colors w-full text-left",
                                    selected && "bg-accent",
                                )}
                            >
                                <span className={cn(
                                    "h-3 w-3 rounded-full border flex-shrink-0 flex items-center justify-center",
                                    selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                                )}>
                                    {selected && <span className="h-1 w-1 rounded-full bg-white" />}
                                </span>
                                <span className="truncate">{f.name}</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export interface EndpointsStepProps {
    pipeline: PipelineState
    onNext: () => void
    /** Optional content rendered BELOW the source/destination panels but ABOVE
     *  the footer Next button. Used to combine name / frequency / responsible-
     *  person fields into the same wizard step (per UX feedback). */
    additionalContent?: React.ReactNode
    /** When `additionalContent` provides extra validation, the stepper passes
     *  the resolved canProceed flag here so the Next button respects it. */
    extraCanProceed?: boolean
}

export function EndpointsStep({ pipeline, onNext, additionalContent, extraCanProceed = true }: EndpointsStepProps) {
    const { dialog, sources, destinations, cardinality } = pipeline

    // Build a flat available-providers list for the entry-row dropdowns.
    const availableProviders = (dialog.allProviders || []).map(p => ({
        provider_id: p.provider_id,
        display_name: p.display_name,
        category: p.category,
        connected: dialog.connectedProviderIds.has(p.provider_id),
    }))

    // M:N is supported. Mapping is manual per (src, dst) pair so cartesian
    // product is tractable. The "+ Add" buttons are always available.

    const canProceed = pipeline.pipelineSteps.length > 0

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Cardinality banner */}
                <CardinalityBanner cardinality={cardinality} sources={sources} destinations={destinations} />

                {/* Side-by-side panels */}
                <div className="grid grid-cols-2 gap-4">
                    {/* SOURCE panel */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Source{sources.length > 1 ? "s" : ""}</Label>
                            <span className="text-[10px] text-muted-foreground">{sources.length} configured</span>
                        </div>
                        <div className="space-y-2">
                            {sources.map((s, i) => {
                                const isPrimary = i === 0
                                return (
                                    <EndpointEntry
                                        key={s.endpoint_id}
                                        side="source"
                                        endpoint={s}
                                        availableProviders={availableProviders}
                                        providersLoading={dialog.providersLoading}
                                        isPrimary={isPrimary}
                                        canRemove={i > 0}
                                        onCategoryChange={cat => pipeline.updateSource(s.endpoint_id, { category: cat })}
                                        onProviderChange={p => pipeline.updateSource(s.endpoint_id, { provider: p })}
                                        onConfigChange={(k, v) => pipeline.updateSource(s.endpoint_id, { config: { ...s.config, [k]: v } })}
                                        onToggleEntity={(e) => pipeline.toggleSourceEntity(s.endpoint_id, e)}
                                        onRemove={() => pipeline.removeSource(s.endpoint_id)}
                                        // Wire admin connector config + dialog's pre-fetched lists for primary only
                                        {...(isPrimary && s.category === "warehouse" ? {
                                            presetConnectorConfig: dialog.sourceConnectorConfig,
                                            presetSchemas: dialog.schemaList,
                                            presetTables: undefined,
                                            configMissing: dialog.sourceConfigMissing,
                                        } : {})}
                                    />
                                )
                            })}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={pipeline.addSource}
                                className="w-full h-8 text-xs gap-1.5 border-dashed"
                            >
                                <Plus className="h-3 w-3" /> Add source
                            </Button>
                        </div>
                    </div>

                    {/* DESTINATION panel */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Destination{destinations.length > 1 ? "s" : ""}</Label>
                            <span className="text-[10px] text-muted-foreground">{destinations.length} configured</span>
                        </div>
                        <div className="space-y-2">
                            {destinations.map((d, i) => {
                                const isPrimary = i === 0
                                return (
                                    <EndpointEntry
                                        key={d.endpoint_id}
                                        side="destination"
                                        endpoint={d}
                                        availableProviders={availableProviders}
                                        providersLoading={dialog.providersLoading}
                                        isPrimary={isPrimary}
                                        canRemove={i > 0}
                                        onCategoryChange={cat => pipeline.updateDestination(d.endpoint_id, { category: cat })}
                                        onProviderChange={p => pipeline.updateDestination(d.endpoint_id, { provider: p })}
                                        onConfigChange={(k, v) => pipeline.updateDestination(d.endpoint_id, { config: { ...d.config, [k]: v } })}
                                        onToggleEntity={(e) => pipeline.toggleDestinationEntity(d.endpoint_id, e)}
                                        onRemove={() => pipeline.removeDestination(d.endpoint_id)}
                                        // Wire admin connector config + dialog's pre-fetched lists for primary only
                                        {...(isPrimary && d.category === "warehouse" ? {
                                            presetConnectorConfig: dialog.destConnectorConfig,
                                            presetSchemas: dialog.destSchemaList,
                                            presetTables: dialog.destTableList,
                                            configMissing: dialog.destConfigMissing,
                                        } : {})}
                                    />
                                )
                            })}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={pipeline.addDestination}
                                className="w-full h-8 text-xs gap-1.5 border-dashed"
                            >
                                <Plus className="h-3 w-3" /> Add destination
                            </Button>
                        </div>
                    </div>
                </div>

                {/* No pairs — surface a hint */}
                {pipeline.pipelineSteps.length === 0 && (
                    <Alert className="border-amber-500/30 bg-amber-1000/10">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <AlertDescription className="text-xs text-amber-400">
                            Pick at least one source provider + entity AND one destination provider + entity to continue.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Inline job basics (name / frequency / responsible person) */}
                {additionalContent}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/15 flex justify-end">
                <Button onClick={onNext} disabled={!canProceed || !extraCanProceed}>Next →</Button>
            </div>
        </div>
    )
}
