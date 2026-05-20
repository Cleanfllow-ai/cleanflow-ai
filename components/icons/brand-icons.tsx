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
      <rect x="3"    y="14" width="4.5" height="7"  rx="1" stroke={paint} />
      <rect x="9.75" y="9"  width="4.5" height="12" rx="1" stroke={paint} />
      <rect x="16.5" y="4"  width="4.5" height="17" rx="1" stroke={paint} />
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
      <line x1="8" y1="12.5" x2="16" y2="12.5" stroke={paint} />
      <line x1="8" y1="16"   x2="16" y2="16"   stroke={paint} />
      <line x1="8" y1="19"   x2="13" y2="19"   stroke={paint} />
    </svg>
  )
}

/** Jobs — analog clock face, hands at 10:10 (classic, professional) */
export function JobsIcon({ active, className }: BrandIconProps) {
  const { id, paint } = useStroke(active)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {active && <Grad id={id} />}
      {/* Clock face */}
      <circle cx="12" cy="12" r="9" stroke={paint} />
      {/* Hour ticks at 12, 3, 6, 9 */}
      <line x1="12" y1="3.5"  x2="12" y2="5"    stroke={paint} />
      <line x1="20.5" y1="12" x2="19"   y2="12" stroke={paint} />
      <line x1="12" y1="20.5" x2="12" y2="19"   stroke={paint} />
      <line x1="3.5"  y1="12" x2="5"    y2="12" stroke={paint} />
      {/* Hour hand → 10 */}
      <line x1="12" y1="12" x2="9"    y2="10.25" stroke={paint} />
      {/* Minute hand → 2 */}
      <line x1="12" y1="12" x2="15.9" y2="9.75"  stroke={paint} />
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
