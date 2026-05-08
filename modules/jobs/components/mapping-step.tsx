"use client"

/**
 * MappingStep — wizard step 3.
 *
 * Vertical accordion: one `<MappingPanel>` per (srcEntity, dstEntity) pair
 * derived from `pipeline.pipelineSteps`. Each panel manages its own template
 * lookup, schema fetch, and editor state, and writes back into
 * `pipeline.mappingsByPair` keyed by step_id.
 */

import { useCallback } from "react"
import { Loader2, AlertCircle, SlidersHorizontal, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/shared/lib/utils"
import { MappingPanel } from "./mapping-panel"
import { ConnectorLogo } from "@/modules/connectors/components/connector-logo"
import { getProviderDisplayName } from "./job-dialog-constants"
import type { PipelineState } from "./use-pipeline-builder"

export interface MappingStepProps {
    pipeline: PipelineState
    onBack: () => void
    onNext: () => void
    /** True when mapping is the LAST step (i.e. !advancedDQ). Changes the Next
     *  button label to "Create Job" so the wording matches the action. */
    isFinalStep?: boolean
    isCreating?: boolean
    /** Advanced DQ toggle — when ON, an extra wizard step appears AFTER Job
     *  Configuration to let the user customise DQ rules / thresholds. */
    advancedDQ?: boolean
    onAdvancedDQChange?: (val: boolean) => void
}

export function MappingStep({ pipeline, onBack, onNext, isFinalStep, isCreating, advancedDQ, onAdvancedDQChange }: MappingStepProps) {
    const { pipelineSteps, mappingsByPair, dialog } = pipeline

    const isOnePair = pipelineSteps.length === 1

    const handleCopyFromPair = useCallback((targetStepId: string, sourceStepId: string) => {
        const src = mappingsByPair[sourceStepId]
        if (!src) return
        pipeline.setMappingForStep(targetStepId, {
            column_mapping: { ...src.column_mapping },
            template_id: src.template_id,
            confidence_map: src.confidence_map ? { ...src.confidence_map } : undefined,
            method_map: src.method_map ? { ...src.method_map } : undefined,
            modified: false,
        })
    }, [mappingsByPair, pipeline])

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Field Mapping</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {pipelineSteps.length} pair{pipelineSteps.length !== 1 ? "s" : ""} · cardinality {pipeline.cardinality}
                            </p>
                        </div>
                    </div>

                    {pipelineSteps.length === 0 ? (
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                            <AlertDescription className="text-xs text-amber-900">
                                No source-destination pairs to map yet. Go back and configure endpoints.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Accordion
                            type="multiple"
                            defaultValue={[pipelineSteps[0]?.step_id]}
                            className="space-y-2"
                        >
                            {pipelineSteps.map(step => {
                                const otherPairs = pipelineSteps
                                    .filter(s => s.step_id !== step.step_id)
                                    .map(s => ({
                                        step_id: s.step_id,
                                        label: `${getProviderDisplayName(s.source_provider)}.${s.source_entity} → ${getProviderDisplayName(s.dest_provider)}.${s.dest_entity}`,
                                    }))

                                const mapping = mappingsByPair[step.step_id]
                                const mappedCount = Object.keys(mapping?.column_mapping || {}).length

                                return (
                                    <AccordionItem
                                        key={step.step_id}
                                        value={step.step_id}
                                        className="border rounded-lg px-3 bg-card"
                                    >
                                        <AccordionTrigger className="hover:no-underline py-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <ConnectorLogo provider={step.source_provider} size="sm" />
                                                <span className="font-medium">{step.source_entity}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <ConnectorLogo provider={step.dest_provider} size="sm" />
                                                <span className="font-medium">{step.dest_entity}</span>
                                                <span className="text-[10px] text-muted-foreground ml-2">
                                                    {mappedCount > 0 ? `${mappedCount} mapped` : "no mapping"}
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <MappingPanel
                                                step={step}
                                                mapping={mapping}
                                                onMappingChange={m => pipeline.setMappingForStep(step.step_id, m)}
                                                otherPairs={otherPairs}
                                                onCopyFromPair={(srcId) => handleCopyFromPair(step.step_id, srcId)}
                                                isOnePair={isOnePair}
                                                onAutoMap={dialog.autoMapPair}
                                            />
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                        </Accordion>
                    )}

                    {/* ── Advanced DQ Configuration toggle ─────────────────────
                        When enabled, an additional "DQ Configuration" step is
                        added to the wizard after Job Configuration. Otherwise
                        the job ships with default DQ (all columns, balanced
                        strictness, auto-fix on). */}
                    {pipelineSteps.length > 0 && onAdvancedDQChange && (
                        <div
                            className={cn(
                                "rounded-xl border p-4 transition-all duration-200 mt-2",
                                advancedDQ
                                    ? "border-primary/30 bg-primary/[0.03]"
                                    : "border-border/60 bg-muted/20"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                                        advancedDQ ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                    )}>
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium block">Advanced DQ Configuration</span>
                                        <span className="text-xs text-muted-foreground">
                                            {advancedDQ
                                                ? "An extra DQ step will appear after Job Configuration."
                                                : "Skip — use default DQ rules (all columns, balanced strictness, auto-fix)."
                                            }
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={!!advancedDQ}
                                    onCheckedChange={onAdvancedDQChange}
                                />
                            </div>

                            {!advancedDQ && (
                                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 border border-border/40">
                                    <Shield className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        Default DQ runs all 30+ rules with auto-fix. Enable this to customise column selection, business consistency rules, or strictness.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-border/50 flex justify-between">
                    <Button variant="outline" onClick={onBack} disabled={isCreating}>
                        ← Back
                    </Button>
                    <Button onClick={onNext} disabled={isCreating}>
                        {isCreating ? "Creating..." : isFinalStep ? "Create Job" : "Next →"}
                    </Button>
                </div>
            </div>
        </TooltipProvider>
    )
}
