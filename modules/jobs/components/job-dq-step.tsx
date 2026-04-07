"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    ProcessingWizardProvider,
    useProcessingWizard,
} from "@/modules/processing/components/WizardContext"
import { ColumnSelectionStep } from "@/modules/processing/components/steps/ColumnSelectionStep"
import { jobsAPI } from "@/modules/jobs/api/jobs-api"
import { SettingsStep } from "@/modules/processing/components/steps/SettingsStep"
import { RulesStep } from "@/modules/processing/components/steps/RulesStep"
import { connectorsAPI } from "@/modules/connectors"
import type { DQConfig } from "@/modules/jobs/types/jobs.types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/shared/lib/utils"

// ─── Field type mapping ───────────────────────────────────────────────────────

const FIELD_TYPE_TO_DQ_TYPE: Record<string, string> = {
    string: "text",
    text: "text",
    email: "email",
    phone: "phone",
    number: "numeric",
    integer: "numeric",
    decimal: "numeric",
    currency: "currency",
    date: "date",
    datetime: "date",
    boolean: "boolean",
    url: "text",
}

// ─── Jobs-specific profiling step ─────────────────────────────────────────────

interface JobProfilingStepProps {
    sourceProvider: string
    sourceCategory: string
    entity: string
    sourceConfig?: Record<string, string>
}

