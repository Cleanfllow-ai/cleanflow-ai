"use client"

import { AWS_CONFIG } from "@/shared/config/aws-config"

import type {
    JobStatus, JobFrequency, ERPType, DQMode,
    DQConfig, Job, JobRun, CreateJobPayload, UpdateJobPayload,
    EntityResult, ProcessingMetadata, ImportPreviewResult,
    ProfilingResult, Preset, DQRule, ColumnProfile,
    SnowflakeEntityConfig, MappingConfig,
} from "@/modules/jobs/types/jobs.types"

export type {
    JobStatus, JobFrequency, ERPType, DQMode,
    DQConfig, Job, JobRun, CreateJobPayload, UpdateJobPayload,
    EntityResult, ProcessingMetadata, ImportPreviewResult,
    ProfilingResult, Preset, DQRule, ColumnProfile,
    SnowflakeEntityConfig, MappingConfig,
} from "@/modules/jobs/types/jobs.types"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

export function frequencyToBackend(freq: JobFrequency, cronExpr?: string): { frequency_type: string; frequency_value: string } {
    switch (freq) {
        case "15min": return { frequency_type: "rate", frequency_value: "15 minutes" }
        case "1hr": return { frequency_type: "rate", frequency_value: "1 hour" }
        case "daily": return { frequency_type: "rate", frequency_value: "1 day" }
        case "cron": return { frequency_type: "cron", frequency_value: cronExpr || "0 * * * ? *" }
        case "batch": return { frequency_type: "batch", frequency_value: "once" }
        default: return { frequency_type: "rate", frequency_value: "1 hour" }
    }
}

export function frequencyFromBackend(freqType?: string, freqValue?: string): { frequency: JobFrequency; cronExpression: string } {
    if (freqType === "batch") return { frequency: "batch", cronExpression: "" }
    if (freqType === "cron") {
        return { frequency: "cron", cronExpression: freqValue || "" }
    }
    const val = (freqValue || "").toLowerCase().trim()
    if (val.includes("minute")) return { frequency: "15min", cronExpression: "" }
    if (val.includes("hour")) return { frequency: "1hr", cronExpression: "" }
    if (val.includes("day")) return { frequency: "daily", cronExpression: "" }
    return { frequency: "1hr", cronExpression: "" }
}

const ENDPOINTS = {
    JOBS: "/jobs",
    JOB_BY_ID: (id: string) => `/jobs/${id}`,
    JOB_PAUSE: (id: string) => `/jobs/${id}/pause`,
    JOB_RESUME: (id: string) => `/jobs/${id}/resume`,
    JOB_TRIGGER: (id: string) => `/jobs/${id}/trigger`,
    JOB_RUNS: (id: string) => `/jobs/${id}/runs`,
    IMPORT_PREVIEW: "/jobs/import-preview",
    PROFILING: "/jobs/profiling",
    PRESETS: "/jobs/presets",
    RULES: "/jobs/rules",
    DISCOVER_ENTITIES: "/erp/discover-entities",
    ENTITY_FIELDS: "/erp/entity-fields",
    MAPPING_PREVIEW: "/erp/mapping/preview",
}

class JobsAPI {
    private baseURL: string

    constructor(baseURL: string = API_BASE_URL) {
        this.baseURL = baseURL
    }

