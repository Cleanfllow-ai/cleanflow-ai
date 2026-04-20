"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarClock, Check, Settings2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { useToast } from "@/shared/hooks/use-toast"
import { useAuth } from "@/modules/auth"

import { JobConfigStep } from "./job-config-step"
import { JobDQStep } from "./job-dq-step"
import { useJobDialog } from "./use-job-dialog"
import {
    jobsAPI,
    frequencyToBackend,
} from "@/modules/jobs/api/jobs-api"
import type { DQConfig } from "@/modules/jobs/types/jobs.types"

// ─── Stepper steps ────────────────────────────────────────────────────────────

type StepperStep = "config" | "dq"

const STEPPER_STEPS: { key: StepperStep; label: string; icon: React.ReactNode }[] = [
    { key: "config", label: "Job Configuration", icon: <Settings2 className="h-4 w-4" /> },
    { key: "dq", label: "DQ Configuration", icon: <Sparkles className="h-4 w-4" /> },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function JobCreationStepper() {
    const router = useRouter()
    const { toast } = useToast()
    const { idToken, getValidToken } = useAuth()
    const [currentStep, setCurrentStep] = useState<StepperStep>("config")
    const [isCreating, setIsCreating] = useState(false)
    const [advancedDQ, setAdvancedDQ] = useState(false)

    // Reuse the existing job dialog hook for step 1 state
    // We pass open=true to trigger data fetching
    const d = useJobDialog({ open: true, job: null, onSuccess: () => {} })

    const visibleSteps = advancedDQ ? STEPPER_STEPS : [STEPPER_STEPS[0]]
    const currentIndex = visibleSteps.findIndex((s) => s.key === currentStep)

    // ── Step 1 → Step 2 ──────────────────────────────────────────────────────

    const handleNextToStep2 = useCallback(() => {
        // Validate step 1 fields
        if (!d.name.trim()) {
            toast({ title: "Name required", description: "Please enter a job name", variant: "destructive" })
            return
        }
        if (!d.sourceProvider) {
            toast({ title: "Source required", description: "Please select a source provider", variant: "destructive" })
            return
        }
        if (!d.destinationProvider) {
            toast({ title: "Destination required", description: "Please select a destination provider", variant: "destructive" })
            return
        }
        if (d.entities.length === 0) {
            toast({ title: "Entity required", description: "Please select at least one entity", variant: "destructive" })
            return
        }
        if (d.frequency === "cron" && !d.cronExpression.trim()) {
            toast({ title: "Cron expression required", variant: "destructive" })
            return
        }

        setCurrentStep("dq")
    }, [d, toast])

    // ── Step 2 → Create Job ──────────────────────────────────────────────────

    const handleCreateJob = useCallback(async (dqConfig: DQConfig) => {
        setIsCreating(true)
        try {
            const freqBackend = frequencyToBackend(d.frequency, d.cronExpression.trim())

            // Merge DQ policy from step 1 DQ config fields
            const finalDqConfig: Record<string, any> = {
                ...dqConfig,
                policy: d.dqPolicy,
            }

            const payload: Record<string, any> = {
                name: d.name.trim(),
                source_provider: d.sourceProvider,
                source_category: d.sourceCategory,
                destination_provider: d.destinationProvider,
                destination_category: d.destinationCategory,
                entities: d.entities,
                ...freqBackend,
                dq_config: finalDqConfig,
            }

            if (d.dqPolicy === "block_and_notify" && d.responsibleUserId) {
                payload.responsible_user_id = d.responsibleUserId
            }

            if (Object.keys(d.sourceConfig).length > 0) {
                payload.source_config = d.sourceConfig
            }
            if (Object.keys(d.destinationConfig).length > 0) {
                payload.destination_config = d.destinationConfig
            }
            if (Object.keys(d.columnMapping).length > 0) {
                payload.column_mapping = d.columnMapping
            }

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
    }, [d, router, toast])

    // ── Direct creation (default DQ) ─────────────────────────────────────────

    const handleCreateDirect = useCallback(async () => {
        if (!d.name.trim()) {
            toast({ title: "Name required", variant: "destructive" })
            return
        }
        if (!d.sourceProvider || !d.destinationProvider || d.entities.length === 0) {
            toast({ title: "Incomplete", description: "Fill in all required fields", variant: "destructive" })
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
    }, [d, toast, handleCreateJob])

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
                                        {visibleSteps.length === 1 ? "Configuration" : `Step ${index + 1} of ${visibleSteps.length}`}
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
                {currentStep === "config" && (
                    <JobConfigStep
                        d={d}
                        onNext={handleNextToStep2}
                        advancedDQ={advancedDQ}
                        onAdvancedDQChange={setAdvancedDQ}
                        onCreateDirect={handleCreateDirect}
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