function JobProfilingStep({
    sourceProvider,
    sourceCategory,
    entity,
    sourceConfig,
}: JobProfilingStepProps) {
    const {
        selectedColumns,
        setSelectedColumns,
        columnProfiles,
        setColumnProfiles,
        requiredColumns,
        setRequiredColumns,
        allColumns,
        prevStep,
        nextStep,
        crossFieldRules,
        setCrossFieldRules,
        setColumnKeyType,
        setColumnNullable,
        setBackendVersion,
    } = useProcessingWizard()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeColumn, setActiveColumn] = useState<string | null>(null)

    const applyProfilingResponse = useCallback((response: any) => {
        const profiles = response?.profiles || response?.column_profiles || {}
        if (profiles && Object.keys(profiles).length > 0) {
            setColumnProfiles(profiles)
        }
        const inferredRequired = response?.required_columns
        if (Array.isArray(inferredRequired) && inferredRequired.length > 0) {
            setRequiredColumns(inferredRequired)
        }
        const summary = response?.summary || {}
        setBackendVersion(summary.backend_version)
        const cfr = response?.cross_field_rules || []
        setCrossFieldRules(cfr.map((r: any) => ({ ...r, enabled: true })))
        Object.entries(profiles).forEach(([col, p]: [string, any]) => {
            if (p.key_type) setColumnKeyType(col, p.key_type)
            if (p.nullable_suggested !== undefined) setColumnNullable(col, p.nullable_suggested)
        })
    }, [setBackendVersion, setColumnKeyType, setColumnNullable, setColumnProfiles, setCrossFieldRules, setRequiredColumns])

    const fetchProfiling = useCallback(async (columns: string[]) => {
        if (!sourceProvider || !sourceCategory || !entity || columns.length === 0) return
        setLoading(true)
        setError(null)
        try {
            const response = await jobsAPI.getProfilingPreview({
                source_provider: sourceProvider,
                source_category: sourceCategory,
                entity,
                source_config: sourceConfig,
                selected_columns: columns,
                sample_size: 200,
            })
            applyProfilingResponse(response)
        } catch (err: any) {
            setError(err?.message || "Failed to fetch profiling data")
        } finally {
            setLoading(false)
        }
    }, [applyProfilingResponse, entity, sourceCategory, sourceConfig, sourceProvider])

    useEffect(() => {
        if (selectedColumns.length > 0 && Object.keys(columnProfiles).length === 0) {
            void fetchProfiling(selectedColumns)
        }
    }, [columnProfiles, fetchProfiling, selectedColumns])

    const profileSingle = async (column: string) => {
        try {
            const response = await jobsAPI.getProfilingPreview({
                source_provider: sourceProvider,
                source_category: sourceCategory,
                entity,
                source_config: sourceConfig,
                selected_columns: [column],
                sample_size: 200,
            })
            const profiles = (response as any)?.profiles || (response as any)?.column_profiles || {}
            if (profiles?.[column]) {
                setColumnProfiles(prev => ({
                    ...prev,
                    [column]: profiles[column],
                }))
            }
        } catch (err) {
            console.error("Failed to profile column", column, err)
        }
    }

    const toggleColumnSelection = (col: string) => {
        setSelectedColumns((prev) => {
            if (prev.includes(col)) {
                return prev.filter((c) => c !== col)
            }
            if (!columnProfiles[col]) {
                void profileSingle(col)
            }
            return [...prev, col]
        })
    }

    const hasProfiles = Object.keys(columnProfiles).length > 0
    const canProceed = selectedColumns.length > 0 && hasProfiles && !loading

    return (
        <div className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Column Profiling</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Review inferred types and quality metrics from a live sample of {entity}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchProfiling(selectedColumns)}
                    disabled={loading || selectedColumns.length === 0}
                >
                    <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="flex gap-4 flex-1 min-h-0 mt-6">
                <div className="w-64 border border-muted rounded-lg flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-muted/40 bg-muted/20">
                        <h3 className="font-medium text-sm">Columns</h3>
                        <p className="text-xs text-muted-foreground mt-1">Click to toggle selection</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-2 space-y-1">
                            {allColumns.map((col) => {
                                const isSelected = selectedColumns.includes(col)
                                const hasProfile = !!columnProfiles[col]
                                const isActive = activeColumn === col
                                return (
                                    <div
                                        key={col}
                                        onClick={() => {
                                            toggleColumnSelection(col)
                                            setActiveColumn(col)
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm",
                                            isActive && "bg-primary/10 border-l-2 border-primary",
                                            !isActive && isSelected && "bg-muted/50",
                                            !isActive && !isSelected && "hover:bg-muted/30 opacity-60"
                                        )}
                                    >
                                        {isSelected ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <X className="w-4 h-4 text-muted-foreground shrink-0" />}
                                        <span className="truncate">{col}</span>
                                        {!hasProfile && isSelected && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div className="p-3 border-t border-muted/40 text-xs text-muted-foreground bg-muted/20">
                        {selectedColumns.length} of {allColumns.length} selected
                    </div>
                </div>

                <div className="flex-1 border border-muted rounded-lg overflow-hidden">
                    <div className="h-full overflow-y-auto p-4">
                        {loading && !hasProfiles ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : error ? (
                            <div className="text-center text-destructive p-8">
                                <p>{error}</p>
                                <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchProfiling(selectedColumns)}>
                                    Retry
                                </Button>
                            </div>
                        ) : !hasProfiles ? (
                            <div className="text-center text-muted-foreground p-8">
                                No profiling data returned. Refresh or adjust column selection.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {selectedColumns.map((col) => {
                                    const profile = columnProfiles[col]
                                    if (!profile) return null
                                    return (
                                        <div
                                            key={col}
                                            className={cn("border border-muted rounded-lg p-4 space-y-3", activeColumn === col && "border-primary")}
                                            onClick={() => setActiveColumn(col)}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium">{col}</h4>
                                                    {profile.key_type === "primary_key" && (
                                                        <Badge variant="default" className="text-[10px] px-1.5 py-0">PK</Badge>
                                                    )}
                                                    {profile.key_type === "unique" && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">UNIQUE</Badge>
                                                    )}
                                                </div>
                                                <Badge variant="outline">
                                                    {profile.type_guess}
                                                    {profile.type_confidence && (
                                                        <span className="ml-1 opacity-70">{Math.round(profile.type_confidence * 100)}%</span>
                                                    )}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Null Rate:</span>
                                                    <span>{(profile.null_rate * 100).toFixed(1)}%</span>
                                                </div>
                                                {profile.unique_ratio !== undefined && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Unique:</span>
                                                        <span>{(profile.unique_ratio * 100).toFixed(1)}%</span>
                                                    </div>
                                                )}
                                            </div>
                                            {profile.rules && profile.rules.length > 0 && (
                                                <div className="text-xs">
                                                    <span className="text-muted-foreground">AI Rules: </span>
                                                    {profile.rules
                                                        .filter((r: any) => r.decision === "auto")
                                                        .map((r: any) => r.rule_id)
                                                        .join(", ")}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {hasProfiles && (
                            <div className="mt-4 border border-muted rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <h3 className="font-medium text-sm">Cross-column Rules</h3>
                                    <Badge variant="outline" className="text-xs">{crossFieldRules.length}</Badge>
                                </div>
                                {crossFieldRules.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No cross-field rules returned by DQ preview</p>
                                ) : (
                                    <div className="space-y-2">
                                        {crossFieldRules.map((rule, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                                                <span className="font-mono text-xs">{rule.rule_id}</span>
                                                <span className="text-muted-foreground">{rule.condition || rule.predicate}</span>
                                                <div className="flex gap-1">
                                                    {rule.cols?.map((c: string) => (
                                                        <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {requiredColumns.length > 0 && (
                <div className="px-4 py-3 bg-muted/30 border border-muted rounded-lg">
                    <div className="text-sm">
                        <span className="text-muted-foreground">Required Columns: </span>
                        <span className="font-medium">{requiredColumns.join(", ")}</span>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-muted/40 mt-6">
                <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
                <Button onClick={nextStep} disabled={!canProceed}>
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface JobDQStepProps {
    sourceProvider: string
    sourceCategory: string
    entity: string
    sourceConfig?: Record<string, string>
    authToken: string
    onBack: () => void
    onCreateJob: (dqConfig: DQConfig) => void
    isCreating?: boolean
}

// ─── Inner component (requires WizardContext) ─────────────────────────────────

function JobDQStepInner({
    sourceProvider,
    sourceCategory,
    entity,
    sourceConfig,
    authToken,
    onBack,
    onCreateJob,
    isCreating,
}: JobDQStepProps) {
    const wizard = useProcessingWizard()
    const [fieldsLoading, setFieldsLoading] = useState(true)
    const [fieldsError, setFieldsError] = useState<string | null>(null)
    const [initialized, setInitialized] = useState(false)
    const prevStepRef = useRef(wizard.step)

    // Fetch entity fields and initialize the wizard
    useEffect(() => {
        if (initialized) return

        let cancelled = false
        setFieldsLoading(true)
        setFieldsError(null)

        const fetchFields = async () => {
            try {
                const params: Record<string, string> = { ...(sourceConfig || {}) }
                const res = await connectorsAPI.getEntityFields(
                    sourceProvider,
                    entity,
                    Object.keys(params).length > 0 ? params : undefined,
                )

                if (cancelled) return

                const fields = res.fields || []
                const fieldNames = fields.map((f) => f.key).filter(Boolean)

                if (fieldNames.length === 0) {
                    setFieldsError("No fields discovered for this entity. DQ configuration will use default settings.")
                    wizard.initializeWithFile("job-preview", entity, [], authToken)
                } else {
                    wizard.initializeWithFile("job-preview", entity, fieldNames, authToken)

                    // Set column core types from field type mapping after init
                    for (const field of fields) {
                        const dqType = FIELD_TYPE_TO_DQ_TYPE[field.data_type?.toLowerCase() || "string"] || "text"
                        wizard.setColumnCoreType(field.key, dqType)
                    }
                }

                setInitialized(true)
            } catch (err: any) {
                if (!cancelled) {
                    console.error("[job-dq-step] Failed to fetch entity fields:", err)
                    setFieldsError(err?.message || "Failed to discover entity fields")
                    wizard.initializeWithFile("job-preview", entity, [], authToken)
                    setInitialized(true)
                }
            } finally {
                if (!cancelled) setFieldsLoading(false)
            }
        }

        fetchFields()
        return () => { cancelled = true }
    }, [sourceProvider, entity, sourceConfig, authToken, initialized])

    // Intercept wizard step transitions to implement custom step order
    useEffect(() => {
        const curr = wizard.step
        prevStepRef.current = curr

        // columns → prevStep: go back to job config (step 1)
        // The ColumnSelectionStep doesn't have a prevStep call (only nextStep),
        // but if the user navigates back manually we handle it in the rules step below.

        // rules → nextStep → "process": intercept to trigger job creation
        if (curr === "process") {
            wizard.setStep("rules") // stay on rules, trigger create
            handleCreateJob()
            return
        }
    }, [wizard.step])

    const handleCreateJob = useCallback(() => {
        // Extract DQ config from wizard state
        const rulesEnabled: Record<string, boolean> = {}
        for (const [_col, rules] of Object.entries(wizard.columnRules)) {
            for (const rule of rules) {
                rulesEnabled[rule.rule_id] = rule.selected
            }
        }
        for (const rule of wizard.globalRules) {
            rulesEnabled[rule.rule_id] = rule.selected
        }

        const hasCustomRules = Object.keys(rulesEnabled).length > 0
        const presetId = wizard.selectedPreset?.preset_id

        const dqConfig: DQConfig = {
            mode: hasCustomRules || (presetId && presetId !== "default_dq_rules") ? "custom" : "default",
            columns: wizard.selectedColumns.length > 0 ? wizard.selectedColumns : null,
            rules_enabled: hasCustomRules ? rulesEnabled : null,
            preset_id: presetId || null,
            policies: {
                allow_autofix: wizard.presetOverrides?.policies?.allow_autofix ??
                    wizard.selectedPreset?.config?.policies?.allow_autofix ?? true,
                strictness: wizard.presetOverrides?.policies?.strictness ??
                    wizard.selectedPreset?.config?.policies?.strictness ?? "balanced",
            },
        }

        onCreateJob(dqConfig)
    }, [wizard, onCreateJob])

    if (fieldsLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60 mb-4" />
                <p className="text-sm">Discovering entity fields...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                    Fetching schema for {entity} from {sourceProvider}
                </p>
            </div>
        )
    }

    // Determine which step component to render based on wizard.step
    // (after interception redirects, wizard.step will be columns/settings/rules)
    return (
        <div className="flex flex-col h-full">
            {fieldsError && (
                <div className="mx-6 mt-3 p-3 rounded-lg border border-amber-500/25 bg-amber-500/5 text-sm text-amber-700">
                    {fieldsError}
                </div>
            )}

            <div className="flex-1 overflow-hidden">
                {wizard.step === "columns" && <ColumnSelectionStep />}
                {wizard.step === "profiling" && (
                    <JobProfilingStep
                        sourceProvider={sourceProvider}
                        sourceCategory={sourceCategory}
                        entity={entity}
                        sourceConfig={sourceConfig}
                    />
                )}
                {wizard.step === "settings" && <SettingsStep />}
                {wizard.step === "rules" && <RulesStep />}
            </div>

            {/* Show creating overlay when submitting */}
            {isCreating && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Creating job...</p>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Wrapper with WizardProvider ──────────────────────────────────────────────

export function JobDQStep(props: JobDQStepProps) {
    return (
        <ProcessingWizardProvider>
            <JobDQStepInner {...props} />
        </ProcessingWizardProvider>
    )
}
