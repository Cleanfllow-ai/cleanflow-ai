"use client"

import { makeRequest } from "@/modules/files/api/file-upload-api"
import { getAuth } from "@/modules/files/api/file-settings-api"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MappingTemplate {
    template_id: string
    org_id: string
    name: string
    description?: string
    source_provider: string
    source_entity: string
    dest_provider: string
    dest_entity: string
    column_mapping: Record<string, string>
    is_org_default: boolean
    created_by: string
    created_at: string
    updated_at: string
}

export interface MappingTemplateListFilters {
    source_provider?: string
    source_entity?: string
    dest_provider?: string
    dest_entity?: string
}

// ─── API Endpoints ──────────────────────────────────────────────────────────

const ENDPOINTS = {
    LIST: "/jobs/mapping-templates",
    BY_ID: (id: string) => `/jobs/mapping-templates/${id}`,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildQueryString(filters?: MappingTemplateListFilters): string {
    if (!filters) return ""
    const params = new URLSearchParams()
    if (filters.source_provider) params.set("source_provider", filters.source_provider)
    if (filters.source_entity) params.set("source_entity", filters.source_entity)
    if (filters.dest_provider) params.set("dest_provider", filters.dest_provider)
    if (filters.dest_entity) params.set("dest_entity", filters.dest_entity)
    const qs = params.toString()
    return qs ? `?${qs}` : ""
}

// ─── Mapping Templates API ──────────────────────────────────────────────────

class MappingTemplatesAPI {
    async list(filters?: MappingTemplateListFilters, authToken?: string): Promise<MappingTemplate[]> {
        const token = authToken ?? (await getAuth())
        const qs = buildQueryString(filters)
        const res = await makeRequest(`${ENDPOINTS.LIST}${qs}`, token, { method: "GET" })
        // Support both `{templates: [...]}` and bare-array responses for forward
        // compat; backend handler returns a list — adapt without breaking.
        if (Array.isArray(res)) return res
        if (res && Array.isArray(res.templates)) return res.templates
        return []
    }

    async get(template_id: string, authToken?: string): Promise<MappingTemplate> {
        const token = authToken ?? (await getAuth())
        return makeRequest(ENDPOINTS.BY_ID(template_id), token, { method: "GET" })
    }

    async create(payload: Partial<MappingTemplate>, authToken?: string): Promise<MappingTemplate> {
        const token = authToken ?? (await getAuth())
        return makeRequest(ENDPOINTS.LIST, token, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    }

    async update(template_id: string, payload: Partial<MappingTemplate>, authToken?: string): Promise<MappingTemplate> {
        const token = authToken ?? (await getAuth())
        return makeRequest(ENDPOINTS.BY_ID(template_id), token, {
            method: "PUT",
            body: JSON.stringify(payload),
        })
    }

    async delete(template_id: string, authToken?: string): Promise<void> {
        const token = authToken ?? (await getAuth())
        await makeRequest(ENDPOINTS.BY_ID(template_id), token, { method: "DELETE" })
    }
}

export const mappingTemplatesAPI = new MappingTemplatesAPI()
