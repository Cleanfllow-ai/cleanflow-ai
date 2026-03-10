"use client"

import React from "react"
import { cn } from "@/shared/lib/utils"
import { Check, Circle, ChevronRight } from "lucide-react"
import { useProcessingWizard, STEP_ORDER, type WizardStep } from "./WizardContext"
import { ColumnSelectionStep } from "./steps/ColumnSelectionStep"
import { ProfilingStep } from "./steps/ProfilingStep"
import { SettingsStep } from "./steps/SettingsStep"
import { RulesStep } from "./steps/RulesStep"
import { ProcessStep } from "./steps/ProcessStep"

const STEP_LABELS: Record<WizardStep, string> = {
    columns: "Select Columns",
    profiling: "Profiling",
    settings: "Settings",
    rules: "Rules",
    process: "Process",
}

interface ProcessingWizardProps {
    onClose?: () => void
    onComplete?: () => void
    onStarted?: () => void
}

export function ProcessingWizard({ onClose, onComplete, onStarted }: ProcessingWizardProps) {
    const { step } = useProcessingWizard()
    const currentIndex = STEP_ORDER.indexOf(step)

    return (
        <div className="flex flex-col h-full max-h-[85vh]">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-muted/40 bg-muted/20">
                {STEP_ORDER.map((s, index) => {
                    const isActive = s === step
                    const isCompleted = index < currentIndex
                    const isLast = index === STEP_ORDER.length - 1

                    return (
                        <React.Fragment key={s}>
                            <div className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                                        isActive && "bg-primary text-primary-foreground",
                                        isCompleted && "bg-green-600 text-white",
                                        !isActive && !isCompleted && "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>
                                <span
                                    className={cn(
                                        "text-sm hidden sm:inline",
                                        isActive && "text-foreground font-medium",
                                        !isActive && "text-muted-foreground"
                                    )}
                                >
                                    {STEP_LABELS[s]}
                                </span>
                            </div>
                            {!isLast && (
                                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                            )}
                        </React.Fragment>
                    )
                })}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-hidden">
                {step === "columns" && <ColumnSelectionStep />}
                {step === "profiling" && <ProfilingStep />}
                {step === "settings" && <SettingsStep />}
                {step === "rules" && <RulesStep />}
                {step === "process" && (
                    <ProcessStep onComplete={onComplete} onStarted={onStarted} />
                )}
            </div>
        </div>
    )
}
