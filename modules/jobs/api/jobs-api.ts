"use client"

import { AWS_CONFIG } from "@/shared/config/aws-config"

import type {
    JobStatus, JobFrequency, CustomFrequencyUnit, ERPType, DQMode,
    DQConfig, Job, JobRun, CreateJobPayload, UpdateJobPayload,
    EntityResult, ProcessingMetadata, ImportPreviewResult,
    ProfilingResult, Preset, DQRule, ColumnProfile,
} from "@/modules/jobs/types/jobs.types"

export type {
    JobStatus, JobFrequency, CustomFrequencyUnit, ERPType, DQMode,
    DQConfig, Job, JobRun, CreateJobPayload, UpdateJobPayload,
    EntityResult, ProcessingMetadata, ImportPreviewResult,
    ProfilingResult, Preset, DQRule, ColumnProfile,
} from "@/modules/jobs/types/jobs.types"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

export function frequencyToBackend(
    freq: JobFrequency,
    opts?: { customUnit?: CustomFrequencyUnit; customValue?: string }
): { frequency_type: string; frequency_value: string } {
    switch (freq) {
        case "15min": return { frequency_type: "rate", frequency_value: "15 minutes" }
        case "1hr": return { frequency_type: "rate", frequency_value: "1 hour" }
        case "daily": return { frequency_type: "rate", frequency_value: "1 day" }
        case "custom": {
            const unit = opts?.customUnit || "minutes"
            const value = opts?.customValue || "30"
            return { frequency_type: "rate", frequency_value: `${value} ${unit}` }
        }
        default: return { frequency_type: "rate", frequency_value: "1 hour" }
    }
}

export function frequencyFromBackend(freqType?: string, freqValue?: string): {
    frequency: JobFrequency
    customUnit: CustomFrequencyUnit
    customValue: string
} {
    const val = (freqValue || "").toLowerCase().trim()
    const match = val.match(/^(\d+)\s*(minute|hour|day)s?$/)

    if (match) {
        const num = match[1]
        const unit = match[2]
        if (unit === "minute") {
            if (num === "15") return { frequency: "15min", customUnit: "minutes", customValue: "" }
            return { frequency: "custom", customUnit: "minutes", customValue: num }
        }
        if (unit === "hour") {
            if (num === "1") return { frequency: "1hr", customUnit: "hours", customValue: "" }
            return { frequency: "custom", customUnit: "hours", customValue: num }
        }
        if (unit === "day") {
            if (num === "1") return { frequency: "daily", customUnit: "days", customValue: "" }
            return { frequency: "custom", customUnit: "days", customValue: num }
        }
    }

    // Legacy cron jobs → map to custom hours
    if (freqType === "cron") {
        return { frequency: "custom", customUnit: "hours", customValue: "2" }
    }

    return { frequency: "1hr", customUnit: "hours", customValue: "" }
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
}

export const jobsAPI = new JobsAPI()
