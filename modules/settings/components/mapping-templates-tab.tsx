"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
    AlertTriangle,
    ArrowRight,
    Edit2,
    Loader2,
    Plus,
    RefreshCw,
    Trash2,
    Workflow,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/shared/hooks/use-toast"
import { getProviderDisplayName } from "@/modules/jobs/components/job-dialog-constants"
import { useMappingTemplates } from "./use-mapping-templates"
import { MappingTemplateEditor } from "./mapping-template-editor"
import type { MappingTemplate } from "@/modules/settings/types/mapping-template.types"

export function MappingTemplatesTab() {
    const { toast } = useToast()
    const {
        templates,
        loading,
        error,
        refresh,
        createTemplate,
        updateTemplate,
        deleteTemplate,
    } = useMappingTemplates()

    const [editorOpen, setEditorOpen] = useState(false)
    const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
    const [editingTemplate, setEditingTemplate] = useState<MappingTemplate | null>(null)

    const [deleteTarget, setDeleteTarget] = useState<MappingTemplate | null>(null)
    const [deleting, setDeleting] = useState(false)

    const openCreate = () => {
        setEditorMode("create")
        setEditingTemplate(null)
        setEditorOpen(true)
    }

    const openEdit = (tpl: MappingTemplate) => {
        setEditorMode("edit")
        setEditingTemplate(tpl)
        setEditorOpen(true)
    }

    const handleSave = async (payload: Partial<MappingTemplate>) => {
        if (editorMode === "create") return createTemplate(payload)
        if (editingTemplate) return updateTemplate(editingTemplate.template_id, payload)
        // Defensive: should never hit. Re-throw so the editor toasts it.
        throw new Error("No template selected for edit")
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            await deleteTemplate(deleteTarget.template_id)
            toast({ title: "Template deleted", description: deleteTarget.name })
            setDeleteTarget(null)
        } catch (err) {
            toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            })
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Workflow className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold tracking-wide text-foreground">
                            Mapping Templates
                        </h2>
                        <p className="text-[12px] text-muted-foreground">
                            Saved column mappings reusable across jobs.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void refresh()}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        New Template
                    </Button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg border border-red-500/25 bg-red-500/5 text-sm">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    <span className="text-foreground/80">{error}</span>
                </div>
            )}

            {/* Body */}
            {loading && templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/60 mb-3" />
                    <p className="text-[11px] uppercase tracking-widest">Loading templates...</p>
                </div>
            ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border/60 bg-muted/10">
                    <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
                        <Workflow className="h-6 w-6 text-primary/40" />
                    </div>
                    <h3 className="text-base font-semibold tracking-wide text-foreground/80 mb-1">
                        No templates yet
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md text-center mb-4">
                        Create one from the Job wizard or click &quot;New Template&quot; above.
                    </p>
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        New Template
                    </Button>
                </div>
            ) : (
                <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    Name
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    Source
                                </TableHead>
                                <TableHead className="w-8" />
                                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    Destination
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    Fields
                                </TableHead>
                                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    Last used
                                </TableHead>
                                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.map((tpl) => (
                                <TableRow
                                    key={tpl.template_id}
                                    className="border-b border-border/30 hover:bg-muted/15"
                                >
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-[13px] text-foreground">
                                                {tpl.name}
                                            </span>
                                            {tpl.is_org_default && (
                                                <Badge
                                                    variant="outline"
                                                    className="self-start mt-1 bg-primary/10 text-primary border-primary/30 text-[10px] tracking-wider uppercase px-1.5 py-0"
                                                >
                                                    Org default
                                                </Badge>
                                            )}
                                            {tpl.description && (
                                                <span className="text-[11px] text-muted-foreground/70 mt-0.5">
                                                    {tpl.description}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-medium text-primary">
                                                {getProviderDisplayName(tpl.source_provider)}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground tracking-wide">
                                                {tpl.source_entity}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-0 w-8">
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-medium text-accent dark:text-accent">
                                                {getProviderDisplayName(tpl.dest_provider)}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground tracking-wide">
                                                {tpl.dest_entity}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className="text-[12px] tabular-nums text-muted-foreground"
                                            style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                                        >
                                            {Object.keys(tpl.column_mapping || {}).length}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className="text-[12px] text-muted-foreground tabular-nums"
                                            style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                                        >
                                            {tpl.updated_at
                                                ? (() => { try { return format(new Date(tpl.updated_at), "MMM d, yyyy") } catch { return "—" } })()
                                                : "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => openEdit(tpl)}
                                                aria-label="Edit template"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteTarget(tpl)}
                                                aria-label="Delete template"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Editor */}
            <MappingTemplateEditor
                open={editorOpen}
                mode={editorMode}
                template={editingTemplate}
                onClose={() => {
                    setEditorOpen(false)
                    setEditingTemplate(null)
                }}
                onSave={handleSave}
            />

            {/* Delete confirmation */}
            <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
                <AlertDialogContent className="bg-card border-border/60">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/20">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                            <span className="text-base font-semibold tracking-wide">
                                Delete Mapping Template
                            </span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-[13px] leading-relaxed mt-2">
                            Are you sure you want to delete{" "}
                            <strong className="text-foreground">{deleteTarget?.name}</strong>?
                            Jobs using this template will fall back to inline mappings. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