    private async makeRequest(endpoint: string, authToken: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.baseURL}${endpoint}`
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers as Record<string, string>
        }

        if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`
        }

        const response = await fetch(url, { ...options, headers })

        if (!response.ok) {
            const raw = await response.json().catch(() => ({}))
            const errorData = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {}
            const fallbackMsg = typeof raw === "string" ? raw : `HTTP ${response.status}`
            throw new Error(errorData.error || errorData.message || fallbackMsg)
        }

        return await response.json()
    }

    private getAuth(): string {
        if (typeof window === "undefined") return ""
        try {
            const raw = window.localStorage.getItem("authTokens")
            if (raw) {
                const parsed = JSON.parse(raw)
                return parsed?.idToken || parsed?.accessToken || ""
            }
        } catch {
            // ignore
        }
        return ""
    }

    // ─── Job CRUD ────────────────────────────────────────────────────────────

    async listJobs(): Promise<{ jobs: Job[] }> {
        const token = this.getAuth()
        try {
            return await this.makeRequest(ENDPOINTS.JOBS, token, { method: "GET" })
        } catch {
            return { jobs: [] }
        }
    }

    async getJob(jobId: string): Promise<Job> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.JOB_BY_ID(jobId), token, { method: "GET" })
    }

    async createJob(payload: CreateJobPayload): Promise<Job> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.JOBS, token, {
            method: "POST",
            body: JSON.stringify(payload)
        })
    }

    async updateJob(jobId: string, payload: UpdateJobPayload): Promise<Job> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.JOB_BY_ID(jobId), token, {
            method: "PUT",
            body: JSON.stringify(payload)
        })
    }

    async deleteJob(jobId: string): Promise<{ message: string }> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.JOB_BY_ID(jobId), token, { method: "DELETE" })
    }

    // ─── Job Actions ─────────────────────────────────────────────────────────

    async pauseJob(jobId: string): Promise<Job> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.JOB_PAUSE(jobId), token, { method: "POST" })
    }

    async resumeJob(jobId: string): Promise<Job> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.JOB_RESUME(jobId), token, { method: "POST" })
    }

    async triggerJob(jobId: string): Promise<{ message: string; job_id: string }> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.JOB_TRIGGER(jobId), token, { method: "POST" })
    }

    // ─── Re-export (after quarantine remediation) ───────────────────────────

    async reExportFile(jobId: string, uploadId: string, entity: string): Promise<{
        status: string
        message?: string
    }> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}/re-export`, token, {
            method: "POST",
            body: JSON.stringify({ upload_id: uploadId, entity }),
        })
    }

    async checkReExportStatus(jobId: string, uploadId: string): Promise<{
        status: string
        records_exported?: number
        destination?: string
        error?: string
    }> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}/re-export`, token, {
            method: "POST",
            body: JSON.stringify({ upload_id: uploadId, check_status: true }),
        })
    }

    // ─── Job Runs ────────────────────────────────────────────────────────────

    async getJobRuns(jobId: string, limit: number = 10): Promise<{ runs: JobRun[] }> {
        const token = this.getAuth()
        const qs = limit ? `?limit=${limit}` : ""
        try {
            return await this.makeRequest(`${ENDPOINTS.JOB_RUNS(jobId)}${qs}`, token, { method: "GET" })
        } catch {
            return { runs: [] }
        }
    }

    // ─── Advanced Options ────────────────────────────────────────────────────

    async importPreview(source: string, entity: string): Promise<ImportPreviewResult> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.IMPORT_PREVIEW, token, {
            method: "POST",
            body: JSON.stringify({ source, entity }),
        })
    }

    async fetchProfiling(uploadId: string, columns: string[]): Promise<ProfilingResult> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.PROFILING, token, {
            method: "POST",
            body: JSON.stringify({ upload_id: uploadId, columns }),
        })
    }

    async listPresets(): Promise<{ presets: Preset[] }> {
        const token = this.getAuth()
        try {
            return await this.makeRequest(ENDPOINTS.PRESETS, token, { method: "GET" })
        } catch {
            return { presets: [] }
        }
    }

    async listRules(): Promise<{ rules: DQRule[] }> {
        const token = this.getAuth()
        try {
            return await this.makeRequest(ENDPOINTS.RULES, token, { method: "GET" })
        } catch {
            return { rules: [] }
        }
    }

    // ─── Entity Discovery & Mapping ──────────────────────────────────────────

    async discoverEntities(provider: string): Promise<{ entities: Array<{ entity?: string; name?: string; label?: string; record_count?: number; value?: string }> }> {
        const token = this.getAuth()
        let endpoint: string
        if (provider === "quickbooks") {
            endpoint = "/quickbooks/discover-entities"
        } else if (provider === "zohobooks") {
            endpoint = "/zoho-books/discover-entities"
        } else {
            endpoint = `${ENDPOINTS.DISCOVER_ENTITIES}?provider=${encodeURIComponent(provider)}`
        }
        try {
            return await this.makeRequest(endpoint, token, { method: "GET" })
        } catch {
            return { entities: [] }
        }
    }

    async getEntityFields(provider: string, entity: string): Promise<{ fields: Array<{ name: string; label?: string; type?: string; required?: boolean }> }> {
        const token = this.getAuth()
        const params = new URLSearchParams({ provider, entity })
        return this.makeRequest(`${ENDPOINTS.ENTITY_FIELDS}?${params}`, token, { method: "GET" })
    }

    async getMappingPreview(body: {
        source_provider: string
        source_entity: string
        dest_provider: string
        dest_entity: string
    }): Promise<{ mapping: Record<string, string>; method?: string; cdf_entity?: string }> {
        const token = this.getAuth()
        return this.makeRequest(ENDPOINTS.MAPPING_PREVIEW, token, {
            method: "POST",
            body: JSON.stringify(body),
        })
    }
}

export const jobsAPI = new JobsAPI()
