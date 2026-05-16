"use client"

/**
 * AA3 Sprint 1 — Plan-tier-aware upload drop zone. Clamps accepted file
 * size by the caller's plan tier and fires onPlanLimitExceeded when over.
 * Spec: docs/CUSTOMER_ONBOARDING_UX_WALKTHROUGH_2026-05-14.md §6.
 */
import { useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

export type PlanTier = "free" | "starter" | "pro" | "enterprise"

const _MB = 1024 * 1024
const _GB = 1024 * _MB
// Mirrors backend dict in contexts/files/application/use_cases/init_upload.py.
export const PLAN_TIER_LIMITS_BYTES: Record<PlanTier, number> = {
  free: 100 * _MB,
  starter: 5 * _GB,
  pro: 50 * _GB,
  enterprise: 200 * _GB,
}

const TIER_LABEL: Record<PlanTier, string> = {
  free: "Free", starter: "Starter", pro: "Pro", enterprise: "Enterprise",
}

const fmtBytes = (b: number) =>
  b >= _GB ? `${(b / _GB).toFixed(0)} GB` : b >= _MB ? `${(b / _MB).toFixed(0)} MB` : `${b} B`

export interface UploadZoneProps {
  planTier: PlanTier
  onFileSelected?: (file: File) => void
  onPlanLimitExceeded?: (file: File, limitBytes: number) => void
}

export function UploadZone({ planTier, onFileSelected, onPlanLimitExceeded }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const limit = PLAN_TIER_LIMITS_BYTES[planTier] ?? PLAN_TIER_LIMITS_BYTES.free
  const tierLabel = TIER_LABEL[planTier] ?? TIER_LABEL.free
  const showUpgrade = planTier !== "enterprise"

  const handle = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const file = files[0]
      if (file.size > limit) onPlanLimitExceeded?.(file, limit)
      else onFileSelected?.(file)
    },
    [limit, onFileSelected, onPlanLimitExceeded],
  )

  return (
    <Card data-testid="upload-zone">
      <CardContent className="p-6">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files) }}
          data-testid="upload-zone-dropzone"
        >
          <Upload className="w-10 h-10 mx-auto text-primary mb-3" />
          <div className="text-lg font-medium mb-1">Drop your file here</div>
          <div className="text-sm text-muted-foreground mb-4">or click to browse</div>
          <Button variant="outline" size="sm" type="button">Choose File</Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            data-testid="upload-zone-input"
            onChange={(e) => handle(e.target.files)}
          />
        </div>
        <div className="mt-4 text-xs text-muted-foreground text-center" data-testid="upload-zone-limit-hint">
          Max file size: {fmtBytes(limit)} ({tierLabel})
          {showUpgrade && (
            <>{" — "}<a href="/welcome" className="text-primary hover:underline" data-testid="upload-zone-upgrade-link">upgrade for larger files</a></>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
