"use client"

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"

const TOUR_COMPLETED_KEY = "rightrev:tour:completed:v1"

// W4-NAV (2026-05-21): be permissive about "tour already done" — any of these
// historical / alternate keys counts as "skip auto-open". Verify agents reported
// stale completion state leaking past the v1 key (browser-extension wipes, prior
// FE versions) and the tour mask would auto-open on every dashboard mount,
// which we suspected of intercepting sidebar / row clicks. Treat the union as
// truthy; only fall back to auto-open if NONE of these keys are set.
const TOUR_COMPLETED_ALIASES = [
  TOUR_COMPLETED_KEY,
  "tour_completed",
  "rightrev_tour_done",
  "tour_skipped",
  "onboardingComplete",
] as const

function readAnyTourCompletionFlag(): boolean {
  if (typeof window === "undefined") return false
  for (const key of TOUR_COMPLETED_ALIASES) {
    try {
      const v = localStorage.getItem(key)
      if (v === "true" || v === "1" || v === "yes") return true
    } catch {
      // Storage may throw in lockdown / private modes — fall through.
    }
  }
  return false
}

export interface UseWelcomeTourReturn {
  isOpen: boolean
  currentStep: number
  hasCompleted: boolean
  openTour: () => void
  closeTour: () => void
  completeTour: () => void
  setCurrentStep: Dispatch<SetStateAction<number>>
}

export function useWelcomeTour(autoOpenOnDashboard = false): UseWelcomeTourReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(true) // default true until we read localStorage

  // Read the flag on mount (client-only)
  useEffect(() => {
    // W4-NAV: union check across all historical completion-flag keys so a
    // stale localStorage state never re-pops the tour on top of normal
    // navigation. Writes still go to the canonical TOUR_COMPLETED_KEY.
    const completed = readAnyTourCompletionFlag()
    setHasCompleted(completed)

    if (!completed && autoOpenOnDashboard) {
      // Let the dashboard layout settle before popping the tour
      const timer = setTimeout(() => {
        setIsOpen(true)
        // Mark as seen the MOMENT the tour auto-opens. This makes "shown once"
        // = "seen forever", so the tour never re-opens on subsequent logins —
        // even if the user navigates away mid-tour, closes the browser tab,
        // or refreshes the page without hitting Skip / Complete. Manual replay
        // via "Take the tour" sidebar item still works (handleWatchAgain wipes
        // the flag, then user calls openTour() explicitly).
        localStorage.setItem(TOUR_COMPLETED_KEY, "true")
        setHasCompleted(true)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [autoOpenOnDashboard])

  const openTour = useCallback(() => {
    setCurrentStep(0)
    setIsOpen(true)
  }, [])

  const closeTour = useCallback(() => {
    setIsOpen(false)
    // Treat "skip" as completion — don't show again
    localStorage.setItem(TOUR_COMPLETED_KEY, "true")
    setHasCompleted(true)
  }, [])

  const completeTour = useCallback(() => {
    setIsOpen(false)
    localStorage.setItem(TOUR_COMPLETED_KEY, "true")
    setHasCompleted(true)
  }, [])

  return {
    isOpen,
    currentStep,
    hasCompleted,
    openTour,
    closeTour,
    completeTour,
    setCurrentStep,
  }
}
