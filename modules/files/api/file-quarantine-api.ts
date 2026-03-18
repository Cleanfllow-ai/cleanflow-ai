/**
 * file-quarantine-api.ts
 *
 * API client for quarantine editor operations including:
 * - Session management
 * - Row querying and pagination
 * - Batch editing
 * - Reprocessing
 * - Version management
 * - Legacy compatibility fallbacks
 */

import { AWS_CONFIG } from '@/shared/config/aws-config'
import { makeRequest } from './file-upload-api'
import type {
    QuarantineManifest,
    QuarantineManifestResponse,
    QuarantineSession,
    QuarantineSessionStartResponse,
    QuarantineQueryRequest,
    QuarantineQueryResponse,
    QuarantineSaveBatchRequest,
    QuarantineSaveBatchResponse,
    QuarantineReprocessRequest,
    QuarantineReprocessResponse,
    LegacyReprocessQuarantinedRequest,
    QuarantineBackfillRequest,
    QuarantineReadModelBackfillResponse,
    FileVersionsResponse,
    CompatibilityReprocessPayload,
    ColumnRuleApplyRequest,
    ColumnRuleApplyResponse,
    ColumnRuleApplyAllRequest,
    ColumnRuleApplyAllResponse,
} from '@/modules/files/types'

// AWS Configuration
const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// API Endpoints for quarantine operations
const ENDPOINTS = {
    MANIFEST: (id: string) => `/files/${id}/quarantined/manifest`,
    QUERY: (id: string) => `/files/${id}/quarantined/query`,
    SESSION_START: (id: string) => `/files/${id}/quarantined/session/start`,
    EDITS_BATCH: (id: string) => `/files/${id}/quarantined/edits/batch`,
    REPROCESS_SUBMIT: (id: string) => `/files/${id}/quarantined/reprocess-submit`,
    BACKFILL: (id: string) => `/files/${id}/quarantined/backfill-read-model`,
    LEGACY_REPROCESS: (id: string) => `/files/${id}/reprocess-quarantined`,
    VERSIONS: (id: string) => `/files/${id}/versions`,
    DOWNLOAD: (id: string) => `/files/${id}/download`,
    QUARANTINED_EXPORT: (id: string) => `/files/${id}/quarantined`,
}

// ========== Quarantine Export ==========

/**
 * Get a presigned download URL for the quarantined rows of a file version.
 * Calls GET /files/{id}/quarantined → { url, filename, row_count }
 */
export async function getQuarantinedExportUrl(
    uploadId: string,
    authToken: string
): Promise<{ url: string | null; filename: string | null; row_count: number }> {
    return makeRequest(
        `/files/${uploadId}/quarantined`,
        authToken,
        { method: 'GET' }
    )
}

// ========== Session & Manifest Operations ==========

/**
 * Get quarantine manifest containing metadata about quarantined rows.
 * If the read model is still building (202), polls quickly until ready.
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @param version - Version to query (default: "latest")
 * @returns Quarantine manifest with columns, row count, and etag
 */
export async function getQuarantineManifest(
    uploadId: string,
    authToken: string,
    version: string = 'latest'
): Promise<QuarantineManifestResponse> {
    const params = new URLSearchParams({ version })
    const endpoint = `${ENDPOINTS.MANIFEST(uploadId)}?${params.toString()}`

    // Progressive backoff: 1s → 2s → 3s → 5s (cap), ~8 min total budget
    const MAX_POLLS = 160
    for (let i = 0; i < MAX_POLLS; i++) {
        const result = await makeRequest(endpoint, authToken, { method: 'GET' })
        if (result.status !== 'building') {
            return result
        }
        const delay = Math.min(1000 + i * 500, 5000)
        console.log(`[QuarantineManifest] Read model building… poll ${i + 1}/${MAX_POLLS} (next in ${delay}ms)`)
        await new Promise((resolve) => setTimeout(resolve, delay))
    }

    throw new Error('Quarantine read model build timed out. Please try again.')
}

/**
 * Start a new quarantine editing session
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @param baseUploadId - Optional base version upload ID
 * @returns Session information including session_id and etag
 */
export async function startQuarantineSession(
    uploadId: string,
    authToken: string,
    baseUploadId?: string
): Promise<QuarantineSessionStartResponse> {
    return makeRequest(
        ENDPOINTS.SESSION_START(uploadId),
        authToken,
        {
            method: 'POST',
            body: JSON.stringify(baseUploadId ? { base_upload_id: baseUploadId } : {}),
        }
    )
}

// ========== Row Query Operations ==========

/**
 * Query quarantined rows with pagination support
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @param payload - Query parameters (version, session_id, cursor, limit)
 * @returns Paginated rows with next cursor
 */
export async function queryQuarantinedRows(
    uploadId: string,
    authToken: string,
    payload: QuarantineQueryRequest
): Promise<QuarantineQueryResponse> {
    return makeRequest(
        ENDPOINTS.QUERY(uploadId),
        authToken,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    )
}

