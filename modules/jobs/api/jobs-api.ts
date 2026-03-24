"use client"

import { AWS_CONFIG } from "@/shared/config/aws-config"

import type {
    JobStatus, JobFrequency, DQMode, DQPolicy,
    DQConfig, Job, JobRun, CreateJobPayload, UpdateJobPayload,
    PipelineLog, EntityResult,
} from "@/modules/jobs/types/jobs.types"
import type { ProfilingResponse } from "@/modules/files/types"

export type {
    JobStatus, JobFrequency, DQMode, DQPolicy,
    DQConfig, Job, JobRun, CreateJobPayload, UpdateJobPayload,
    PipelineLog, EntityResult,
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
            return await this.makeRequest("/jobs", token, { method: "GET" })
        } catch {
            return { jobs: [] }
        }
    }

    async getJob(jobId: string): Promise<Job> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}`, token, { method: "GET" })
    }

    async createJob(payload: CreateJobPayload): Promise<any> {
        const token = this.getAuth()
        return this.makeRequest("/jobs", token, {
            method: "POST",
            body: JSON.stringify(payload)
        })
    }

    async updateJob(jobId: string, payload: UpdateJobPayload): Promise<any> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}`, token, {
            method: "PUT",
            body: JSON.stringify(payload)
        })
    }

    async deleteJob(jobId: string): Promise<{ message: string }> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}`, token, { method: "DELETE" })
    }

    // ─── Job Actions ─────────────────────────────────────────────────────────

    async pauseJob(jobId: string): Promise<any> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}/pause`, token, { method: "POST" })
    }

    async resumeJob(jobId: string): Promise<any> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}/resume`, token, { method: "POST" })
    }

    async triggerJob(jobId: string): Promise<{ message: string; job_id: string }> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}/trigger`, token, { method: "POST" })
    }

    // ─── Run Actions ──────────────────────────────────────────────────────────

    async resumeRun(jobId: string, runId: string): Promise<{ message: string }> {
        const token = this.getAuth()
        return this.makeRequest(`/jobs/${jobId}/runs/${runId}/resume`, token, { method: "POST" })
    }

    // ─── Job Runs ────────────────────────────────────────────────────────────

    async getJobRuns(jobId: string, limit: number = 50): Promise<{ runs: JobRun[] }> {
        const token = this.getAuth()
        const qs = limit ? `?limit=${limit}` : ""
        try {
            return await this.makeRequest(`/jobs/${jobId}/runs${qs}`, token, { method: "GET" })
        } catch {
            return { runs: [] }
        }
    }

    async getProfilingPreview(payload: {
        source_provider: string
        source_category: string
        entity: string
        source_config?: Record<string, string>
        selected_columns?: string[]
        sample_size?: number
    }): Promise<ProfilingResponse> {
        const token = this.getAuth()
        return this.makeRequest("/jobs/profiling-preview", token, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    }
}

export const jobsAPI = new JobsAPI()
