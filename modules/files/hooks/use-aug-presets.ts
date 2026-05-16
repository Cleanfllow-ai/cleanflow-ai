"use client"

import { useState, useEffect } from "react"
import { makeRequest } from "@/modules/files/api/file-upload-api"

export interface AugPreset {
  preset_id: string
  name: string
  category: string
  cardinality: "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY"
  prompt_text: string
  required_columns: string[]
  produces_columns: string[]
}

interface AugPresetsResponse {
  schema_version: number
  presets: AugPreset[]
}

interface UseAugPresetsResult {
  presets: AugPreset[]
  isLoading: boolean
  error: string | null
}

export function useAugPresets(authToken: string | null): UseAugPresetsResult {
  const [presets, setPresets] = useState<AugPreset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    makeRequest("/augmentation/presets", authToken, { method: "GET" })
      .then((resp: AugPresetsResponse) => {
        if (cancelled) return
        setPresets(Array.isArray(resp?.presets) ? resp.presets : [])
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError((err as { message?: string })?.message ?? "Failed to load presets")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [authToken])

  return { presets, isLoading, error }
}
