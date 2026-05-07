"use client"

/**
 * EndpointsStep — wizard step 1.
 *
 * Side-by-side panels: Source (left), Destination (right). Each panel renders
 * a vertical stack of `EndpointEntry` rows with a "+ Add" footer.
 *
 * **M:N block:** when destinations.length > 1, the "+ Add source" button is
 * hidden, and vice versa. The hook also rejects M:N at the derive level — but
 * the UI guard prevents users from ever reaching that error path.
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
            cardinality === "1:1" && "bg-emerald-50 border-emerald-200 text-emerald-800",
            cardinality === "1:N" && "bg-blue-50 border-blue-200 text-blue-800",
            cardinality === "N:1" && "bg-purple-50 border-purple-200 text-purple-800",
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
}: EndpointEntryProps) {
    const filteredProviders = availableProviders
        .filter(p => p.category === endpoint.category)
        .filter(p => p.connected)

    return (
        <div className="rounded-lg border bg-card p-3 space-y-2.5">
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
}: {
    side: "source" | "destination"
    endpoint: SourceEndpoint | DestEndpoint
    onConfigChange: (key: string, value: any) => void
    onToggleEntity: (entityValue: string) => void
}) {
    if (endpoint.category === "erp") {
        return <ErpEntityPicker endpoint={endpoint} onToggleEntity={onToggleEntity} />
    }
    if (endpoint.category === "warehouse") {
        return (
            <WarehouseEntityPicker
                endpoint={endpoint}
                onConfigChange={onConfigChange}
                onToggleEntity={onToggleEntity}
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
    endpoint,
    onConfigChange,
    onToggleEntity,
}: {
    endpoint: SourceEndpoint | DestEndpoint
    onConfigChange: (key: string, value: any) => void
    onToggleEntity: (entityValue: string) => void
}) {
    const [databases, setDatabases] = useState<WarehouseMetadataItem[]>([])
    const [schemas, setSchemas] = useState<WarehouseMetadataItem[]>([])
    const [tables, setTables] = useState<WarehouseMetadataItem[]>([])
    const [dbLoading, setDbLoading] = useState(false)
    const [schLoading, setSchLoading] = useState(false)
    const [tblLoading, setTblLoading] = useState(false)

    const db = endpoint.config.database || ""
    const schema = endpoint.config.schema || ""

    useEffect(() => {
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
    }, [endpoint.provider])

    useEffect(() => {
        if (!endpoint.provider || !db) {
            setSchemas([])
            return
        }
        let cancelled = false
        setSchLoading(true)
        warehouseConnectorsAPI.listSchemas(endpoint.provider, db).then(items => {
            if (!cancelled) setSchemas(items)
        }).catch(() => {
            if (!cancelled) setSchemas([])
        }).finally(() => {
            if (!cancelled) setSchLoading(false)
        })
        return () => { cancelled = true }
    }, [endpoint.provider, db])

    useEffect(() => {
        if (!endpoint.provider || !db || !schema) {
            setTables([])
            return
        }
        let cancelled = false
        setTblLoading(true)
        warehouseConnectorsAPI.listTables(endpoint.provider, db, schema).then(items => {
            if (!cancelled) setTables(items)
        }).catch(() => {
            if (!cancelled) setTables([])
        }).finally(() => {
            if (!cancelled) setTblLoading(false)
        })
        return () => { cancelled = true }
    }, [endpoint.provider, db, schema])

    return (
        <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
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
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Schema</Label>
                    <Select value={schema} onValueChange={v => onConfigChange("schema", v)} disabled={!db}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={schLoading ? "Loading..." : "Schema"} />
                        </SelectTrigger>
                        <SelectContent>
                            {schemas.map(s => (
                                <SelectItem key={s.name} value={s.name} className="text-xs">
                                    {s.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Tables (multi-select)</Label>
                {tblLoading ? (
                    <div className="flex items-center gap-1.5 h-8 px-2 border rounded-md text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading tables...
                    </div>
                ) : tables.length === 0 ? (
                    <div className="flex items-center h-8 px-2 border rounded-md text-[10px] text-muted-foreground border-dashed">
                        {db && schema ? "No tables found" : "Pick database + schema first"}
                    </div>
                ) : (
                    <div className="border rounded-md max-h-28 overflow-y-auto p-1 space-y-0.5">
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
}

export function EndpointsStep({ pipeline, onNext }: EndpointsStepProps) {
    const { dialog, sources, destinations, cardinality } = pipeline

    // Build a flat available-providers list for the entry-row dropdowns.
    const availableProviders = (dialog.allProviders || []).map(p => ({
        provider_id: p.provider_id,
        display_name: p.display_name,
        category: p.category,
        connected: dialog.connectedProviderIds.has(p.provider_id),
    }))

    // M:N guards — only one side can have multiple endpoints at a time.
    // When destinations.length > 1, the "+ Add source" button is hidden.
    // When sources.length > 1, the "+ Add destination" button is hidden.
    const canAddSource = destinations.length === 1
    const canAddDestination = sources.length === 1

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
                            {sources.map((s, i) => (
                                <EndpointEntry
                                    key={s.endpoint_id}
                                    side="source"
                                    endpoint={s}
                                    availableProviders={availableProviders}
                                    providersLoading={dialog.providersLoading}
                                    isPrimary={i === 0}
                                    canRemove={i > 0}
                                    onCategoryChange={cat => pipeline.updateSource(s.endpoint_id, { category: cat })}
                                    onProviderChange={p => pipeline.updateSource(s.endpoint_id, { provider: p })}
                                    onConfigChange={(k, v) => pipeline.updateSource(s.endpoint_id, { config: { ...s.config, [k]: v } })}
                                    onToggleEntity={(e) => pipeline.toggleSourceEntity(s.endpoint_id, e)}
                                    onRemove={() => pipeline.removeSource(s.endpoint_id)}
                                />
                            ))}
                            {canAddSource && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={pipeline.addSource}
                                    className="w-full h-8 text-xs gap-1.5 border-dashed"
                                >
                                    <Plus className="h-3 w-3" /> Add source
                                </Button>
                            )}
                            {!canAddSource && (
                                <p className="text-[10px] text-muted-foreground text-center py-1">
                                    Cannot add another source while multiple destinations exist (M:N is not supported).
                                </p>
                            )}
                        </div>
                    </div>

                    {/* DESTINATION panel */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Destination{destinations.length > 1 ? "s" : ""}</Label>
                            <span className="text-[10px] text-muted-foreground">{destinations.length} configured</span>
                        </div>
                        <div className="space-y-2">
                            {destinations.map((d, i) => (
                                <EndpointEntry
                                    key={d.endpoint_id}
                                    side="destination"
                                    endpoint={d}
                                    availableProviders={availableProviders}
                                    providersLoading={dialog.providersLoading}
                                    isPrimary={i === 0}
                                    canRemove={i > 0}
                                    onCategoryChange={cat => pipeline.updateDestination(d.endpoint_id, { category: cat })}
                                    onProviderChange={p => pipeline.updateDestination(d.endpoint_id, { provider: p })}
                                    onConfigChange={(k, v) => pipeline.updateDestination(d.endpoint_id, { config: { ...d.config, [k]: v } })}
                                    onToggleEntity={(e) => pipeline.toggleDestinationEntity(d.endpoint_id, e)}
                                    onRemove={() => pipeline.removeDestination(d.endpoint_id)}
                                />
                            ))}
                            {canAddDestination && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={pipeline.addDestination}
                                    className="w-full h-8 text-xs gap-1.5 border-dashed"
                                >
                                    <Plus className="h-3 w-3" /> Add destination
                                </Button>
                            )}
                            {!canAddDestination && (
                                <p className="text-[10px] text-muted-foreground text-center py-1">
                                    Cannot add another destination while multiple sources exist (M:N is not supported).
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* No pairs — surface a hint */}
                {pipeline.pipelineSteps.length === 0 && (
                    <Alert className="border-amber-200 bg-amber-50">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <AlertDescription className="text-xs text-amber-900">
                            Pick at least one source provider + entity AND one destination provider + entity to continue.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50 flex justify-end">
                <Button onClick={onNext} disabled={!canProceed}>Next →</Button>
            </div>
        </div>
    )
}