// ========== Edit Operations ==========

/**
 * Save a batch of row edits with optimistic concurrency control
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @param payload - Batch edits with session_id and if_match_etag
 * @returns Next etag and acceptance/rejection counts
 */
export async function saveQuarantineEditsBatch(
    uploadId: string,
    authToken: string,
    payload: QuarantineSaveBatchRequest
): Promise<QuarantineSaveBatchResponse> {
    return makeRequest(
        ENDPOINTS.EDITS_BATCH(uploadId),
        authToken,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    )
}

// ========== Reprocess Operations ==========

/**
 * Submit quarantine reprocess request (creates new version)
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @param payload - Reprocess parameters with session_id and submit_token
 * @returns Execution details including ARN and new upload ID
 */
export async function submitQuarantineReprocess(
    uploadId: string,
    authToken: string,
    payload: QuarantineReprocessRequest
): Promise<QuarantineReprocessResponse> {
    return makeRequest(
        ENDPOINTS.REPROCESS_SUBMIT(uploadId),
        authToken,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    )
}

/**
 * Legacy reprocess endpoint (fallback for older backend versions)
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @param payload - Edited rows and patch notes
 * @returns Reprocess result
 */
export async function reprocessQuarantinedLegacy(
    uploadId: string,
    authToken: string,
    payload: LegacyReprocessQuarantinedRequest
): Promise<QuarantineReprocessResponse> {
    return makeRequest(
        ENDPOINTS.LEGACY_REPROCESS(uploadId),
        authToken,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    )
}

/**
 * Compatibility mode: Submit reprocess via new upload
 * Used when quarantine APIs are unavailable
 * @param authToken - JWT authentication token
 * @param payload - Rows, filename, and processing options
 * @returns Reprocess result
 */
export async function submitCompatibilityReprocessViaUpload(
    authToken: string,
    payload: CompatibilityReprocessPayload
): Promise<QuarantineReprocessResponse> {
    // Convert rows to CSV
    const normalizedRows = payload.rows.map((row) => {
        const copy = { ...row }
        delete copy.row_id
        return copy
    })

    if (!normalizedRows.length) {
        throw new Error('No rows available for compatibility reprocess upload.')
    }

    const csvContent = rowsToCsv(normalizedRows)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const filename = payload.originalFilename || 'quarantine-remediation.csv'

    // Use standard upload flow
    const { initUpload, uploadToS3Post, startProcessing } = await import('./file-upload-api')

    const initResp = await initUpload(filename, 'text/csv', authToken)

    // Upload file
    if (initResp.presignedPost) {
        await uploadToS3Post(initResp.presignedPost.url, initResp.presignedPost.fields, blob as File)
    } else if (initResp.uploadUrl) {
        const { uploadToS3 } = await import('./file-upload-api')
        await uploadToS3(initResp.uploadUrl, blob as File)
    }

    // Start processing
    const processResult = await startProcessing(
        initResp.upload_id,
        authToken,
        payload.processingOptions || {}
    )

    return {
        new_upload_id: initResp.upload_id,
        execution_arn: processResult.dispatch_id,
        status: processResult.status || 'QUEUED',
    }
}

// ========== AI Suggest Fix ==========

export interface AiSuggestFixParams {
    column: string
    value: string
    rule_id?: string
    column_type?: string
    issue_message?: string
    /** For cross-column rules: values of the other columns in the relationship */
    related_columns?: Record<string, string>
    /** For cross-column rules: the condition that must hold, e.g. "CREATED_TS <= UPDATED_TS" */
    cross_condition?: string
}

export interface AiSuggestFixResponse {
    suggestion: string
    confidence: 'high' | 'medium' | 'low'
    reasoning: string
    _cache_hit?: boolean
}

/**
 * Request an AI-generated fix suggestion for a quarantined cell value.
 * Calls GET /files/{id}/quarantined/suggest-fix with cell context.
 * Returns a suggested corrected value with confidence and reasoning.
 */
export async function suggestQuarantineFix(
    uploadId: string,
    authToken: string,
    params: AiSuggestFixParams
): Promise<AiSuggestFixResponse> {
    const queryObj: Record<string, string> = {
        column: params.column,
        value: String(params.value ?? ''),
        rule_id: params.rule_id ?? 'unknown',
        column_type: params.column_type ?? 'text',
        issue_message: params.issue_message ?? '',
    }
    if (params.related_columns && Object.keys(params.related_columns).length > 0) {
        queryObj.related_columns = JSON.stringify(params.related_columns)
    }
    if (params.cross_condition) {
        queryObj.cross_condition = params.cross_condition
    }
    return makeRequest(
        `/files/${uploadId}/quarantined/suggest-fix?${new URLSearchParams(queryObj).toString()}`,
        authToken,
        { method: 'GET' }
    )
}

