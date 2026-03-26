"use client"

import { Loader2, Sparkles, Zap, Check, X, Edit2, Settings2, HardDrive, Database, AlertCircle } from "lucide-react"
import { ColumnMappingEditor } from "./column-mapping-editor"
import { DQConfigPanel } from "./dq-config-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { cn } from "@/shared/lib/utils"
import type { Job, JobFrequency } from "@/modules/jobs/types/jobs.types"

import { useJobDialog, type ProviderCategory } from "./use-job-dialog"
import { FREQUENCY_OPTIONS, getProviderDisplayName, CATEGORY_LABELS } from "./job-dialog-constants"

// ─── Props ────────────────────────────────────────────────────────────────────

interface JobDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    job?: Job | null
    onSuccess: () => void
    onCancel: () => void
}

// ─── Category options ─────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { label: string; value: ProviderCategory }[] = [
    { label: "ERP Systems", value: "erp" },
    { label: "Data Warehouses", value: "warehouse" },
    { label: "Cloud Storage", value: "storage" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function JobDialog({ open, onOpenChange, job, onSuccess, onCancel }: JobDialogProps) {
    const d = useJobDialog({ open, job, onSuccess })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-lg">
                        {d.isEdit ? "Edit Job" : "Create Job"}
                    </DialogTitle>
                    <DialogDescription>
                        {d.isEdit
                            ? "Update job configuration"
                            : "Set up a new automated data sync job"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-1">
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

                        {/* Warehouse source config — warehouse/database from admin, only schema selectable */}
                        {d.sourceCategory === "warehouse" && d.sourceProvider && (
                            <>
                                {d.sourceConfigMissing ? (
                                    <Alert className="border-amber-200 bg-amber-50 py-2">
                                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                        <AlertDescription className="text-xs text-amber-900">
                                            Warehouse/database not configured.{" "}
                                            <a href="/admin" className="font-medium underline">Configure in Admin &gt; Connectors</a>
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Admin config indicator */}
                                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/40">
                                            <Settings2 className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                {d.sourceConnectorConfig.warehouse && (
                                                    <span className="inline-flex items-center gap-0.5">
                                                        <HardDrive className="h-2.5 w-2.5" />
                                                        {d.sourceConnectorConfig.warehouse}
                                                    </span>
                                                )}
                                                {d.sourceConnectorConfig.warehouse && d.sourceConnectorConfig.database && (
                                                    <span className="text-muted-foreground/30">/</span>
                                                )}
                                                {d.sourceConnectorConfig.database && (
                                                    <span className="inline-flex items-center gap-0.5">
                                                        <Database className="h-2.5 w-2.5" />
                                                        {d.sourceConnectorConfig.database}
                                                    </span>
                                                )}
                                            </div>
                                            <a href="/admin" className="ml-auto text-[9px] text-primary hover:underline">
                                                Change
                                            </a>
                                        </div>

                                        {/* Schema selector */}
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Schema</Label>
                                            <Select
                                                value={d.sourceConfig.schema || ""}
                                                onValueChange={(v) => d.updateSourceConfig("schema", v)}
                                                disabled={!d.sourceConfig.database}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder={d.sourceConfig.database ? "Schema" : "Loading..."} />
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
                            </>
                        )}

                        {/* Entity multi-select */}
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
                                                        onClick={() => { d.setColumnMapping({}); }}
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
                                                        <span className="text-[10px]">→</span>
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

                    {/* ── DQ Config Panel ─────────────────────────────────── */}
                    <DQConfigPanel
                        dqPolicy={d.dqPolicy}
                        onPolicyChange={d.setDqPolicy}
                        presetId={d.presetId}
                        onPresetChange={d.setPresetId}
                        responsibleUserId={d.responsibleUserId}
                        onResponsibleUserChange={d.setResponsibleUserId}
                        rulesEnabled={d.rulesEnabled}
                        onRulesChange={d.setRulesEnabled}
                        allowAutofix={d.allowAutofix}
                        onAutofixChange={d.setAllowAutofix}
                        presets={d.presets}
                        presetsLoading={d.presetsLoading}
                        orgMembers={d.orgMembers}
                        orgMembersLoading={d.orgMembersLoading}
                    />
                </div>

                {/* ── Footer ──────────────────────────────────────────── */}
                <DialogFooter className="gap-2 pt-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        onClick={d.handleSubmit}
                        disabled={d.saving || !d.name.trim() || !d.sourceProvider || !d.destinationProvider || d.entities.length === 0}
                    >
                        {d.saving ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            d.isEdit ? "Update Job" : "Create Job"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
