"use client"

/**
 * WelcomeTour — first-time-user onboarding tour for RightRev.
 *
 * Strategy: single-page tour anchored to the dashboard + sidebar elements.
 * No cross-page navigation needed — sidebar links are visible on every
 * authenticated page, so we can reference them wherever the tour is mounted.
 *
 * Storage: localStorage key "rightrev:tour:completed:v1"
 * Library:  @reactour/tour 3.8.0
 */

import React, { useCallback, useEffect } from "react"
import { TourProvider, useTour, type StepType, type PopoverContentProps } from "@reactour/tour"
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react"
import { cn } from "@/shared/lib/utils"

// ─── Step definitions ────────────────────────────────────────────────────────

const TOUR_STEPS: StepType[] = [
  {
    // Step 1 — Welcome (anchored to logo; shown as centred modal)
    selector: "[data-tour='logo']",
    content: "welcome",
    position: "center",
    padding: { mask: 0 },
  },
  {
    // Step 2 — Dashboard KPI cards
    selector: "[data-tour='kpi-cards']",
    content: "kpi",
    position: "bottom",
  },
  {
    // Step 3 — Data Catalog sidebar link
    selector: "[data-tour='nav-data-catalog']",
    content: "catalog",
    position: "right",
  },
  {
    // Step 4 — Upload / connect a source (same anchor, different copy)
    selector: "[data-tour='nav-data-catalog']",
    content: "upload",
    position: "right",
  },
  {
    // Step 5 — Augmentation sidebar link
    selector: "[data-tour='nav-augmentation']",
    content: "augmentation",
    position: "right",
  },
  {
    // Step 6 — Jobs sidebar link
    selector: "[data-tour='nav-jobs']",
    content: "jobs",
    position: "right",
  },
  {
    // Step 7 — Admin sidebar link
    selector: "[data-tour='nav-admin']",
    content: "admin",
    position: "right",
  },
  {
    // Step 8 — Done (centred modal)
    selector: "[data-tour='logo']",
    content: "done",
    position: "center",
    padding: { mask: 0 },
  },
]

// ─── Step copy ───────────────────────────────────────────────────────────────

type StepKey = "welcome" | "kpi" | "catalog" | "upload" | "augmentation" | "jobs" | "admin" | "done"

interface StepCopy {
  title: string
  body: string
  isModal?: boolean
}

const STEP_COPY: Record<StepKey, StepCopy> = {
  welcome: {
    title: "Welcome to RightRev",
    body: "We help your team catch data quality issues before they reach your books. Let's take 60 seconds to show you around.",
    isModal: true,
  },
  kpi: {
    title: "Your dashboard at a glance",
    body: "Track rows processed, files completed, and data quality trends — all updated in real time so you always know where things stand.",
  },
  catalog: {
    title: "Data Catalog",
    body: "Drop in your subscription, invoice, or revenue files here. We profile them, flag bad rows, and let you fix issues without writing any code.",
  },
  upload: {
    title: "Upload or connect a source",
    body: "Import a CSV, Excel, JSON, or TXT file — or connect directly to QuickBooks, Snowflake, Google Drive, and more.",
  },
  augmentation: {
    title: "Data Augmentation",
    body: "Reshape your data with AI — group rows, derive new columns, or enrich with context. Designed for finance teams; no formulas required.",
  },
  jobs: {
    title: "Scheduled Jobs",
    body: "Schedule recurring pulls from your ERP or warehouse. Set it once and RightRev will keep your data fresh automatically.",
  },
  admin: {
    title: "Admin & Settings",
    body: "Manage your team, connectors, and approval workflows — all in one place. Role-based access keeps the right people in the right seats.",
  },
  done: {
    title: "You're ready to go",
    body: "If you ever want to revisit this tour, find it under Help & Support in the sidebar.",
    isModal: true,
  },
}

// ─── Sync component: bridge external isOpen → TourProvider internal state ────

interface TourSyncProps {
  isOpen: boolean
  currentStep: number
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>
  onComplete: () => void
  onSkip: () => void
}

function TourSync({ isOpen, currentStep: externalStep, setCurrentStep, onComplete, onSkip }: TourSyncProps) {
  const { setIsOpen, setCurrentStep: providerSetStep, isOpen: providerOpen } = useTour()

  // Sync external open signal → provider
  useEffect(() => {
    if (isOpen !== providerOpen) {
      setIsOpen(isOpen)
    }
  }, [isOpen, providerOpen, setIsOpen])

  // Sync external step → provider
  useEffect(() => {
    providerSetStep(externalStep)
  }, [externalStep, providerSetStep])

  return null
}

