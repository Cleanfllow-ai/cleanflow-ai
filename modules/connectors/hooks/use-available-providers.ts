"use client"

import { useState, useEffect } from "react"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import type { ProviderInfo } from "@/modules/connectors/api/connectors-api"

export interface ProviderOption {
  label: string
  value: string
  category: string
}

/**
 * Fetches the list of available providers from the backend.
 * Returns them as grouped options for dropdown selectors.
 * Caches in module scope so multiple components don't re-fetch.
 */

let _cache: ProviderInfo[] | null = null
let _cachePromise: Promise<ProviderInfo[]> | null = null

function fetchProviders(): Promise<ProviderInfo[]> {
  if (_cache) return Promise.resolve(_cache)
  if (_cachePromise) return _cachePromise
  _cachePromise = connectorsAPI
    .listProviders()
    .then((resp) => {
      _cache = resp.providers || []
      return _cache
    })
    .catch(() => {
      _cachePromise = null
      return [] as ProviderInfo[]
    })
  return _cachePromise
}

export function useAvailableProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>(_cache || [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) {
      setProviders(_cache)
      setLoading(false)
      return
    }
    fetchProviders().then((list) => {
      setProviders(list)
      setLoading(false)
    })
  }, [])

  /** Flat list as dropdown options. */
  const options: ProviderOption[] = providers.map((p) => ({
    label: p.display_name.toUpperCase(),
    value: p.provider_id,
    category: p.category,
  }))

  /** Grouped by category. */
  const grouped = providers.reduce<Record<string, ProviderInfo[]>>((acc, p) => {
    const cat = p.category || "erp"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  /** Options grouped by category for select components. */
  const groupedOptions: Record<string, ProviderOption[]> = {}
  for (const [cat, list] of Object.entries(grouped)) {
    groupedOptions[cat] = list.map((p) => ({
      label: p.display_name.toUpperCase(),
      value: p.provider_id,
      category: cat,
    }))
  }

  return { providers, options, grouped, groupedOptions, loading }
}

/** Invalidate cache (e.g., after connecting a new provider). */
export function invalidateProviderCache() {
  _cache = null
  _cachePromise = null
}
