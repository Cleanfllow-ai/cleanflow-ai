"use client"

/**
 * MappingPanel — reusable per-pair mapping editor.
 *
 * Consumed by:
 *  - `MappingStep` (wizard) — one panel per (srcEntity, dstEntity) pair.
 *  - Settings > Mapping Templates editor (Agent 4) — owns its own state.
 *
 * Header: provider+entity glyph for each side, cardinality chip, category badges.
 *
 * Toolbar:
 *  - Use Template      → calls `mappingTemplatesAPI.list({src,dst})`, applies on pick.
 *  - Auto-map (AI)     → enabled only when isOnePair (1:1). Disabled tooltip otherwise.
 *  - Save as Template  → opens dialog with name + description.
 *  - Copy from another → visible when otherPairs.length > 0.
 *
 * Body: extended `<ColumnMappingEditor>` with confidenceMap + sampleDataRows.
 *
 * Schema fetch is category-aware:
 *   ERP source       → erpConnectorsAPI.getEntityFields
 *   Warehouse source → warehouseConnectorsAPI.getTableColumns
 *   (storage uses the unified connectorsAPI.getEntityFields)
 *
 * Confidence/method state is mirrored from the parent via `confidenceMap`.
 * "Modified" chip + "Reset to template" link surface when the user edits a
 * template-applied mapping.
 */