// ─── Custom popover content ───────────────────────────────────────────────────

interface TourContentProps extends PopoverContentProps {
  onComplete: () => void
  onSkip: () => void
  externalSetStep: React.Dispatch<React.SetStateAction<number>>
}

function TourContent({
  currentStep,
  setCurrentStep,
  setIsOpen,
  steps,
  onComplete,
  onSkip,
  externalSetStep,
}: TourContentProps) {
  const stepContent = steps[currentStep]?.content as StepKey | undefined
  const copy = stepContent && STEP_COPY[stepContent] ? STEP_COPY[stepContent] : null
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const handleClose = useCallback(() => {
    onSkip()
  }, [onSkip])

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete()
    } else {
      const next = currentStep + 1
      setCurrentStep(next)
      externalSetStep(next)
    }
  }, [isLast, onComplete, currentStep, setCurrentStep, externalSetStep])

  const handlePrev = useCallback(() => {
    const prev = Math.max(0, currentStep - 1)
    setCurrentStep(prev)
    externalSetStep(prev)
  }, [currentStep, setCurrentStep, externalSetStep])

  const handleWatchAgain = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("rightrev:tour:completed:v1")
    }
    setCurrentStep(0)
    externalSetStep(0)
  }, [setCurrentStep, externalSetStep])

  if (!copy) return null

  const isModal = copy.isModal ?? false
  const nonModalSteps = steps.length - 2 // exclude welcome + done

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl shadow-xl text-foreground",
        isModal ? "w-[380px] max-w-[90vw] p-6" : "w-[320px] max-w-[85vw] p-5",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-step-${currentStep}-title`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          {isModal && (
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
          )}
          <h2
            id={`tour-step-${currentStep}-title`}
            className={cn(
              "font-semibold leading-snug text-foreground",
              isModal ? "text-[15px]" : "text-[14px]",
            )}
          >
            {copy.title}
          </h2>
        </div>

        <button
          onClick={handleClose}
          aria-label="Skip tour"
          className="flex-shrink-0 -mt-0.5 -mr-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">{copy.body}</p>

      {/* Progress indicator for middle steps */}
      {!isModal && !isFirst && !isLast && (
        <div
          className="flex items-center gap-1 mb-4"
          role="group"
          aria-label={`Step ${currentStep} of ${nonModalSteps}`}
        >
          {Array.from({ length: nonModalSteps }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const target = i + 1
                setCurrentStep(target)
                externalSetStep(target)
              }}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                "rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                i === currentStep - 1
                  ? "w-4 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-border hover:bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      {isFirst ? (
        <div className="flex gap-2">
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Start the tour"
            autoFocus
          >
            Start
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={handleClose}
            className="flex-1 h-8 px-4 rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Skip tour for now"
          >
            Skip for now
          </button>
        </div>
      ) : isLast ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={onComplete}
            className="w-full h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Start using RightRev"
            autoFocus
          >
            Start using RightRev
          </button>
          <button
            onClick={handleWatchAgain}
            className="w-full h-8 px-4 rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Watch the tour again from the beginning"
          >
            Watch tour again
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handlePrev}
            className="flex items-center gap-1 h-7 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous step"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden="true" />
            Back
          </button>

          <span className="text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
            {currentStep} / {nonModalSteps}
          </span>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Next step"
          >
            Next
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface WelcomeTourProps {
  isOpen: boolean
  currentStep: number
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>
  onComplete: () => void
  onSkip: () => void
}

export function WelcomeTour({
  isOpen,
  currentStep,
  setCurrentStep,
  onComplete,
  onSkip,
}: WelcomeTourProps) {
  return (
    <TourProvider
      steps={TOUR_STEPS}
      defaultOpen={false}
      startAt={0}
      showBadge={false}
      showNavigation={false}
      showCloseButton={false}
      showDots={false}
      disableInteraction={false}
      padding={8}
      scrollSmooth
      onClickMask={() => {
        // Intentionally block accidental mask-click dismissal
      }}
      ContentComponent={(props) => (
        <TourContent
          {...props}
          onComplete={onComplete}
          onSkip={onSkip}
          externalSetStep={setCurrentStep}
        />
      )}
      styles={{
        maskArea: (base) => ({ ...base, rx: 8 }),
        popover: (base) => ({
          ...base,
          padding: 0,
          background: "transparent",
          boxShadow: "none",
          maxWidth: "none",
        }),
        svgWrapper: (base) => ({ ...base, opacity: 0.55 }),
      }}
    >
      <TourSync
        isOpen={isOpen}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onComplete={onComplete}
        onSkip={onSkip}
      />
    </TourProvider>
  )
}
