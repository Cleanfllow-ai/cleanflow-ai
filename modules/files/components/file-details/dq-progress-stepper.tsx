"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { FileStatusResponse } from "@/modules/files"

/**
 * W5A-1 — Stage-aware DQ progress stepper.
 *
 * Persona Marcus: "While DQ is running on a 5GB file I have no idea what
 * stage it's at. It's just a spinner for 90 seconds."
 *
 * The BE doesn't expose granular stage in GET /uploads/{id}. We derive the
 * active step from (status, elapsed_since_last_status_change). The mapping:
 *
 *   1. Queued      — status = DQ_DISPATCHED (always)
 *   2. Manager     — status = DQ_RUNNING + elapsed ≤ 5s
 *   3. Workers     — status = DQ_RUNNING + elapsed ∈ (5s, 60% of est)
 *   4. Materialize — status = DQ_RUNNING + elapsed ∈ (60%, 90% of est)
 *   5. Done        — status = DQ_FIXED
 *
 * If we don't know the estimated duration, we fall back to a simple
 * elapsed-time bucket: 5s/60s/90s. The stepper is intentionally optimistic —
 * the worst it can do is show "Workers" when the real stage is actually
 * "Materialize". Both are accurate enough to remove the "blank spinner"
 * feeling that drove Marcus's complaint.
 */

interface DqProgressStepperProps {
  file: FileStatusResponse
}

type StepState = "done" | "active" | "pending"

interface Step {
  id: string
  label: string
  state: StepState
}

const STAGE_NAMES = ["Queued", "Manager", "Workers", "Materialize", "Done"] as const

function computeActiveIndex(
  status: string,
  elapsedSeconds: number,
  estimatedSeconds: number,
): number {
  const s = (status || "").toUpperCase()

  if (s === "DQ_FIXED" || s === "COMPLETED" || s === "DQ_COMPLETE" || s === "PROCESSED") {
    return 4 // Done
  }
  if (s === "DQ_DISPATCHED" || s === "QUEUED") {
    return 0 // Queued
  }
  if (s === "DQ_RUNNING" || s === "NORMALIZING") {
    // Within DQ_RUNNING we use elapsed time to estimate sub-stage.
    // Manager phase is short and bounded (≤5s in practice).
    if (elapsedSeconds < 5) return 1 // Manager
    // Workers vs Materialize: 60% / 90% of the estimated duration if we have
    // one. Falls back to absolute 60s / 90s if we don't.
    const workerEnd = estimatedSeconds > 0 ? estimatedSeconds * 0.6 : 60
    const materializeEnd = estimatedSeconds > 0 ? estimatedSeconds * 0.9 : 90
    if (elapsedSeconds < workerEnd) return 2 // Workers
    if (elapsedSeconds < materializeEnd) return 3 // Materialize
    return 3 // Stay on Materialize if we've run past the estimate
  }
  return 0
}

function getRecencyAnchor(file: FileStatusResponse): number {
  // We prefer status_timestamp if present (BE writes this when the DQ stage
  // transitions), else updated_at, else created_at. None of these are exact
  // "dq_started_at" -- the BE doesn't expose that today -- but updated_at is
  // a reasonable proxy since it changes on every status transition.
  const sources = [file.status_timestamp, file.updated_at, file.uploaded_at, file.created_at]
  for (const src of sources) {
    if (!src) continue
    const t = Date.parse(src)
    if (Number.isFinite(t)) return t
  }
  return Date.now()
}

export function DqProgressStepper({ file }: DqProgressStepperProps) {
  // Re-render every second so the active stage advances visibly while the
  // user is sitting on the dialog. We only mount this component when the
  // upload is in-flight, so the timer dies as soon as the status settles.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const anchorMs = getRecencyAnchor(file)
  const elapsedSeconds = Math.max(0, (Date.now() - anchorMs) / 1000)
  const estimatedSeconds = typeof file.processing_time_seconds === "number"
    ? file.processing_time_seconds
    : 0

  const activeIdx = computeActiveIndex(file.status || "", elapsedSeconds, estimatedSeconds)

  const steps: Step[] = STAGE_NAMES.map((label, i) => ({
    id: label.toLowerCase(),
    label,
    state: i < activeIdx ? "done" : i === activeIdx ? "active" : "pending",
  }))

  return (
    <div
      data-testid="dq-progress-stepper"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={STAGE_NAMES.length - 1}
      aria-valuenow={activeIdx}
      aria-label={`DQ pipeline progress: ${STAGE_NAMES[activeIdx]}`}
      className="rounded-lg border border-border bg-muted/30 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          DQ Pipeline
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          Stage: <span className="text-foreground">{STAGE_NAMES[activeIdx]}</span>
          {elapsedSeconds > 1 && activeIdx < 4 && (
            <span className="ml-2 tabular-nums text-muted-foreground/70">
              {Math.floor(elapsedSeconds)}s elapsed
            </span>
          )}
        </span>
      </div>
      <ol className="flex items-center gap-1.5">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          return (
            <li
              key={step.id}
              data-step-id={step.id}
              data-step-state={step.state}
              aria-current={step.state === "active" ? "step" : undefined}
              className="flex items-center flex-1 min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    step.state === "done" &&
                      "border-emerald-500 bg-emerald-500 text-white",
                    step.state === "active" &&
                      "border-primary bg-primary/10 text-primary",
                    step.state === "pending" &&
                      "border-border bg-background text-muted-foreground/50",
                  )}
                >
                  {step.state === "done" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : step.state === "active" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    step.state === "done" && "text-emerald-700 dark:text-emerald-400",
                    step.state === "active" && "text-foreground",
                    step.state === "pending" && "text-muted-foreground/60",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "ml-2 h-[2px] flex-1 rounded-full transition-colors",
                    step.state === "done"
                      ? "bg-emerald-500"
                      : step.state === "active"
                      ? "bg-gradient-to-r from-primary to-border"
                      : "bg-border",
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground/80">
        {activeIdx === 0 && "Your upload is queued and will start shortly."}
        {activeIdx === 1 && "Planning shard layout and verifying KMS-signed plan."}
        {activeIdx === 2 && "Parallel workers are evaluating DQ rules against your data."}
        {activeIdx === 3 && "Merging shard results and writing the final dataset."}
        {activeIdx === 4 && "All stages complete. Results are ready to review."}
      </p>
    </div>
  )
}