import { useEffect, useMemo, useState, useCallback } from "react"
import { Loader2, Sparkles, FileDown, Copy, Save, RotateCcw, FileText, Database, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/shared/hooks/use-toast"
import { ColumnMappingEditor, type FieldDef } from "./column-mapping-editor"
import { ConnectorLogo } from "@/modules/connectors/components/connector-logo"
import {
    connectorsAPI,
    erpConnectorsAPI,
    warehouseConnectorsAPI,
} from "@/modules/connectors"
import { mappingTemplatesAPI, type MappingTemplate } from "@/modules/settings/api/mapping-templates-api"
import type { PipelineStep, MappingData } from "./use-pipeline-builder"
import type { ProviderCategory } from "./use-job-dialog"
import { CATEGORY_LABELS, getProviderDisplayName } from "./job-dialog-constants"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MappingPanelProps {
    step: PipelineStep
    /** Current saved mapping data for this pair, if any. */
    mapping?: MappingData
    /** Called when the panel produces a new mapping (manual, auto, or template). */
    onMappingChange: (mapping: MappingData) => void
    /** Optional pre-fetched sample rows (first ~3) — passed straight to the editor. */
    sampleDataRows?: Record<string, unknown>[]
    /** Other pair labels for the "Copy from another panel" dropdown. */
    otherPairs?: { step_id: string; label: string }[]
    onCopyFromPair?: (sourceStepId: string) => void
    /** Auto-map is only allowed when the wizard is a single 1:1 pair. */
    isOnePair: boolean
    /** Auto-map handler from the parent (we pass src/dst entity in). */
    onAutoMap?: (srcEntity: string, dstEntity: string) => Promise<Array<{ source: string; destination: string; confidence: number; method: string }>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<ProviderCategory, React.ReactNode> = {
    erp: <FileText className="h-3 w-3" />,
    warehouse: <Database className="h-3 w-3" />,
    storage: <HardDrive className="h-3 w-3" />,
}

function buildWarehouseParams(config: Record<string, any>): Record<string, string> {
    const params: Record<string, string> = {}
    if (config.database) params.database = String(config.database)
    if (config.schema) params.schema = String(config.schema)
    if (config.warehouse) params.warehouse = String(config.warehouse)
    return params
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MappingPanel({
    step,
    mapping,
    onMappingChange,
    sampleDataRows,
    otherPairs = [],
    onCopyFromPair,
    isOnePair,
    onAutoMap,
}: MappingPanelProps) {
    const { toast } = useToast()

    const [sourceFields, setSourceFields] = useState<FieldDef[]>([])
    const [destFields, setDestFields] = useState<FieldDef[]>([])
    const [fieldsLoading, setFieldsLoading] = useState(false)

    const [templates, setTemplates] = useState<MappingTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [appliedTemplateId, setAppliedTemplateId] = useState<string>(mapping?.template_id || "")

    const [autoMapBusy, setAutoMapBusy] = useState(false)

    // Save-as-template dialog state
    const [saveDialogOpen, setSaveDialogOpen] = useState(false)
    const [saveName, setSaveName] = useState("")
    const [saveDesc, setSaveDesc] = useState("")
    const [saving, setSaving] = useState(false)

    const currentMapping = mapping?.column_mapping || {}
    const confidenceMap = mapping?.confidence_map || {}
    const methodMap = mapping?.method_map || {}
    const isModified = Boolean(mapping?.modified)

    // ── Fetch source schema (category-aware) ─────────────────────────────────

    useEffect(() => {
        if (!step.source_provider || !step.source_entity) return
        let cancelled = false
        setFieldsLoading(true)

        const fetchSrc = async (): Promise<FieldDef[]> => {
            try {
                if (step.source_category === "erp") {
                    const res = await erpConnectorsAPI.getEntityFields(step.source_provider, step.source_entity)
                    return (res.fields || []).map(f => ({
                        key: f.key || f.name || "",
                        label: f.label || f.key || f.name || "",
                        data_type: f.data_type || f.type || "string",
                        required: f.required || false,
                    })).filter(f => f.key)
                }
                if (step.source_category === "warehouse" && step.source_config?.database && step.source_config?.schema) {
                    const cols = await warehouseConnectorsAPI.getTableColumns(
                        step.source_provider,
                        step.source_config.database,
                        step.source_config.schema,
                        step.source_entity,
                    )
                    return cols.map(c => ({ key: c.name, label: c.name, data_type: c.type || "string", required: false }))
                }
                // storage / other — fall back to unified endpoint
                const res = await connectorsAPI.getEntityFields(step.source_provider, step.source_entity, buildWarehouseParams(step.source_config || {}))
                return (res.fields || []).map(f => ({
                    key: f.key || (f as any).name || "",
                    label: f.label || f.key || (f as any).name || "",
                    data_type: f.data_type || (f as any).type || "string",
                    required: f.required || false,
                })).filter(f => f.key)
            } catch (err) {
                return []
            }
        }

        const fetchDst = async (): Promise<FieldDef[]> => {
            try {
                if (step.dest_category === "erp") {
                    const res = await erpConnectorsAPI.getEntityFields(step.dest_provider, step.dest_entity)
                    return (res.fields || []).map(f => ({
                        key: f.key || f.name || "",
                        label: f.label || f.key || f.name || "",
                        data_type: f.data_type || f.type || "string",
                        required: f.required || false,
                    })).filter(f => f.key)
                }
                if (step.dest_category === "warehouse" && step.dest_config?.database && step.dest_config?.schema && step.dest_entity) {
                    const cols = await warehouseConnectorsAPI.getTableColumns(
                        step.dest_provider,
                        step.dest_config.database,
                        step.dest_config.schema,
                        step.dest_entity,
                    )
                    return cols.map(c => ({ key: c.name, label: c.name, data_type: c.type || "string", required: false }))
                }
                const res = await connectorsAPI.getEntityFields(step.dest_provider, step.dest_entity, buildWarehouseParams(step.dest_config || {}))
                return (res.fields || []).map(f => ({
                    key: f.key || (f as any).name || "",
                    label: f.label || f.key || (f as any).name || "",
                    data_type: f.data_type || (f as any).type || "string",
                    required: f.required || false,
                })).filter(f => f.key)
            } catch {
                return []
            }
        }

        Promise.all([fetchSrc(), fetchDst()]).then(([src, dst]) => {
            if (cancelled) return
            setSourceFields(src)
            // For warehouse destinations with no existing schema, mirror source.
            setDestFields(dst.length === 0 && step.dest_category === "warehouse" ? src.map(f => ({ ...f })) : dst)
        }).finally(() => {
            if (!cancelled) setFieldsLoading(false)
        })

        return () => { cancelled = true }
    }, [
        step.source_provider, step.source_entity, step.source_category,
        step.dest_provider, step.dest_entity, step.dest_category,
        step.source_config, step.dest_config,
    ])

    // ── Fetch matching templates for this (src,dst) pair ─────────────────────

    useEffect(() => {
        if (!step.source_provider || !step.dest_provider) return
        let cancelled = false
        setTemplatesLoading(true)
        mappingTemplatesAPI.list({
            source_provider: step.source_provider,
            source_entity: step.source_entity,
            dest_provider: step.dest_provider,
            dest_entity: step.dest_entity,
        }).then(res => {
            if (!cancelled) setTemplates(res || [])
        }).catch(() => {
            if (!cancelled) setTemplates([])
        }).finally(() => {
            if (!cancelled) setTemplatesLoading(false)
        })
        return () => { cancelled = true }
    }, [step.source_provider, step.source_entity, step.dest_provider, step.dest_entity])

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleMappingChange = useCallback((next: Record<string, string>) => {
        // If a template was applied, mark as modified when the user diverges.
        const wasFromTemplate = Boolean(appliedTemplateId)
        onMappingChange({
            ...mapping,
            column_mapping: next,
            template_id: appliedTemplateId || undefined,
            modified: wasFromTemplate,
        })
    }, [appliedTemplateId, mapping, onMappingChange])

    const handleApplyTemplate = useCallback((tpl: MappingTemplate) => {
        setAppliedTemplateId(tpl.template_id)
        onMappingChange({
            column_mapping: { ...tpl.column_mapping },
            template_id: tpl.template_id,
            modified: false,
        })
        toast({ title: "Template applied", description: tpl.name })
    }, [onMappingChange, toast])

    const handleResetToTemplate = useCallback(() => {
        if (!appliedTemplateId) return
        const tpl = templates.find(t => t.template_id === appliedTemplateId)
        if (!tpl) return
        onMappingChange({
            column_mapping: { ...tpl.column_mapping },
            template_id: tpl.template_id,
            modified: false,
        })
        toast({ title: "Reset to template", description: tpl.name })
    }, [appliedTemplateId, templates, onMappingChange, toast])

    const handleAutoMap = useCallback(async () => {
        if (!onAutoMap) return
        setAutoMapBusy(true)
        try {
            const mappings = await onAutoMap(step.source_entity, step.dest_entity)
            const next: Record<string, string> = {}
            const conf: Record<string, number> = {}
            const meth: Record<string, string> = {}
            for (const m of mappings) {
                if (m.confidence >= 70) {
                    next[m.source] = m.destination
                    conf[m.source] = m.confidence
                    meth[m.source] = m.method
                }
            }
            onMappingChange({
                column_mapping: next,
                confidence_map: conf,
                method_map: meth,
                template_id: undefined,
                modified: false,
            })
            setAppliedTemplateId("")
        } finally {
            setAutoMapBusy(false)
        }
    }, [onAutoMap, step.source_entity, step.dest_entity, onMappingChange])

    const handleSaveTemplate = useCallback(async () => {
        if (!saveName.trim()) {
            toast({ title: "Template name required", variant: "destructive" })
            return
        }
        setSaving(true)
        try {
            const created = await mappingTemplatesAPI.create({
                name: saveName.trim(),
                description: saveDesc.trim(),
                source_provider: step.source_provider,
                source_entity: step.source_entity,
                dest_provider: step.dest_provider,
                dest_entity: step.dest_entity,
                column_mapping: currentMapping,
                is_org_default: false,
            })
            setTemplates(prev => [created, ...prev])
            setAppliedTemplateId(created.template_id)
            onMappingChange({
                ...(mapping || { column_mapping: {} }),
                column_mapping: currentMapping,
                template_id: created.template_id,
                modified: false,
            })
            setSaveDialogOpen(false)
            setSaveName("")
            setSaveDesc("")
            toast({ title: "Template saved", description: created.name })
        } catch (err: any) {
            toast({ title: "Save failed", description: err?.message || "Unknown error", variant: "destructive" })
        } finally {
            setSaving(false)
        }
    }, [saveName, saveDesc, step, currentMapping, mapping, onMappingChange, toast])

    // ── Derived ──────────────────────────────────────────────────────────────

    const cardinalityChip = useMemo(() => isOnePair ? "1:1" : "multi", [isOnePair])

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-3">
            {/* Compact metadata row — the AccordionTrigger above already shows
                the source.entity → dest.entity path with logos, so we just
                add the cardinality + category badges here. */}
            <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{cardinalityChip}</Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                    {CATEGORY_ICON[step.source_category]}
                    {CATEGORY_LABELS[step.source_category]} source
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                    {CATEGORY_ICON[step.dest_category]}
                    {CATEGORY_LABELS[step.dest_category]} dest
                </Badge>
            </div>

            {/* Toolbar */}
            <div className="flex items-center flex-wrap gap-1.5">
                {/* Use Template */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                            <FileDown className="h-3 w-3" />
                            Use Template
                            {templatesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                        <DropdownMenuLabel className="text-xs">Templates for this pair</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {templates.length === 0 ? (
                            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                No saved templates
                            </DropdownMenuItem>
                        ) : (
                            templates.map(t => (
                                <DropdownMenuItem
                                    key={t.template_id}
                                    onClick={() => handleApplyTemplate(t)}
                                    className="text-xs flex flex-col items-start gap-0.5"
                                >
                                    <span className="font-medium">{t.name}</span>
                                    {t.description && (
                                        <span className="text-[10px] text-muted-foreground truncate max-w-full">
                                            {t.description}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Auto-map */}
                {onAutoMap && (isOnePair ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAutoMap}
                        disabled={autoMapBusy}
                        className="h-7 text-xs gap-1.5"
                    >
                        {autoMapBusy
                            ? <><Loader2 className="h-3 w-3 animate-spin" /> Mapping...</>
                            : <><Sparkles className="h-3 w-3" /> Auto-map (AI)</>}
                    </Button>
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button variant="outline" size="sm" disabled className="h-7 text-xs gap-1.5 cursor-not-allowed">
                                    <Sparkles className="h-3 w-3" /> Auto-map (AI)
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <span className="text-[11px]">Auto-map only available for 1:1 jobs.</span>
                        </TooltipContent>
                    </Tooltip>
                ))}

                {/* Save as Template */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveDialogOpen(true)}
                    disabled={Object.keys(currentMapping).length === 0}
                    className="h-7 text-xs gap-1.5"
                >
                    <Save className="h-3 w-3" /> Save as Template
                </Button>

                {/* Copy from another panel */}
                {otherPairs.length > 0 && onCopyFromPair && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                                <Copy className="h-3 w-3" /> Copy from
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuLabel className="text-xs">Copy mapping from</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {otherPairs.map(p => (
                                <DropdownMenuItem
                                    key={p.step_id}
                                    onClick={() => onCopyFromPair(p.step_id)}
                                    className="text-xs"
                                >
                                    {p.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Modified chip + reset link */}
                {appliedTemplateId && (
                    <div className="flex items-center gap-1 ml-auto">
                        <Badge variant="outline" className="text-[10px]">
                            Template applied
                        </Badge>
                        {isModified && (
                            <>
                                <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-300 text-amber-700">
                                    Modified
                                </Badge>
                                <button
                                    type="button"
                                    onClick={handleResetToTemplate}
                                    className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                                >
                                    <RotateCcw className="h-2.5 w-2.5" />
                                    Reset to template
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Editor body */}
            {fieldsLoading ? (
                <div className="flex items-center justify-center gap-2 h-32 border rounded-md text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading schemas...
                </div>
            ) : sourceFields.length === 0 ? (
                <div className="flex items-center justify-center h-24 border rounded-md text-xs text-muted-foreground border-dashed">
                    No source fields available
                </div>
            ) : (
                <ColumnMappingEditor
                    sourceFields={sourceFields}
                    destFields={destFields}
                    mapping={currentMapping}
                    onMappingChange={handleMappingChange}
                    onClose={() => { /* MappingPanel keeps the editor inline; close is a no-op */ }}
                    sourceLabel={getProviderDisplayName(step.source_provider)}
                    destLabel={getProviderDisplayName(step.dest_provider)}
                    confidenceMap={confidenceMap}
                    methodMap={methodMap}
                    sampleDataRows={sampleDataRows}
                />
            )}

            {/* Save-as-template dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-base">Save as Template</DialogTitle>
                        <DialogDescription className="text-sm">
                            Save this mapping for {getProviderDisplayName(step.source_provider)}.{step.source_entity} → {getProviderDisplayName(step.dest_provider)}.{step.dest_entity}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="tpl-name" className="text-xs font-medium">Name</Label>
                            <Input
                                id="tpl-name"
                                placeholder="e.g. QB Customers → Zoho Customers v3"
                                value={saveName}
                                onChange={e => setSaveName(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tpl-desc" className="text-xs font-medium">Description (optional)</Label>
                            <Textarea
                                id="tpl-desc"
                                placeholder="What's this mapping for?"
                                value={saveDesc}
                                onChange={e => setSaveDesc(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveTemplate} disabled={saving || !saveName.trim()}>
                            {saving ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Saving...</> : "Save Template"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
