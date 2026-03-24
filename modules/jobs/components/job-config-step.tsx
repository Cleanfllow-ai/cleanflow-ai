"use client"

import { Loader2, Sparkles, Zap, X, Edit2 } from "lucide-react"
import { ColumnMappingEditor } from "./column-mapping-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { cn } from "@/shared/lib/utils"
import type { JobFrequency } from "@/modules/jobs/types/jobs.types"
import type { useJobDialog, ProviderCategory } from "./use-job-dialog"
import { FREQUENCY_OPTIONS, getProviderDisplayName, CATEGORY_LABELS } from "./job-dialog-constants"

// ─── Category options ─────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { label: string; value: ProviderCategory }[] = [
    { label: "ERP Systems", value: "erp" },
    { label: "Data Warehouses", value: "warehouse" },
    { label: "Cloud Storage", value: "storage" },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface JobConfigStepProps {
    d: ReturnType<typeof useJobDialog>
    onNext: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JobConfigStep({ d, onNext }: JobConfigStepProps) {
    const canProceed =
        d.name.trim() !== "" &&
        d.sourceProvider !== "" &&
        d.destinationProvider !== "" &&
        d.entities.length > 0 &&
        (d.frequency !== "cron" || d.cronExpression.trim() !== "")

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-5 max-w-2xl mx-auto">
                    {/* ── Job Name ─────────────────────────────────────────── */}
                    <div className="space-y-2">
                        <Label htmlFor="job-name" className="text-sm font-medium">
                            Job Name
                        </Label>
                        <Input
                            id="job-name"
                            placeholder="e.g. Invoice Sync QB to Snowflake"
                            value={d.name}
                            onChange={(e) => d.setName(e.target.value)}
                            className="h-10"
                        />
                    </div>

                    {/* ── Source ───────────────────────────────────────────── */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Source</Label>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Source category */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Category</Label>
                                <Select
                                    value={d.sourceCategory}
                                    onValueChange={(v) => d.setSourceCategory(v as ProviderCategory)}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_OPTIONS.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Source provider */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Provider</Label>
                                {d.providersLoading ? (
                                    <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-muted-foreground text-sm">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                                    </div>
                                ) : d.sourceProviders.length === 0 ? (
                                    <div className="flex items-center h-9 px-3 border rounded-md text-muted-foreground text-xs border-dashed">
                                        No connected {CATEGORY_LABELS[d.sourceCategory]?.toLowerCase() || "providers"}
                                    </div>
                                ) : (
                                    <Select
                                        value={d.sourceProvider}
                                        onValueChange={d.setSourceProvider}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {d.sourceProviders.map(p => (
                                                <SelectItem key={p.provider_id} value={p.provider_id}>
                                                    {p.display_name || getProviderDisplayName(p.provider_id)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* Warehouse source config (cascading: warehouse, database, schema) */}
                        {d.sourceCategory === "warehouse" && d.sourceProvider && (
                            <div className="grid grid-cols-3 gap-2">
                                {d.warehouseList.length > 0 && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Warehouse</Label>
                                        <Select
                                            value={d.sourceConfig.warehouse || ""}
                                            onValueChange={(v) => d.updateSourceConfig("warehouse", v)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Warehouse" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {d.warehouseList.map(wh => (
                                                    <SelectItem key={wh.name} value={wh.name} className="text-xs">
                                                        {wh.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Database</Label>
                                    <Select
                                        value={d.sourceConfig.database || ""}
                                        onValueChange={(v) => d.updateSourceConfig("database", v)}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Database" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {d.databaseList.map(db => (
                                                <SelectItem key={db.name} value={db.name} className="text-xs">
                                                    {db.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Schema</Label>
                                    <Select
                                        value={d.sourceConfig.schema || ""}
                                        onValueChange={(v) => d.updateSourceConfig("schema", v)}
                                        disabled={!d.sourceConfig.database}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder={d.sourceConfig.database ? "Schema" : "Select DB"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {d.schemaList.map(s => (
                                                <SelectItem key={s.name} value={s.name} className="text-xs">
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* Entity selection */}
                        {d.sourceProvider && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        {d.sourceCategory === "warehouse" ? "Tables" : "Entities"}
                                    </Label>
                                    {d.availableEntities.length > 0 && d.entities.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={d.clearAllEntities}
                                            className="text-[10px] text-muted-foreground hover:underline"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {d.entitiesLoading ? (
                                    <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-muted-foreground text-sm">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Discovering entities...
                                    </div>
                                ) : d.availableEntities.length === 0 ? (
                                    <div className="flex items-center h-9 px-3 border rounded-md text-muted-foreground text-xs border-dashed">
                                        {d.sourceCategory === "warehouse" && !d.sourceConfig.schema
                                            ? "Select database and schema first"
                                            : "No entities found"}
                                    </div>
                                ) : (
                                    <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                                        {d.availableEntities.map(entity => {
                                            const isSelected = d.entities.includes(entity.value)
                                            return (
                                                <button
                                                    type="button"
                                                    key={entity.value}
                                                    onClick={() => d.selectEntity(entity.value)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm hover:bg-accent/50 transition-colors w-full text-left",
                                                        isSelected && "bg-accent"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "h-3.5 w-3.5 rounded-full border flex-shrink-0 flex items-center justify-center",
                                                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                                                    )}>
                                                        {isSelected && (
                                                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                                        )}
                                                    </span>
                                                    <span className="text-sm">{entity.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {d.entities.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {d.entities.map(e => {
                                            const label = d.availableEntities.find(a => a.value === e)?.label || e
                                            return (
                                                <Badge
                                                    key={e}
                                                    variant="secondary"
                                                    className="text-xs gap-1 pr-1"
                                                >
                                                    {label}
                                                    <button
                                                        type="button"
                                                        onClick={() => d.selectEntity(e)}
                                                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                                    >
                                                        <X className="h-2.5 w-2.5" />
                                                    </button>
                                                </Badge>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Destination ──────────────────────────────────────── */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Destination</Label>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Destination category */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Category</Label>
                                <Select
                                    value={d.destinationCategory}
                                    onValueChange={(v) => d.setDestinationCategory(v as ProviderCategory)}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_OPTIONS.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Destination provider */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Provider</Label>
                                {d.providersLoading ? (
                                    <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-muted-foreground text-sm">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                                    </div>
                                ) : d.destinationProviders.length === 0 ? (
                                    <div className="flex items-center h-9 px-3 border rounded-md text-muted-foreground text-xs border-dashed">
                                        No connected {CATEGORY_LABELS[d.destinationCategory]?.toLowerCase() || "providers"}
                                    </div>
                                ) : (
                                    <Select
                                        value={d.destinationProvider}
                                        onValueChange={d.setDestinationProvider}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {d.destinationProviders.map(p => (
                                                <SelectItem key={p.provider_id} value={p.provider_id}>
                                                    {p.display_name || getProviderDisplayName(p.provider_id)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Frequency ────────────────────────────────────────── */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Frequency</Label>
                        <Select
                            value={d.frequency}
                            onValueChange={(v) => d.setFrequency(v as JobFrequency)}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {FREQUENCY_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {d.frequency === "cron" && (
                        <Input
                            placeholder="e.g. 0 */2 * * *"
                            value={d.cronExpression}
                            onChange={(e) => d.setCronExpression(e.target.value)}
                            className="h-9 font-mono text-sm"
                        />
                    )}

                    {d.frequency === "batch" && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                            <Zap className="h-4 w-4 flex-shrink-0" />
                            <p className="text-xs">
                                One-time transfer. Data will be transferred immediately after creation.
                            </p>
                        </div>
                    )}

                    {/* ── Column Mapping ───────────────────────────────────── */}
                    {d.sourceProvider && d.destinationProvider && d.entities.length > 0 && (
                        <div className="space-y-2">
                            {d.showMappingEditor ? (
                                <ColumnMappingEditor
                                    sourceFields={d.cachedSourceFields}
                                    destFields={d.cachedDestFields}
                                    mapping={d.columnMapping}
                                    onMappingChange={d.setColumnMapping}
                                    onClose={() => d.setShowMappingEditor(false)}
                                    onAutoMap={d.handleAutoMap}
                                    autoMapLoading={d.mappingLoading}
                                    sourceLabel={getProviderDisplayName(d.sourceProvider)}
                                    destLabel={getProviderDisplayName(d.destinationProvider)}
                                />
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">Column Mapping</Label>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={d.handleAutoMap}
                                                disabled={d.mappingLoading}
                                                className="h-7 text-xs gap-1.5"
                                            >
                                                {d.mappingLoading ? (
                                                    <><Loader2 className="h-3 w-3 animate-spin" /> Mapping...</>
                                                ) : (
                                                    <><Sparkles className="h-3 w-3" /> Auto-map</>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={d.handleOpenMappingEditor}
                                                className="h-7 text-xs gap-1.5"
                                            >
                                                <Edit2 className="h-3 w-3" /> Manual Map
                                            </Button>
                                        </div>
                                    </div>

                                    {Object.keys(d.columnMapping).length > 0 ? (
                                        <div className="border rounded-md p-3 space-y-1.5">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-muted-foreground">
                                                    {Object.keys(d.columnMapping).length} columns mapped
                                                    {d.autoMapMethod && (
                                                        <Badge variant="outline" className="ml-2 text-[9px]">
                                                            {d.autoMapMethod}
                                                        </Badge>
                                                    )}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={d.handleOpenMappingEditor}
                                                        className="text-[10px] text-primary hover:underline"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { d.setColumnMapping({}) }}
                                                        className="text-[10px] text-muted-foreground hover:text-destructive"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="max-h-24 overflow-y-auto space-y-0.5">
                                                {Object.entries(d.columnMapping).map(([src, dst]) => (
                                                    <div key={src} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span className="font-mono truncate max-w-[40%]">{src}</span>
                                                        <span className="text-[10px]">&rarr;</span>
                                                        <span className="font-mono truncate max-w-[40%]">{dst}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Click Auto-map for automatic CDF mapping, or Manual Map to configure fields individually.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Responsible Person ───────────────────────────────── */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Responsible Person</Label>
                        {d.orgMembersLoading ? (
                            <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-muted-foreground text-sm">
                                <Loader2 className="h-3 w-3 animate-spin" /> Loading members...
                            </div>
                        ) : d.orgMembers.length === 0 ? (
                            <div className="flex items-center h-9 px-3 border rounded-md text-muted-foreground text-xs border-dashed">
                                No organization members found
                            </div>
                        ) : (
                            <Select value={d.responsibleUserId} onValueChange={d.setResponsibleUserId}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select responsible person" />
                                </SelectTrigger>
                                <SelectContent>
                                    {d.orgMembers.map(m => (
                                        <SelectItem key={m.user_id} value={m.user_id}>
                                            {m.email || m.user_id}
                                            <span className="text-xs text-muted-foreground ml-1">({m.role})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50 flex justify-end">
                <Button
                    onClick={onNext}
                    disabled={!canProceed}
                >
                    Next &rarr;
                </Button>
            </div>
        </div>
    )
}
