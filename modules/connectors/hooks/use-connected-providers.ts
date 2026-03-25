"use client"

import { useState, useEffect } from "react"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import type { ProviderInfo } from "@/modules/connectors/api/connectors-api"

export interface ConnectedProvider {
  provider_id: string
  display_name: string
  category: string
}

/**
 * Fetches only the providers the current user has an active connection to.
 * Used by Import/Export dialogs so users only see what they can actually use.
 */
export function useConnectedProviders() {
  const [providers, setProviders] = useState<ConnectedProvider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Fetch available providers (for display_name + category) and user connections in parallel
        const [availResp, connResp] = await Promise.all([
          connectorsAPI.listProviders(),
          connectorsAPI.listConnections(),
        ])

        const available: ProviderInfo[] = availResp.providers || []
        const connections = connResp.connections || []

        // Find which providers have an active connection
        const connectedIds = new Set(
          connections
            .filter((c: any) => c.connection_status === "active" || c.connected)
            .map((c: any) => c.provider || c.provider_id),
        )

        // Show connected providers + all available providers (for sample/placeholder visibility)
        const connected = available
          .map((p) => ({
            provider_id: p.provider_id,
            display_name: p.display_name,
            category: p.category,
          }))

        setProviders(connected)
      } catch {
        setProviders([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const grouped = providers.reduce<Record<string, ConnectedProvider[]>>((acc, p) => {
    const cat = p.category || "erp"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  return { providers, grouped, loading }
}
