"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarClock, Check, Settings2, Sparkles, Workflow, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { useToast } from "@/shared/hooks/use-toast"
import { useAuth } from "@/modules/auth"

import { JobConfigStep } from "./job-config-step"
import { JobDQStep } from "./job-dq-step"
import { EndpointsStep } from "./endpoints-step"
import { MappingStep } from "./mapping-step"
import { usePipelineBuilder } from "./use-pipeline-builder"
import {
    jobsAPI,
    frequencyToBackend,
} from "@/modules/jobs/api/jobs-api"
import type { DQConfig } from "@/modules/jobs/types/jobs.types"

// ─── Stepper steps ────────────────────────────────────────────────────────────

type StepperStep = "endpoints" | "config" | "mapping" | "dq"

const STEPPER_STEPS: { key: StepperStep; label: string; icon: React.ReactNode }[] = [
    { key: "endpoints", label: "Source & Destination", icon: <Workflow className="h-4 w-4" /> },
    { key: "mapping", label: "Field Mapping", icon: <Wand2 className="h-4 w-4" /> },
    { key: "config", label: "Job Configuration", icon: <Settings2 className="h-4 w-4" /> },
    { key: "dq", label: "DQ Configuration", icon: <Sparkles className="h-4 w-4" /> },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function JobCreationStepper() {
    const router = useRouter()
    const { toast } = useToast()
    const { idToken } = useAuth()
    const [currentStep, setCurrentStep] = useState<StepperStep>("endpoints")
    const [isCreating, setIsCreating] = useState(false)
    const [advancedDQ, setAdvancedDQ] = useState(false)

    // The new pipeline builder COMPOSES the legacy useJobDialog hook.
    // `pipeline.dialog` is the legacy hook surface (still used by JobConfigStep).
    const pipeline = usePipelineBuilder({ open: true, job: null, onSuccess: () => {} })
    const d = pipeline.dialog

    // Visible steps: mapping is unconditional; DQ is gated by advancedDQ.
    const visibleSteps = advancedDQ
        ? STEPPER_STEPS
        : STEPPER_STEPS.filter(s => s.key !== "dq")
    const currentIndex = visibleSteps.findIndex((s) => s.key === currentStep)

    // ── Step transitions ─────────────────────────────────────────────────────

    const handleEndpointsNext = useCallback(() => {
        if (pipeline.pipelineSteps.length === 0) {
            toast({ title: "Pipeline incomplete", description: "Configure at least one source-destination pair", variant: "destructive" })
            return
        }
        setCurrentStep("mapping")
    }, [pipeline.pipelineSteps.length, toast])

    const handleMappingNext = useCallback(() => {
        // After mapping, always proceed to job configuration (name/schedule/owner).
        setCurrentStep("config")
    }, [])

    const handleConfigNext = useCallback(() => {
        if (!d.name.trim()) {
            toast({ title: "Name required", description: "Please enter a job name", variant: "destructive" })
            return
        }
        if (d.frequency === "cron" && !d.cronExpression.trim()) {
            toast({ title: "Cron expression required", variant: "destructive" })
            return
        }
        // If user opted-in to Advanced DQ (toggle lives in MappingStep), head to DQ step.
        // Otherwise create the job directly with default DQ.
        if (advancedDQ) {
            setCurrentStep("dq")
        } else {
            void handleCreateDirect()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [d.name, d.frequency, d.cronExpression, advancedDQ, toast])

    // ── Build payload (with pipeline_steps[]) ────────────────────────────────

    const buildPayload = useCallback((dqConfig: DQConfig): Record<string, any> => {
        const freqBackend = frequencyToBackend(d.frequency, d.cronExpression.trim())

        const finalDqConfig: Record<string, any> = {
            ...dqConfig,
            policy: d.dqPolicy,
        }

        // Primary source/dest mirror the first pipeline step for backwards compat.
        const firstStep = pipeline.pipelineSteps[0]
        const allSourceEntities = Array.from(new Set(
            pipeline.pipelineSteps.map(s => s.source_entity).filter(Boolean),
        ))

        const payload: Record<string, any> = {
            name: d.name.trim(),
            source_provider: firstStep?.source_provider || d.sourceProvider,
            source_category: firstStep?.source_category || d.sourceCategory,
            destination_provider: firstStep?.dest_provider || d.destinationProvider,
            destination_category: firstStep?.dest_category || d.destinationCategory,
            entities: allSourceEntities.length > 0 ? allSourceEntities : d.entities,
            ...freqBackend,
            dq_config: finalDqConfig,
            // NEW — multi-cardinality pipeline payload (Agent 2's contract).
            pipeline_steps: pipeline.buildPipelineStepsPayload(),
        }

        if (d.dqPolicy === "block_and_notify" && d.responsibleUserId) {
            payload.responsible_user_id = d.responsibleUserId
        }

        if (firstStep?.source_config && Object.keys(firstStep.source_config).length > 0) {
            payload.source_config = firstStep.source_config
        }
        if (firstStep?.dest_config && Object.keys(firstStep.dest_config).length > 0) {
            payload.destination_config = firstStep.dest_config
        }

        // Legacy column_mapping field — populate from the FIRST pair so existing
        // 1:1 readers (migration in flight) still work. Multi-pair clients should
        // read pipeline_steps[].inline_mapping instead.
        const firstMapping = firstStep ? pipeline.mappingsByPair[firstStep.step_id]?.column_mapping : null
        if (firstMapping && Object.keys(firstMapping).length > 0) {
            payload.column_mapping = firstMapping
        }

        return payload
    }, [pipeline, d])

    const handleCreateJob = useCallback(async (dqConfig: DQConfig) => {
        setIsCreating(true)
        try {
            const payload = buildPayload(dqConfig)
            const created = await jobsAPI.createJob(payload as any)

            if (d.frequency === "batch" && created?.job_id) {
                toast({ title: "Batch Job Created", description: `${d.name} -- triggering transfer now...` })
                try {
                    await jobsAPI.triggerJob(created.job_id)
                    toast({ title: "Batch Transfer Started", description: `${d.name} is now running` })
                } catch (triggerErr: any) {
                    toast({
                        title: "Trigger failed",
                        description: triggerErr?.message || "Job created but trigger failed",
                        variant: "destructive",
                    })
                }
            } else {
                toast({ title: "Job Created", description: `${d.name} has been created and scheduled` })
            }

            router.push("/jobs")
        } catch (err: any) {
            toast({
                title: "Creation failed",
                description: err?.message || "Something went wrong",
                variant: "destructive",
            })
        } finally {
            setIsCreating(false)
        }
    }, [buildPayload, d.frequency, d.name, router, toast])

    // ── Direct creation (default DQ) ─────────────────────────────────────────

    const handleCreateDirect = useCallback(async () => {
        if (!d.name.trim()) {
            toast({ title: "Name required", variant: "destructive" })
            return
        }
        if (pipeline.pipelineSteps.length === 0) {
            toast({ title: "Incomplete", description: "Configure at least one source-destination pair", variant: "destructive" })
            return
        }
        if (d.frequency === "cron" && !d.cronExpression.trim()) {
            toast({ title: "Cron expression required", variant: "destructive" })
            return
        }

        const defaultDqConfig: DQConfig = {
            mode: "default",
            columns: null,
            rules_enabled: null,
            preset_id: null,
            policies: {
                allow_autofix: true,
                strictness: "balanced",
            },
        }
        await handleCreateJob(defaultDqConfig)
    }, [d.name, d.frequency, d.cronExpression, pipeline.pipelineSteps.length, toast, handleCreateJob])

    // ── Build source config params for DQ step ───────────────────────────────

    const sourceConfigParams: Record<string, string> = {}
    if (d.sourceConfig.database) sourceConfigParams.database = d.sourceConfig.database
    if (d.sourceConfig.schema) sourceConfigParams.schema = d.sourceConfig.schema
    if (d.sourceConfig.warehouse) sourceConfigParams.warehouse = d.sourceConfig.warehouse

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
                <div className="flex items-center gap-3.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/jobs")}
                        className="h-10 w-10 rounded-xl hover:bg-muted/50"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                        <CalendarClock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1
                            className="text-xl font-semibold tracking-wider uppercase text-foreground"
                            style={{ fontFamily: "'Outfit', var(--font-sans, system-ui, sans-serif)" }}
                        >
                            Create Job
                        </h1>
                        <p className="text-[13px] text-muted-foreground mt-0.5">
                            Configure a new automated data sync job
                        </p>
                    </div>
                </div>
            </div>

            {/* Top-level step indicator */}
            <div className="flex items-center justify-center gap-4 px-6 py-4 border-b border-border/40 bg-muted/10">
                {visibleSteps.map((s, index) => {
                    const isActive = s.key === currentStep
                    const isCompleted = index < currentIndex

                    return (
                        <div key={s.key} className="flex items-center gap-3">
                            <button
                                type="button"
                                className={cn(
                                    "flex items-center gap-2.5",
                                    isCompleted && "cursor-pointer hover:opacity-80",
                                    !isCompleted && !isActive && "cursor-default"
                                )}
                                onClick={() => {
                                    if (isCompleted) setCurrentStep(s.key)
                                }}
                                disabled={!isCompleted}
                            >
                                <div
                                    className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                                        isActive && "bg-primary text-primary-foreground shadow-sm",
                                        isCompleted && "bg-green-600 text-white",
                                        !isActive && !isCompleted && "bg-muted text-muted-foreground border border-border/50"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        s.icon
                                    )}
                                </div>
                                <div className="flex flex-col text-left">
                                    <span
                                        className={cn(
                                            "text-[10px] uppercase tracking-widest",
                                            isActive ? "text-primary" : "text-muted-foreground/60"
                                        )}
                                    >
                                        {`Step ${index + 1} of ${visibleSteps.length}`}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-sm font-medium",
                                            isActive && "text-foreground",
                                            isCompleted && "text-green-600",
                                            !isActive && !isCompleted && "text-muted-foreground"
                                        )}
                                    >
                                        {s.label}
                                    </span>
                                </div>
                            </button>
                            {index < visibleSteps.length - 1 && (
                                <div className={cn(
                                    "w-16 h-px ml-2",
                                    isCompleted ? "bg-green-600" : "bg-border/60"
                                )} />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-hidden">
                {currentStep === "endpoints" && (
                    <EndpointsStep pipeline={pipeline} onNext={handleEndpointsNext} />
                )}
                {currentStep === "mapping" && (
                    <MappingStep
                        pipeline={pipeline}
                        onBack={() => setCurrentStep("endpoints")}
                        onNext={handleMappingNext}
                        isFinalStep={false /* config step always follows mapping */}
                        isCreating={isCreating}
                        advancedDQ={advancedDQ}
                        onAdvancedDQChange={setAdvancedDQ}
                    />
                )}
                {currentStep === "config" && (
                    <JobConfigStep
                        d={d}
                        onNext={handleConfigNext}
                        advancedDQ={advancedDQ}
                        isCreating={isCreating}
                    />
                )}
                {currentStep === "dq" && (
                    <JobDQStep
                        sourceProvider={d.sourceProvider}
                        sourceCategory={d.sourceCategory}
                        entity={d.entities[0] || ""}
                        sourceConfig={Object.keys(sourceConfigParams).length > 0 ? sourceConfigParams : undefined}
                        authToken={idToken || ""}
                        onBack={() => setCurrentStep("config")}
                        onCreateJob={handleCreateJob}
                        isCreating={isCreating}
                    />
                )}
            </div>
        </div>
    )
}
