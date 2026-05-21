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
 *
 * Step order (re-prioritised 2026-05-15):
 *   Welcome → Catalog (start here) → Upload → Dashboard KPIs → AI Augmentation → Jobs → Admin → Done
 */

import React, { useCallback, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { TourProvider, useTour, type StepType, type PopoverContentProps } from "@reactour/tour"
import { X, ArrowRight, ArrowLeft, Sparkles, Upload } from "lucide-react"
import { cn } from "@/shared/lib/utils"

// ─── Step definitions ────────────────────────────────────────────────────────

export const TOUR_STEPS: StepType[] = [
  {
    // Step 1 — Welcome (centred modal; no spotlight)
    selector: "[data-tour='logo']",
    content: "welcome",
    position: "center",
    padding: { mask: 0 },
  },
  {
    // Step 2 — Data Catalog: where you start
    selector: "[data-tour='nav-data-catalog']",
    content: "catalog",
    position: "right",
  },
  {
    // Step 3 — Upload action (same anchor, concrete next action)
    selector: "[data-tour='nav-data-catalog']",
    content: "upload",
    position: "right",
  },
  {
    // Step 4 — Dashboard KPIs: see the results
    selector: "[data-tour='kpi-cards']",
    content: "kpi",
    position: "bottom",
  },
  {
    // Step 5 — Jobs (Augmentation step removed: pending audit a575f372010d13bca)
    selector: "[data-tour='nav-jobs']",
    content: "jobs",
    position: "right",
  },
  {
    // Step 7 — Admin
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

export type StepKey =
  | "welcome"
  | "catalog"
  | "upload"
  | "kpi"
  | "augmentation"
  | "jobs"
  | "admin"
  | "done"

export interface StepCopy {
  title: string
  body: string
  isModal?: boolean
}

export const STEP_COPY: Record<StepKey, StepCopy> = {
  welcome: {
    title: "Welcome to RightRev",
    body: "Your team's shortcut from raw data to clean, audit-ready revenue records. Let's take 60 seconds to show you around.",
    isModal: true,
  },
  catalog: {
    title: "Your files live here",
    body: "Bring in your subscription, invoice, or revenue files and RightRev automatically flags every bad row — no formulas, no scripts.",
  },
  upload: {
    title: "Import from anywhere",
    body: "Upload your CSV, Excel, or JSON file, or connect directly to QuickBooks, Zoho Books, Snowflake, or Google Drive.",
  },
  kpi: {
    title: "Your month at a glance",
    body: "See how much data moved through this month, your average quality score, and what still needs attention — updated live as files arrive.",
  },
  augmentation: {
    title: "Enrich and reshape your data",
    body: "Transform your rows with AI — derive new columns, group, or enrich with context. Designed for your finance and ops team, no coding required.",
  },
  jobs: {
    title: "Keep your data fresh automatically",
    body: "Schedule recurring pulls from your ERP or data warehouse. Set it once and RightRev handles the rest.",
  },
  admin: {
    title: "Your team and connectors",
    body: "Invite teammates, assign roles, and manage your connected systems — everything in one place, always in sync.",
  },
  done: {
    title: "You're set — let's get started",
    body: "Upload your first file to see RightRev in action. You can replay this tour anytime from \"Take the tour\" in the sidebar.",
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

function TourSync({
  isOpen,
  currentStep: externalStep,
  setCurrentStep,
  onComplete,
  onSkip,
}: TourSyncProps) {
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
  const router = useRouter()
  const stepContent = steps[currentStep]?.content as StepKey | undefined
  const copy = stepContent && STEP_COPY[stepContent] ? STEP_COPY[stepContent] : null
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  // Non-modal (middle) step count:
  // Total steps minus the 2 modal bookends (welcome + done)
  const nonModalSteps = steps.length - 2
  // Index of the current non-modal step (1-based label for the user)
  const nonModalIndex = currentStep // step 0 = welcome modal, step 1..N-1 = non-modal

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

  const handleUploadCTA = useCallback(() => {
    onComplete()
    router.push("/files")
  }, [onComplete, router])

  if (!copy) return null

  const isModal = copy.isModal ?? false

  return (
    <div
      className={cn(
        // Base card styling — matches app's bg-card / border tokens
        "bg-card border border-border/80 text-foreground",
        "rounded-2xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.18),0_2px_8px_-2px_rgba(0,0,0,0.10)]",
        "transition-opacity duration-200",
        isModal ? "w-[400px] max-w-[92vw] p-7" : "w-[320px] max-w-[88vw] p-5",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-step-${currentStep}-title`}
      // Make the popover itself focusable so screen readers announce it
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          {isModal && (
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-primary" aria-hidden="true" />
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

        {/* Skip button — larger hit area + explicit "Skip tour" label */}
        <button
          onClick={handleClose}
          aria-label="Skip tour"
          className="flex-shrink-0 -mt-0.5 -mr-1 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
        >
          <X className="w-3 h-3" aria-hidden="true" />
          <span className="leading-none">Skip</span>
        </button>
      </div>

      {/* Body */}
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">{copy.body}</p>

      {/* Step indicator + dot-nav for middle steps */}
      {!isModal && (
        <div className="flex items-center justify-between mb-4">
          {/* Dot-nav */}
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={`Step ${nonModalIndex} of ${nonModalSteps}`}
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
                  i === nonModalIndex - 1
                    ? "w-4 h-1.5 bg-primary"
                    : "w-1.5 h-1.5 bg-border hover:bg-muted-foreground/40",
                )}
              />
            ))}
          </div>

          {/* Numeric label: e.g. "3 of 6" */}
          <span
            className="text-[11px] text-muted-foreground tabular-nums select-none"
            aria-live="polite"
          >
            {nonModalIndex} of {nonModalSteps}
          </span>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}

      {isFirst ? (
        // Welcome modal actions
        <div className="flex gap-2">
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 active:scale-[.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Start the tour"
            autoFocus
          >
            Show me around
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={handleClose}
            className="flex-shrink-0 h-9 px-4 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Skip tour for now"
          >
            Skip
          </button>
        </div>
      ) : isLast ? (
        // Done modal actions — primary CTA navigates to /files
        <div className="flex flex-col gap-2">
          <button
            onClick={handleUploadCTA}
            data-tour-cta="upload-first-file"
            className="w-full flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 active:scale-[.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Upload your first file"
            autoFocus
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Upload your first file
          </button>
          <button
            onClick={handleWatchAgain}
            className="w-full h-9 px-4 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Watch the tour again from the beginning"
          >
            Watch tour again
          </button>
        </div>
      ) : (
        // Middle step nav: Back | Next
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handlePrev}
            className="flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous step"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden="true" />
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 h-8 px-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 active:scale-[.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Next step"
            autoFocus
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
  // Keyboard accessibility: Esc dismisses, ← → navigate
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip()
      } else if (e.key === "ArrowRight") {
        setCurrentStep((prev) => {
          const next = Math.min(prev + 1, TOUR_STEPS.length - 1)
          return next
        })
      } else if (e.key === "ArrowLeft") {
        setCurrentStep((prev) => Math.max(0, prev - 1))
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, onSkip, setCurrentStep])

  // W4-NAV (2026-05-21): auto-skip on any route change. Reactour's spotlight
  // mask is anchored to a DOM selector on the CURRENT page — if the user
  // navigates (sidebar click, Cmd+K, back/forward) the selector becomes stale
  // and the mask either disappears halfway or sticks around covering the new
  // page, intercepting subsequent clicks. Treat any pathname change as
  // "user moved on, dismiss the tour" rather than holding state across routes.
  // Guards against the navigation-hijack class of bugs without any tour-step
  // behaviour change for users who stay on /dashboard.
  const pathname = usePathname()
  const initialPathRef = useRef<string | null>(null)
  useEffect(() => {
    if (initialPathRef.current === null) {
      initialPathRef.current = pathname ?? ""
      return
    }
    if (isOpen && pathname !== initialPathRef.current) {
      initialPathRef.current = pathname ?? ""
      onSkip()
    }
  }, [pathname, isOpen, onSkip])

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
      padding={10}
      scrollSmooth
      onClickMask={() => {
        // W4-NAV (2026-05-21): previously this blocked mask-clicks so the user
        // could not accidentally dismiss the tour. Verify agents reported that
        // when the spotlight selector failed to find its anchor element, the
        // mask still rendered full-screen and captured every click — including
        // sidebar / row clicks that should have navigated. Behaviour now: a
        // mask click is treated as "skip" so the page stays responsive even if
        // a tour anchor mid-flight goes missing (route change, DOM swap, etc.).
        onSkip()
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
        maskArea: (base) => ({ ...base, rx: 10 }),
        maskWrapper: (base) => ({
          ...base,
          // Slightly darker overlay for better contrast
          color: "rgba(0,0,0,0.62)",
        }),
        popover: (base) => ({
          ...base,
          padding: 0,
          background: "transparent",
          boxShadow: "none",
          maxWidth: "none",
          // Smooth fade-in on each step transition
          animation: "tourFadeIn 0.22s ease",
        }),
        svgWrapper: (base) => ({ ...base, opacity: 0.6 }),
      }}
    >
      <TourSync
        isOpen={isOpen}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onComplete={onComplete}
        onSkip={onSkip}
      />

      {/* Inline keyframe for popover fade-in (no extra CSS file needed) */}
      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </TourProvider>
  )
}
