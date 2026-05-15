"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { mappingTemplatesAPI } from "@/modules/settings/api/mapping-templates-api"
import type { MappingTemplate, MappingTemplateListFilters } from "@/modules/settings/types/mapping-template.types"

interface UseMappingTemplatesResult {
    templates: MappingTemplate[]
    loading: boolean
    error: string | null
    refresh: () => Promise<void>
    createTemplate: (payload: Partial<MappingTemplate>) => Promise<MappingTemplate>
    updateTemplate: (id: string, payload: Partial<MappingTemplate>) => Promise<MappingTemplate>
    deleteTemplate: (id: string) => Promise<void>
}

/**
 * CRUD + cache hook for mapping templates. Pattern intentionally matches the
 * shape of the SettingsPreset hook the services tab uses — plain `useState`
 * + `useEffect`, no react-query in this codebase yet.
 */
export function useMappingTemplates(filters?: MappingTemplateListFilters): UseMappingTemplatesResult {
    const [templates, setTemplates] = useState<MappingTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Stable filter ref so the load callback doesn't churn when callers pass
    // an inline object every render.
    const filtersRef = useRef(filters)
    filtersRef.current = filters

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const list = await mappingTemplatesAPI.list(filtersRef.current)
            setTemplates(list)
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load mapping templates"
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const createTemplate = useCallback(async (payload: Partial<MappingTemplate>) => {
        const created = await mappingTemplatesAPI.create(payload)
        // Optimistic cache update: prepend new template, refresh in background
        // so server-assigned timestamps + IDs are reflected.
        setTemplates(prev => [created, ...prev.filter(t => t.template_id !== created.template_id)])
        return created
    }, [])

    const updateTemplate = useCallback(async (id: string, payload: Partial<MappingTemplate>) => {
        const updated = await mappingTemplatesAPI.update(id, payload)
        setTemplates(prev => prev.map(t => (t.template_id === id ? updated : t)))
        return updated
    }, [])

    const deleteTemplate = useCallback(async (id: string) => {
        await mappingTemplatesAPI.delete(id)
        setTemplates(prev => prev.filter(t => t.template_id !== id))
    }, [])

    return { templates, loading, error, refresh, createTemplate, updateTemplate, deleteTemplate }
}
