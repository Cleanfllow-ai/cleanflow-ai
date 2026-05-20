"use client"

import { useId } from "react"

export interface BrandIconProps {
  active?: boolean
  className?: string
}

/** Diagonal gradient from brand green → dark forest, in SVG userSpace coords */
function Grad({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#69C04B" />
        <stop offset="100%" stopColor="#164234" />
      </linearGradient>
    </defs>
  )
}

function useStroke(active: boolean | undefined) {
  const raw = useId()
  const id = `bi-${raw.replace(/:/g, "")}`
  return { id, paint: active ? `url(#${id})` : "currentColor" }
}

/** Dashboard — ascending bar chart */
export function DashboardIcon({ active, className }: BrandIconProps) {
  const { id, paint } = useStroke(active)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {active && <Grad id={id} />}
      <rect x="2"   y="14" width="5" height="8"  rx="0.75" stroke={paint} />
      <rect x="9.5" y="8"  width="5" height="14" rx="0.75" stroke={paint} />
      <rect x="17"  y="3"  width="5" height="19" rx="0.75" stroke={paint} />
    </svg>
  )
}

/** Data Catalog — document with data rows */
export function DataCatalogIcon({ active, className }: BrandIconProps) {
  const { id, paint } = useStroke(active)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {active && <Grad id={id} />}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={paint} />
      <polyline points="14 2 14 8 20 8" stroke={paint} />
      <line x1="8" y1="13" x2="16" y2="13" stroke={paint} />
      <line x1="8" y1="17" x2="13" y2="17" stroke={paint} />
    </svg>
  )
}

/** Jobs — calendar with inset clock face */
export function JobsIcon({ active, className }: BrandIconProps) {
  const { id, paint } = useStroke(active)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {active && <Grad id={id} />}
      {/* calendar body */}
      <rect x="3" y="4" width="18" height="18" rx="2" stroke={paint} />
      <line x1="16" y1="2" x2="16" y2="6" stroke={paint} />
      <line x1="8"  y1="2" x2="8"  y2="6" stroke={paint} />
      <line x1="3"  y1="10" x2="21" y2="10" stroke={paint} />
      {/* clock face inset bottom-right */}
      <circle cx="15.5" cy="16.5" r="3.5" stroke={paint} />
      <polyline points="15.5 14.8 15.5 16.5 16.8 17.8" stroke={paint} />
    </svg>
  )
}

/** Admin — settings gear */
export function AdminIcon({ active, className }: BrandIconProps) {
  const { id, paint } = useStroke(active)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {active && <Grad id={id} />}
      <circle cx="12" cy="12" r="3" stroke={paint} />
      <path stroke={paint} d="
        M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
        a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
        A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06
        A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
        A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06
        A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
        a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06
        A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
        a1.65 1.65 0 0 0-1.51 1z
      " />
    </svg>
  )
}
