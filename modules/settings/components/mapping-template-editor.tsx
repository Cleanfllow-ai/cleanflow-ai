"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/shared/hooks/use-toast"
import {
    PROVIDER_DISPLAY_NAMES,
    getProviderDisplayName,
} from "@/modules/jobs/components/job-dialog-constants"
import type { MappingTemplate } from "@/modules/settings/types/mapping-template.types"
import { MappingPanel } from "@/modules/jobs/components/mapping-panel"
import type { PipelineStep, MappingData } from "@/modules/jobs/components/use-pipeline-builder"
import type { ProviderCategory } from "@/modules/jobs/components/use-job-dialog"

// Derive connector category from provider id. Mirrors backend
// _CATEGORY_BY_PROVIDER in jobs/presentation/api/handler.py.
function categoryForProvider(provider: string): ProviderCategory {
    const p = (provider || "").toLowerCase()
    if (p === "snowflake") return "warehouse"
    if (p === "googledrive") return "storage"
    return "erp"
}

// ─── Provider / entity options ──────────────────────────────────────────────
// Pulled from the existing job-dialog-constants so the wizard and the editor
// stay in lockstep. Entities are static-best-effort — Agent 3's MappingPanel
// will swap in the live registry once available.

const PROVIDER_OPTIONS = Object.keys(PROVIDER_DISPLAY_NAMES)

const COMMON_ENTITIES = [
    "customers",
    "vendors",
    "invoices",
    "bills",
    "items",
    "accounts",
    "payments",
]

interface MappingTemplateEditorProps {
    open: boolean
    mode: "create" | "edit"
    template?: MappingTemplate | null
    onClose: () => void
    onSave: (payload: Partial<MappingTemplate>) => Promise<MappingTemplate>
}

export function MappingTemplateEditor({
    open,
    mode,
    template,
    onClose,
    onSave,
}: MappingTemplateEditorProps) {
    const { toast } = useToast()

    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [sourceProvider, setSourceProvider] = useState("")
    const [sourceEntity, setSourceEntity] = useState("")
    const [destProvider, setDestProvider] = useState("")
    const [destEntity, setDestEntity] = useState("")
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
    const [isOrgDefault, setIsOrgDefault] = useState(false)
    const [saving, setSaving] = useState(false)

    // Reset form when the dialog opens, hydrating from `template` in edit mode.
    useEffect(() => {
        if (!open) return
        if (mode === "edit" && template) {
            setName(template.name)
            setDescription(template.description ?? "")
            setSourceProvider(template.source_provider)
            setSourceEntity(template.source_entity)
            setDestProvider(template.dest_provider)
            setDestEntity(template.dest_entity)
            setColumnMapping(template.column_mapping ?? {})
            setIsOrgDefault(Boolean(template.is_org_default))
        } else {
            setName("")
            setDescription("")
            setSourceProvider("")
            setSourceEntity("")
            setDestProvider("")
            setDestEntity("")
            setColumnMapping({})
            setIsOrgDefault(false)
        }
    }, [open, mode, template])

    const isValid = useMemo(() => {
        return (
            name.trim().length > 0 &&
            sourceProvider.length > 0 &&
            sourceEntity.length > 0 &&
            destProvider.length > 0 &&
            destEntity.length > 0
        )
    }, [name, sourceProvider, sourceEntity, destProvider, destEntity])

    const handleSave = async () => {
        if (!isValid) return
        setSaving(true)
        try {
            const payload: Partial<MappingTemplate> = {
                name: name.trim(),
                description: description.trim() || undefined,
                source_provider: sourceProvider,
                source_entity: sourceEntity,
                dest_provider: destProvider,
                dest_entity: destEntity,
                column_mapping: columnMapping,
                is_org_default: isOrgDefault,
            }
            await onSave(payload)
            toast({
                title: mode === "create" ? "Template created" : "Template updated",
                description: name.trim(),
            })
            onClose()
        } catch (err) {
            toast({
                title: "Save failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
            <DialogContent className="sm:max-w-[720px] bg-card border-border/60 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold tracking-wide">
                        {mode === "create" ? "New Mapping Template" : "Edit Mapping Template"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">
                        Saved templates can be reused across jobs that share the same source / destination pair.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label htmlFor="tpl-name" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                            Template Name
                        </Label>
                        <Input
                            id="tpl-name"
                            placeholder="e.g. QB Customers to Zoho Customers v3"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={saving}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="tpl-desc" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                            Description (optional)
                        </Label>
                        <Textarea
                            id="tpl-desc"
                            placeholder="What does this template map?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={saving}
                            rows={2}
                        />
                    </div>

                    {/* Source/Destination grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                                Source Provider
                            </Label>
                            <Select value={sourceProvider} onValueChange={setSourceProvider} disabled={saving}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROVIDER_OPTIONS.map((p) => (
                                        <SelectItem key={p} value={p}>{getProviderDisplayName(p)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                                Source Entity
                            </Label>
                            <Select value={sourceEntity} onValueChange={setSourceEntity} disabled={saving || !sourceProvider}>
                                <SelectTrigger>
                                    <SelectValue placeholder={sourceProvider ? "Select entity" : "Pick a provider first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMMON_ENTITIES.map((e) => (
                                        <SelectItem key={e} value={e}>{e}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                                Destination Provider
                            </Label>
                            <Select value={destProvider} onValueChange={setDestProvider} disabled={saving}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select destination" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROVIDER_OPTIONS.map((p) => (
                                        <SelectItem key={p} value={p}>{getProviderDisplayName(p)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                                Destination Entity
                            </Label>
                            <Select value={destEntity} onValueChange={setDestEntity} disabled={saving || !destProvider}>
                                <SelectTrigger>
                                    <SelectValue placeholder={destProvider ? "Select entity" : "Pick a provider first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMMON_ENTITIES.map((e) => (
                                        <SelectItem key={e} value={e}>{e}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Mapping panel */}
                    <div className="space-y-2">
                        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                            Column Mapping
                        </Label>
                        {sourceProvider && sourceEntity && destProvider && destEntity ? (
                            <MappingPanel
                                step={{
                                    step_id: "template-editor",
                                    source_provider: sourceProvider,
                                    source_category: categoryForProvider(sourceProvider),
                                    source_config: {},
                                    source_entity: sourceEntity,
                                    dest_provider: destProvider,
                                    dest_category: categoryForProvider(destProvider),
                                    dest_config: {},
                                    dest_entity: destEntity,
                                    template_id: "",
                                    inline_mapping: columnMapping,
                                } as PipelineStep}
                                mapping={{
                                    step_id: "template-editor",
                                    column_mapping: columnMapping,
                                    template_id: undefined,
                                    confidence_map: {},
                                    method_map: {},
                                    modified: false,
                                } as MappingData}
                                onMappingChange={(m) => setColumnMapping(m.column_mapping || {})}
                                isOnePair={true}
                            />
                        ) : (
                            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                                Pick source and destination above to start mapping columns.
                            </div>
                        )}
                    </div>

                    {/* Org default */}
                    <div className="flex items-center gap-2.5">
                        <Checkbox
                            id="tpl-default"
                            checked={isOrgDefault}
                            onCheckedChange={(v) => setIsOrgDefault(Boolean(v))}
                            disabled={saving}
                        />
                        <Label htmlFor="tpl-default" className="text-sm font-normal cursor-pointer">
                            Auto-apply this template for new jobs that match this source / destination pair
                        </Label>
                    </div>
                </div>

                <DialogFooter className="mt-4 gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!isValid || saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                        {mode === "create" ? "Create Template" : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
