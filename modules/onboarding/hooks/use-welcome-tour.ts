"use client"

import { useCallback, useEffect, useState } from "react"

const TOUR_COMPLETED_KEY = "rightrev:tour:completed:v1"

export interface UseWelcomeTourReturn {
  isOpen: boolean
  currentStep: number
  hasCompleted: boolean
  openTour: () => void
  closeTour: () => void
  completeTour: () => void
  setCurrentStep: (step: number) => void
}

export function useWelcomeTour(autoOpenOnDashboard = false): UseWelcomeTourReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(true) // default true until we read localStorage

  // Read the flag on mount (client-only)
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY) === "true"
    setHasCompleted(completed)

    if (!completed && autoOpenOnDashboard) {
      // Let the dashboard layout settle before popping the tour
      const timer = setTimeout(() => {
        setIsOpen(true)
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
