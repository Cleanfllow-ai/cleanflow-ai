import { makeRequest } from './file-upload-api'
import type {
    DqReportResponse,
    OverallDqReportResponse,
    IssuesResponse,
    CustomRuleDefinition,
    CustomRuleSuggestionResponse,
} from '@/modules/files/types'

import { AWS_CONFIG } from '@/shared/config/aws-config'
const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// API Endpoints used by this module
const ENDPOINTS = {
    FILES_ISSUES: (id: string) => `/files/${id}/issues`,
    FILES_DQ_MATRIX: (id: string) => `/files/${id}/dq-matrix`,
}

// ─── DQ Report Downloads ───

export async function downloadDqReport(uploadId: string, authToken: string): Promise<DqReportResponse> {
    const url = `${API_BASE_URL}/files/${uploadId}/download?type=report`

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    })

    if (!response.ok) {
        throw new Error(`DQ report download failed: ${response.statusText}`)
    }

    const text = await response.text()

    // Helper: try to base64-decode a string, return null on failure
    const tryDecodeBase64 = (s: string): string | null => {
        try {
            const trimmed = (s || '').trim()
            if (!trimmed) return null
            const binary = atob(trimmed)
            return binary
        } catch (e) {
            return null
        }
    }

    // Case 1: JSON envelope
    try {
        const payload = JSON.parse(text)
        const base64Body = payload.body || payload.data || ''
        if (base64Body) {
            const decoded = tryDecodeBase64(base64Body)
            if (decoded) return JSON.parse(decoded)
        }
        // If there's no body field, treat payload itself as report JSON
        return payload as DqReportResponse
    } catch {
        // Not JSON – fall through
    }

    // Case 2: plain base64 string
    const decoded = tryDecodeBase64(text)
    if (decoded) {
        try {
            return JSON.parse(decoded)
        } catch {
            // Fall through
        }
    }

    // Case 3: already plain JSON string
    return JSON.parse(text)
}

// Download per-user overall DQ summary JSON
export async function downloadOverallDqReport(authToken: string): Promise<OverallDqReportResponse> {
    const url = `${API_BASE_URL}/files/overall/dq-report`

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    })

    if (!response.ok) {
        // 404 means no DQ report exists yet (new user or no processed files)
        if (response.status === 404) {
            return null as unknown as OverallDqReportResponse
        }
        const raw = await response.json().catch(() => ({}))
        const errorData = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {}
        const fallbackMsg = typeof raw === "string" ? raw : (response.statusText || `HTTP ${response.status}`)
        const errorMessage = (errorData.error || errorData.message || fallbackMsg || "").toLowerCase()

        // Expected in first-login/setup or restricted-role scenarios.
        if (
            response.status === 401 ||
            response.status === 403 ||
            errorMessage.includes("permission denied") ||
            errorMessage.includes("organization membership required")
        ) {
            return null as unknown as OverallDqReportResponse
        }

        throw new Error(`Overall DQ report download failed: ${response.statusText}`)
    }

    const text = await response.text()

    // Helper: try to base64-decode a string, return null on failure
    const tryDecodeBase64 = (s: string): string | null => {
        try {
            const trimmed = (s || '').trim()
            if (!trimmed) return null
            const binary = atob(trimmed)
            return binary
        } catch (e) {
            return null
        }
    }

    // Case 1: JSON envelope
    try {
        const payload = JSON.parse(text)
        const base64Body = payload.body || payload.data || ''
        if (base64Body) {
            const decoded = tryDecodeBase64(base64Body)
            if (decoded) return JSON.parse(decoded)
        }
        return payload as OverallDqReportResponse
    } catch {
        // Not JSON – fall through
    }

    // Case 2: plain base64
    const decoded = tryDecodeBase64(text)
    if (decoded) {
        try {
            return JSON.parse(decoded)
        } catch {
            // Fall through
        }
    }

    // Case 3: already plain JSON
    return JSON.parse(text)
}

// ─── Issues & DQ Matrix ───

export async function getFileIssues(
    uploadId: string,
    authToken: string,
    params?: { offset?: number; limit?: number; violations?: string[] }
): Promise<IssuesResponse> {
    const searchParams = new URLSearchParams()
    if (params?.offset !== undefined) searchParams.set('offset', String(params.offset))
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit))
    if (params?.violations && params.violations.length > 0) {
        searchParams.set('violations', params.violations.join(','))
    }
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return makeRequest(`${ENDPOINTS.FILES_ISSUES(uploadId)}${qs}`, authToken, { method: 'GET' })
}

export async function getDQMatrix(uploadId: string, authToken: string, options?: { limit?: number; offset?: number; start?: number; end?: number }): Promise<any> {
    const params = new URLSearchParams()
    if (options?.limit !== undefined) params.set('limit', String(options.limit))
    if (options?.offset !== undefined) params.set('offset', String(options.offset))
    if (options?.start !== undefined) params.set('start', String(options.start))
    if (options?.end !== undefined) params.set('end', String(options.end))
    const qs = params.toString()
    const endpoint = qs ? `${ENDPOINTS.FILES_DQ_MATRIX(uploadId)}?${qs}` : ENDPOINTS.FILES_DQ_MATRIX(uploadId)
    return makeRequest(endpoint, authToken, { method: "GET" })
}