// ========== AI Column Rule ==========

/**
 * Generate an AI Python transform rule from a natural-language description
 * and apply it to all provided quarantined row values for a column.
 *
 * The backend generates a `fix_value(value: str) -> str` Python function,
 * executes it safely in a sandbox, and returns the proposed fixes.
 */
export async function applyColumnRule(
    uploadId: string,
    authToken: string,
    payload: ColumnRuleApplyRequest
): Promise<ColumnRuleApplyResponse> {
    return makeRequest(
        `/files/${uploadId}/quarantined/column-rule/apply`,
        authToken,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    )
}

/**
 * Apply an AI column rule to ALL quarantined rows for a column server-side.
 * The backend paginates the full read model, applies the cached/generated rule,
 * saves edits in etag-chained batches, and returns the total rows affected.
 */
export async function applyColumnRuleAll(
    uploadId: string,
    authToken: string,
    payload: ColumnRuleApplyAllRequest
): Promise<ColumnRuleApplyAllResponse> {
    return makeRequest(
        `/files/${uploadId}/quarantined/column-rule/apply-all`,
        authToken,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    )
}

// ========== Maintenance Operations ==========

/**
 * Backfill quarantine read model (reconstruct from event store)
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @param version - Version to backfill (default: "latest")
 * @returns Backfill operation result
 */
export async function backfillQuarantineReadModel(
    uploadId: string,
    authToken: string,
    version: string = 'latest'
): Promise<QuarantineReadModelBackfillResponse> {
    return makeRequest(
        ENDPOINTS.BACKFILL(uploadId),
        authToken,
        {
            method: 'POST',
            body: JSON.stringify({ version }),
        }
    )
}

// ========== Version Management ==========

/**
 * Get file version history
 * @param uploadId - File upload ID
 * @param authToken - JWT authentication token
 * @returns List of file versions with metadata
 */
export async function getFileVersions(
    uploadId: string,
    authToken: string
): Promise<FileVersionsResponse> {
    return makeRequest(ENDPOINTS.VERSIONS(uploadId), authToken, { method: 'GET' })
}

/**
 * Download quarantined file (legacy compatibility)
 * @param uploadId - File upload ID
 * @param fileType - File format (csv, excel, json)
 * @param dataType - Data type (quarantine, clean, raw)
 * @param authToken - JWT authentication token
 * @returns File blob
 */
export async function downloadQuarantineFile(
    uploadId: string,
    fileType: 'csv' | 'excel' | 'json',
    dataType: 'quarantine' | 'clean' | 'raw',
    authToken: string
): Promise<Blob> {
    const endpoint = `${ENDPOINTS.DOWNLOAD(uploadId)}?type=${dataType}&_ts=${Date.now()}`
    const url = `${API_BASE_URL}${endpoint}`

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: 'no-store',
    })

    if (!response.ok) {
        let detail = response.statusText || `HTTP ${response.status}`
        try {
            const errBody = await response.json()
            detail = errBody?.error || errBody?.message || detail
        } catch { /* not JSON */ }
        throw new Error(`Download failed: ${detail}`)
    }

    const contentType = response.headers.get('Content-Type') || ''

    // Check if response is JSON (presigned URL)
    if (contentType.includes('application/json')) {
        const json = await response.json()
        if (json.url) {
            const blobResponse = await fetch(json.url)
            return blobResponse.blob()
        }
    }

    return response.blob()
}

// ========== Utility Functions ==========

/**
 * Convert rows to CSV string
 * @param rows - Array of row objects
 * @returns CSV string
 */
function rowsToCsv(rows: Record<string, any>[]): string {
    if (!rows.length) return ''

    const headers = Object.keys(rows[0])
    const csvRows = [
        headers.join(','),
        ...rows.map((row) =>
            headers
                .map((header) => {
                    const value = String(row[header] ?? '')
                    // Escape values containing commas, quotes, or newlines
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        return `"${value.replace(/"/g, '""')}"`
                    }
                    return value
                })
                .join(',')
        ),
    ]
    return csvRows.join('\n')
}

/**
 * Check if error is authorizer mismatch (API Gateway config issue)
 * @param error - Error object
 * @returns True if authorizer mismatch detected
 */
export function isAuthorizerMismatchError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase()
    return (
        message.includes('authorization rejected by api gateway') ||
        (message.includes('invalid key=value pair') && message.includes('authorization header'))
    )
}

/**
 * Check if should fallback to legacy compatibility mode
 * @param error - Error object
 * @returns True if legacy fallback should be used
 */
export function shouldUseLegacyFallback(error: any): boolean {
    const message = String(error?.message || '').toLowerCase()
    if (isAuthorizerMismatchError(error)) return true
    return (
        message.includes('route not found') ||
        message.includes('not found') ||
        message.includes('http 404') ||
        message.includes('missing authentication token')
    )
}
