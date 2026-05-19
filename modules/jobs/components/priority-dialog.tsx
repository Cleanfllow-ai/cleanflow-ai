"use client"

/**
 * Priority dialog — reorder entities to control execution order.
 *
 * iPaaS pipelines often need foreign-key load order — Customers BEFORE
 * Invoices, Items BEFORE Sales Orders, etc. This dialog lets the user
 * arrange the entities in the pipeline (deduplicated across all steps)
 * with simple up/down buttons. Anything not explicitly reordered keeps
 * its derived position.
 *
 * On save we set `pipeline.entityPriority`. The stepper consumes this:
 *   - `run_mode = "custom"`
 *   - `entity_order = pipeline.entityPriority`
 * which the backend's `_run_custom` honours (per FEATURE_PLAN §2.1).
 *
 * Field-level priority is intentionally deferred — see the "Field
 * priority" tab placeholder; it doesn't have an obvious runtime mapping
 * today (the backend processes columns in DataFrame order). When a real
 * use case shows up we'll wire it.
 */

import { useState, useEffect, useMemo } from "react"
import { ArrowUp, ArrowDown, ListOrdered, Layers, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/shared/lib/utils"

interface PriorityDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** All distinct source entities derived from pipelineSteps. */
    availableEntities: string[]
    /** Current priority ordering (subset of availableEntities). Empty = default order. */
    value: string[]
    /** Persist new priority. Pass [] to clear. */
    onChange: (next: string[]) => void
}

export function PriorityDialog({
    open, onOpenChange, availableEntities, value, onChange,
}: PriorityDialogProps) {
    // Local working copy so reorders aren't committed until "Save".
    const [draft, setDraft] = useState<string[]>(value)
    const [tab, setTab] = useState<"entity" | "field">("entity")

    useEffect(() => {
        if (open) setDraft(value.length > 0 ? value : availableEntities)
    }, [open, value, availableEntities])

    const move = (index: number, delta: number) => {
        const next = [...draft]
        const target = index + delta
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target], next[index]]
        setDraft(next)
    }

    const handleSave = () => {
        // Persist the draft. If the user didn't touch anything (still
        // matches `availableEntities` order), store [] to mean "default".
        const isDefault = draft.length === availableEntities.length
            && draft.every((e, i) => e === availableEntities[i])
        onChange(isDefault ? [] : draft)
        onOpenChange(false)
    }

    const handleClear = () => {
        onChange([])
        onOpenChange(false)
    }

    const isCustom = useMemo(() => {
        if (draft.length !== availableEntities.length) return true
        return draft.some((e, i) => e !== availableEntities[i])
    }, [draft, availableEntities])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <ListOrdered className="h-4 w-4 text-primary" />
                        Pipeline Priority
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Reorder entities to control how the pipeline runs (e.g. Customers before
                        Invoices for FK ordering). Entities not listed here run in default order.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={(v) => setTab(v as "entity" | "field")} className="w-full">
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="entity" className="text-xs gap-1.5">
                            <Layers className="h-3.5 w-3.5" /> Entity Priority
                        </TabsTrigger>
                        <TabsTrigger value="field" className="text-xs gap-1.5" disabled>
                            Field Priority <Badge variant="outline" className="text-[9px] ml-1">soon</Badge>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="entity" className="mt-3 space-y-3">
                        {availableEntities.length === 0 ? (
                            <Alert>
                                <Info className="h-3.5 w-3.5" />
                                <AlertDescription className="text-xs">
                                    No entities to prioritize yet. Add at least one source-destination
                                    pair on the previous step.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <div className="text-[11px] text-muted-foreground">
                                    Entities at the top run first.
                                </div>
                                <div className="border rounded-md divide-y divide-border/40 max-h-[280px] overflow-y-auto">
                                    {draft.map((entity, idx) => (
                                        <div
                                            key={entity}
                                            className={cn(
                                                "flex items-center justify-between px-3 py-2 text-sm",
                                                idx === 0 && "bg-emerald-100/30",
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold",
                                                    idx === 0
                                                        ? "bg-emerald-1000 text-white"
                                                        : "bg-muted text-muted-foreground",
                                                )}>
                                                    {idx + 1}
                                                </span>
                                                <span className="font-mono text-xs">{entity}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => move(idx, -1)}
                                                    disabled={idx === 0}
                                                    className="h-6 w-6"
                                                    title="Move up"
                                                >
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => move(idx, 1)}
                                                    disabled={idx === draft.length - 1}
                                                    className="h-6 w-6"
                                                    title="Move down"
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {isCustom && (
                                    <Alert className="border-amber-300 bg-amber-100 py-2">
                                        <Info className="h-3.5 w-3.5 text-amber-600" />
                                        <AlertDescription className="text-xs text-amber-900">
                                            Custom order set. Backend will switch <code>run_mode</code> to
                                            <code className="mx-1">custom</code> and process steps in this order.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="field" className="mt-3">
                        <Alert>
                            <Info className="h-3.5 w-3.5" />
                            <AlertDescription className="text-xs">
                                Field-level priority will let you specify column write-order within
                                each entity (e.g. <code>cust.custname</code> before
                                <code className="mx-1">vendor.vendorname</code>). Not yet wired to
                                the runtime — coming after the entity priority work ships.
                            </AlertDescription>
                        </Alert>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    {value.length > 0 && (
                        <Button variant="ghost" onClick={handleClear} className="mr-auto text-xs text-muted-foreground">
                            <X className="h-3 w-3 mr-1" /> Clear (use default order)
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={availableEntities.length === 0}>
                        Save priority
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
