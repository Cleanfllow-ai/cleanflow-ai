"use client"

/**
 * JobConfigStep — wizard step 3 (now AFTER mapping).
 *
 * Source / destination / entities / mapping are NOT rendered here — those
 * belong to the EndpointsStep and MappingStep respectively. This step only
 * owns:
 *   - Job name
 *   - Frequency / cron
 *   - Authorized person (responsible_user_id)
 *
 * The Advanced DQ toggle is owned by `MappingStep` now (per UX feedback —
 * users opt-in to a deeper DQ step right after they finish mapping). The
 * stepper drives the conditional `dq` step from that flag.
 */

import { Loader2, Zap, X, Settings2, HardDrive, Database, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/shared/lib/utils"
import type { JobFrequency } from "@/modules/jobs/types/jobs.types"
import type { useJobDialog, ProviderCategory } from "./use-job-dialog"
import { FREQUENCY_OPTIONS, getProviderDisplayName, CATEGORY_LABELS } from "./job-dialog-constants"
import { ConnectorLogo } from "@/modules/connectors/components/connector-logo"
import { CronBuilder, parseCron } from "./cron-builder"

// ─── Category options ─────────────────────────────────────────────────────────
// Kept here only to keep the dead-code block (`<div className="hidden">…</div>`)
// below from referencing an undefined identifier. Will be deleted alongside the
// dead block in a follow-up cleanup pass.

const CATEGORY_OPTIONS: { label: string; value: ProviderCategory }[] = [
    { label: "Applications", value: "erp" },
    { label: "Data Warehouses", value: "warehouse" },
    { label: "Cloud Storage", value: "storage" },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface JobConfigStepProps {
    d: ReturnType<typeof useJobDialog>
    onNext: () => void
    isCreating?: boolean
    /** Hint to the footer button label — when true, says "Configure DQ →" instead of "Create job". */
    advancedDQ?: boolean
    /** When true, render only the form fields (no scroll container, no footer).
     *  Used to inline this step's fields into the EndpointsStep. */
    embedded?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JobConfigStep({ d, onNext, isCreating, advancedDQ, embedded }: JobConfigStepProps) {
    const cronValid = d.frequency !== "cron" || (
        d.cronExpression.trim() !== "" && !parseCron(d.cronExpression).error
    )
    const canProceed = d.name.trim() !== "" && cronValid

    if (embedded) {
        // Inline mode: no flex/overflow chrome, no footer. Caller (EndpointsStep)
        // owns the surrounding scroll container + Next button.
        return (
            <EmbeddedJobBasics d={d} />
        )
    }

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

                    {/* Source / destination / entities / mapping are owned by the
                        EndpointsStep + MappingStep — DO NOT duplicate them here.
                        This step is purely Name + Schedule + Authorized Person. */}
                    <div className="hidden">
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
                                            {d.sourceProvider ? (
                                                <span className="flex items-center gap-2 truncate">
                                                    <ConnectorLogo provider={d.sourceProvider} size="sm" />
                                                    <span className="truncate">
                                                        {d.sourceProviders.find(p => p.provider_id === d.sourceProvider)?.display_name
                                                            || getProviderDisplayName(d.sourceProvider)}
                                                    </span>
                                                </span>
                                            ) : (
                                                <SelectValue placeholder="Select provider" />
                                            )}
                                        </SelectTrigger>
                                        <SelectContent>
                                            {d.sourceProviders.map(p => (
                                                <SelectItem key={p.provider_id} value={p.provider_id}>
                                                    <span className="flex items-center gap-2">
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

                        {/* Warehouse source config — warehouse/database from admin, only schema selectable */}
                        {d.sourceCategory === "warehouse" && d.sourceProvider && (
                            <>
                                {d.sourceConfigMissing ? (
                                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 py-2">
                                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                        <AlertDescription className="text-xs text-amber-400">
                                            Warehouse/database not configured.{" "}
                                            <a href="/admin" className="font-medium underline">Configure in Admin &gt; Connectors</a>
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Admin config indicator */}
                                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
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
                    <div className="hidden">
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
                                            {d.destinationProvider ? (
                                                <span className="flex items-center gap-2 truncate">
                                                    <ConnectorLogo provider={d.destinationProvider} size="sm" />
                                                    <span className="truncate">
                                                        {d.destinationProviders.find(p => p.provider_id === d.destinationProvider)?.display_name
                                                            || getProviderDisplayName(d.destinationProvider)}
                                                    </span>
                                                </span>
                                            ) : (
                                                <SelectValue placeholder="Select provider" />
                                            )}
                                        </SelectTrigger>
                                        <SelectContent>
                                            {d.destinationProviders.map(p => (
                                                <SelectItem key={p.provider_id} value={p.provider_id}>
                                                    <span className="flex items-center gap-2">
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

                        {/* Destination ERP entity */}
                        {d.destinationCategory === "erp" && d.destinationProvider && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Target Entity</Label>
                                {d.destEntitiesLoading ? (
                                    <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-muted-foreground text-sm">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading entities...
                                    </div>
                                ) : d.availableDestEntities.length === 0 ? (
                                    <div className="flex items-center h-9 px-3 border rounded-md text-muted-foreground text-xs border-dashed">
                                        No entities available
                                    </div>
                                ) : (
                                    <Select
                                        value={d.destinationEntity}
                                        onValueChange={d.setDestinationEntity}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select target entity" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {d.availableDestEntities.map(e => (
                                                <SelectItem key={e.value} value={e.value}>
                                                    {e.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        )}

                        {/* Warehouse destination config — warehouse/database from admin, only schema selectable */}
                        {d.destinationCategory === "warehouse" && d.destinationProvider && (
                            <>
                                {d.destConfigMissing ? (
                                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 py-2">
                                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                        <AlertDescription className="text-xs text-amber-400">
                                            Warehouse/database not configured.{" "}
                                            <a href="/admin" className="font-medium underline">Configure in Admin &gt; Connectors</a>
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Admin config indicator */}
                                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                                            <Settings2 className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                {d.destConnectorConfig.warehouse && (
                                                    <span className="inline-flex items-center gap-0.5">
                                                        <HardDrive className="h-2.5 w-2.5" />
                                                        {d.destConnectorConfig.warehouse}
                                                    </span>
                                                )}
                                                {d.destConnectorConfig.warehouse && d.destConnectorConfig.database && (
                                                    <span className="text-muted-foreground/30">/</span>
                                                )}
                                                {d.destConnectorConfig.database && (
                                                    <span className="inline-flex items-center gap-0.5">
                                                        <Database className="h-2.5 w-2.5" />
                                                        {d.destConnectorConfig.database}
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
                                                value={d.destinationConfig.schema || ""}
                                                onValueChange={(v) => d.updateDestinationConfig("schema", v)}
                                                disabled={!d.destinationConfig.database}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder={d.destinationConfig.database ? "Schema" : "Loading..."} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {d.destSchemaList.map(s => (
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

                        {/* Target table (shown after schema is selected) */}
                        {d.destinationCategory === "warehouse" && d.destinationProvider && d.destinationConfig.schema && (
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Target Table</Label>
                                <Input
                                    placeholder="Type new table name or pick existing below"
                                    value={d.destinationConfig.table || ""}
                                    onChange={(e) => d.updateDestinationConfig("table", e.target.value.toUpperCase())}
                                    className="h-8 text-xs font-mono"
                                />
                                {d.destTableList.length > 0 && !d.destinationConfig.table && (
                                    <div className="border rounded-md max-h-32 overflow-y-auto p-1.5 space-y-0.5">
                                        {d.destTableList.map(t => (
                                            <button
                                                type="button"
                                                key={t.name}
                                                onClick={() => d.updateDestinationConfig("table", t.name)}
                                                className="flex items-center px-2 py-1 rounded text-xs hover:bg-accent/50 transition-colors w-full text-left font-mono"
                                            >
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    </div>{/* end hidden destination wrapper */}

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
                        <CronBuilder
                            value={d.cronExpression || "0 9 * * ? *"}
                            onChange={(cron) => d.setCronExpression(cron)}
                        />
                    )}

                    {d.frequency === "batch" && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-500/30 text-amber-400">
                            <Zap className="h-4 w-4 flex-shrink-0" />
                            <p className="text-xs">
                                One-time transfer. Data will be transferred immediately after creation.
                            </p>
                        </div>
                    )}

                    {/* Column Mapping was here — moved to dedicated MappingStep */}

                    {/* ── Authorized Person ────────────────────────────────── */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Authorized Person</Label>
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
                                    <SelectValue placeholder="Select authorized person" />
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

                    {/* Advanced DQ toggle moved to MappingStep — when enabled there,
                        this step's footer button label switches to "Configure DQ →"
                        and routes to the DQ step. */}
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                <Button
                    onClick={onNext}
                    disabled={!canProceed || isCreating}
                >
                    {isCreating ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</>
                    ) : advancedDQ ? (
                        <>Configure DQ &rarr;</>
                    ) : (
                        <>Create Job</>
                    )}
                </Button>
            </div>
        </div>
    )
}

// ─── Embedded job-basics form ─────────────────────────────────────────────────
// Renders just the visible config fields (Name + Frequency + Authorized Person)
// without any scroll container or footer, so EndpointsStep can inline them.

function EmbeddedJobBasics({ d }: { d: ReturnType<typeof useJobDialog> }) {
    return (
        <div className="space-y-4 pt-4 mt-4 border-t border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Job Basics</h3>

            {/* Job Name */}
            <div className="space-y-2">
                <Label htmlFor="job-name-inline" className="text-sm font-medium">Job Name</Label>
                <Input
                    id="job-name-inline"
                    placeholder="e.g. Invoice Sync QB to Snowflake"
                    value={d.name}
                    onChange={e => d.setName(e.target.value)}
                    className="h-10"
                />
            </div>

            {/* Frequency */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">Frequency</Label>
                <Select value={d.frequency} onValueChange={v => d.setFrequency(v as JobFrequency)}>
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
                <CronBuilder
                    value={d.cronExpression || "0 9 * * ? *"}
                    onChange={cron => d.setCronExpression(cron)}
                />
            )}

            {d.frequency === "batch" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-500/30 text-amber-400">
                    <Zap className="h-4 w-4 flex-shrink-0" />
                    <p className="text-xs">
                        One-time transfer. Data will be transferred immediately after creation.
                    </p>
                </div>
            )}

            {/* Authorized Person */}
            <div className="space-y-1.5">
                <Label className="text-sm font-medium">Authorized Person</Label>
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
                            <SelectValue placeholder="Select authorized person" />
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
    )
}
