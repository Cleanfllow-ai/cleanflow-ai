import { AWS_CONFIG } from '@/shared/config/aws-config'
import type {
    FileUploadInitResponse,
    FileStatusResponse,
    FileListResponse,
    CustomRuleDefinition,
    CustomRuleSuggestionResponse,
    ColumnTypeOverride,
    CrossFieldRule,
} from '@/modules/files/types'

// AWS Configuration
const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// API Endpoints used by this module
const ENDPOINTS = {
    UPLOADS: '/uploads',
    FILES_PROCESS: (id: string) => `/files/${id}/process`,
    FILES_STATUS: (id: string) => `/files/${id}/status`,
    FILES_COLUMNS: (id: string) => `/files/${id}/columns`,
    FILES_CUSTOM_RULE_SUGGEST: (id: string) => `/files/${id}/custom-rule-suggest`,
    FILES_CROSS_RULE_SUGGEST: (id: string) => `/files/${id}/cross-rule-suggest`,
}

// ─── Shared HTTP helper ───

export async function makeRequest(endpoint: string, authToken: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>
    }

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
    }

    console.log('📡 API Request:', url, options.method || 'GET')

    try {
        const response = await fetch(url, { ...options, headers })
        console.log('📥 Response:', response.status)

        if (!response.ok) {
            const raw = await response.json().catch(() => ({}))
            const errorData = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {}
            const fallbackMsg = typeof raw === "string" ? raw : `HTTP ${response.status}`
            const error = new Error(errorData.error || errorData.message || fallbackMsg)
            ;(error as any).status = response.status

            // Don't log expected/handled errors to reduce console noise.
            const isSettingsNotFound = url.includes('/settings/presets') && response.status === 404
            const errorMessage = (errorData.error || errorData.message || fallbackMsg || '').toLowerCase()
            const isPermissionDenied = response.status === 403
            const isMembershipRequired = errorMessage.includes('organization membership required')
            const isStaleEtagConflict = response.status === 409 && url.includes('/quarantine')
            if (!isSettingsNotFound && !isPermissionDenied && !isMembershipRequired && !isStaleEtagConflict) {
                console.error('❌ API Error:', error)
            }

            throw error
        }

        return await response.json()
    } catch (error) {
        // Only log if not already logged above
        const url_lower = url.toLowerCase()
        const isSettingsError = url_lower.includes('/settings/presets')
        const messageLower = error instanceof Error ? error.message.toLowerCase() : ''
        const isPermissionDeniedError = messageLower.includes('permission denied')
        const isMembershipRequiredError = messageLower.includes('organization membership required')
        if (!isSettingsError && !isPermissionDeniedError && !isMembershipRequiredError && !(error instanceof Error && error.message.includes('HTTP'))) {
            console.error('❌ API Error:', error)
        }
        throw error
    }
}

// ─── Upload & File Management ───

export async function initUpload(filename: string, contentType: string, authToken: string, useAI: boolean = false): Promise<FileUploadInitResponse> {
    console.log('🔄 Initializing upload:', filename, useAI ? '(AI Processing)' : '(Rules-Based)')
    return makeRequest(ENDPOINTS.UPLOADS, authToken, {
        method: "POST",
        body: JSON.stringify({
            filename,
            content_type: contentType,
            use_ai_processing: useAI
        })
    })
}

export async function getUploads(authToken: string): Promise<FileListResponse> {
    console.log('Fetching files list from /uploads endpoint')
    try {
        const response = await makeRequest(ENDPOINTS.UPLOADS, authToken, { method: 'GET' })
        return {
            items: response.items || [],
            count: response.count || 0
        }
    } catch (error: any) {
        const message = (error?.message || "").toLowerCase()
        if (
            message.includes("permission denied") ||
            message.includes("forbidden") ||
            message.includes("organization membership required")
        ) {
            return { items: [], count: 0 }
        }
        throw error
    }
}

export async function getFileStatus(uploadId: string, authToken: string): Promise<FileStatusResponse> {
    return makeRequest(ENDPOINTS.FILES_STATUS(uploadId), authToken, { method: 'GET' })
}

export async function getFileColumns(uploadId: string, authToken: string): Promise<{ columns: string[] }> {
    return makeRequest(ENDPOINTS.FILES_COLUMNS(uploadId), authToken, { method: 'GET' })
}

export async function deleteUpload(uploadId: string, authToken: string): Promise<void> {
    return makeRequest(`/uploads/${uploadId}`, authToken, {
        method: 'DELETE'
    })
}

export async function confirmUpload(uploadId: string, authToken: string, totalSize: number): Promise<void> {
    return makeRequest(`/uploads/${uploadId}/confirm`, authToken, {
        method: 'POST',
        body: JSON.stringify({ total_size: totalSize }),
    })
}

// ─── S3 Upload Methods ───

export async function uploadToS3(presignedUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    if (!presignedUrl || presignedUrl === 'undefined') {
        console.error('❌ Invalid presigned URL:', presignedUrl)
        throw new Error('Invalid presigned URL received from server')
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        if (onProgress) {
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    onProgress(Math.round((event.loaded / event.total) * 100))
                }
            })
        }

        xhr.addEventListener('load', () => {
            if (xhr.status === 200 || xhr.status === 204) {
                resolve()
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`))
            }
        })

        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

        xhr.open('PUT', presignedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.send(file)
    })
}

export async function uploadToS3Post(presignedUrl: string, fields: Record<string, string>, file: File, onProgress?: (progress: number) => void): Promise<void> {
    if (!presignedUrl || presignedUrl === 'undefined') {
        console.error('❌ Invalid presigned URL:', presignedUrl)
        throw new Error('Invalid presigned URL received from server')
    }

    return new Promise((resolve, reject) => {
        const formData = new FormData()
        Object.keys(fields).forEach(key => formData.append(key, fields[key]))
        formData.append('file', file)

        const xhr = new XMLHttpRequest()

        if (onProgress) {
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    onProgress(Math.round((event.loaded / event.total) * 100))
                }
            })
        }

        xhr.addEventListener('load', () => {
            if (xhr.status === 200 || xhr.status === 204) {
                resolve()
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`))
            }
        })

        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

        xhr.open('POST', presignedUrl)
        xhr.send(formData)
    })
}

// ─── Polling ───

export async function pollFileStatus(uploadId: string, authToken: string, onStatusUpdate: (status: FileStatusResponse) => void, maxAttempts: number = 60, intervalMs: number = 2000): Promise<FileStatusResponse> {
    const terminalStatuses = ['DQ_FIXED', 'FAILED', 'COMPLETED', 'DQ_FAILED', 'SHARD_FAILED', 'REJECTED']
    let attempts = 0

    while (attempts < maxAttempts) {
        attempts++
        const status = await getFileStatus(uploadId, authToken)
        onStatusUpdate(status)

        if (terminalStatuses.includes(status.status)) {
            return status
        }

        await new Promise(r => setTimeout(r, intervalMs))
    }

    throw new Error('Polling timeout')
}

// Enhanced smart polling with multiple fallback detection methods - 30 minute timeout
export async function pollFileStatusSmart(uploadId: string, authToken: string, onStatusUpdate: (status: FileStatusResponse) => void, maxAttempts: number = 180): Promise<FileStatusResponse> {
    const terminalStatuses = ['DQ_FIXED', 'COMPLETED', 'DQ_FAILED', 'FAILED', 'SHARD_FAILED', 'REJECTED']
    let attempts = 0
    let consecutiveSameStatus = 0
    let lastStatus: FileStatusResponse | null = null

    while (attempts < maxAttempts) {
        try {
            attempts++
            console.log(`🔄 Smart poll attempt ${attempts}/${maxAttempts} for ${uploadId}`)

            const status = await getFileStatus(uploadId, authToken)

            // Track if status is stuck
            if (lastStatus && lastStatus.status === status.status) {
                consecutiveSameStatus++
            } else {
                consecutiveSameStatus = 0
            }
            lastStatus = status

            onStatusUpdate(status)

            // Terminal statuses
            if (terminalStatuses.includes(status.status)) {
                console.log(`✅ Polling completed: ${status.status}`)
                return status
            }

            // Smart completion detection after reasonable time
            if (attempts > 20 && ['DQ_RUNNING', 'QUEUED'].includes(status.status)) {
                const completionStatus = await detectCompletion(uploadId, authToken, status)
                if (completionStatus) {
                    console.log('✨ Smart detection found completion')
                    onStatusUpdate(completionStatus)
                    return completionStatus
                }
            }

            if (attempts >= maxAttempts) {
                // Final attempt at smart detection
                const finalStatus = await detectCompletion(uploadId, authToken, status)
                if (finalStatus) {
                    onStatusUpdate(finalStatus)
                    return finalStatus
                }
                throw new Error(`Polling timeout after ${maxAttempts} attempts`)
            }

            // 10 second intervals
            await new Promise(r => setTimeout(r, 10000))
        } catch (error) {
            console.error(`❌ Polling error on attempt ${attempts}:`, error)

            // Retry network errors with backoff
            if (attempts < 5 && (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network')))) {
                const backoffTime = attempts * 2000
                await new Promise(r => setTimeout(r, backoffTime))
                continue
            }

            throw error
        }
    }

    throw new Error(`Polling timeout after ${maxAttempts} attempts`)
}

// Smart completion detection methods
async function detectCompletion(uploadId: string, authToken: string, currentStatus: FileStatusResponse): Promise<FileStatusResponse | null> {
    // Try multiple detection methods
    try {
        // Method 1: Check files list
        const response = await getUploads(authToken)
        const fileRecord = response.items?.find((f) => f.upload_id === uploadId)
        if (fileRecord && fileRecord.status === 'DQ_FIXED') {
            return {
                ...currentStatus,
                ...fileRecord,
                completion_detected_by: 'files_list_check'
            } as FileStatusResponse
        }
    } catch (error) {
        console.log('⚠️ Smart detection method failed:', error)
    }

    return null
}

// ─── Processing ───

export async function startProcessing(
    uploadId: string,
    authToken: string,
    options?: {
        selected_columns?: string[]
        required_columns?: string[]
        global_disabled_rules?: string[]
        disable_rules?: Record<string, string[]>
        column_rules_override?: Record<string, string[]>
        custom_rules?: CustomRuleDefinition[]
        preset_id?: string
        preset_overrides?: Record<string, any>
        column_type_overrides?: Record<string, ColumnTypeOverride>
        cross_field_rules?: CrossFieldRule[]
    }
): Promise<any> {
    console.log('Starting processing:', uploadId, options?.custom_rules?.length ? '(with custom rules)' : '')
    const payload: Record<string, any> = {}

    if (options?.selected_columns && Array.isArray(options.selected_columns)) {
        const filtered = options.selected_columns
            .map(c => (c ?? '').toString().trim())
            .filter(c => c.length > 0)
        if (filtered.length > 0) {
            payload.selected_columns = filtered
        }
    }

    if (options?.required_columns) {
        payload.required_columns = options.required_columns
    }

    if (options?.global_disabled_rules) {
        payload.global_disabled_rules = options.global_disabled_rules
    }

    if (options?.disable_rules) {
        payload.disable_rules = options.disable_rules
    }

    if (options?.column_rules_override) {
        payload.column_rules_override = options.column_rules_override
    }

    if (options?.custom_rules) {
        payload.custom_rules = options.custom_rules
    }

    if (options?.preset_id) {
        payload.preset_id = options.preset_id
    }

    if (options?.preset_overrides && Object.keys(options.preset_overrides).length > 0) {
        payload.preset_overrides = options.preset_overrides
    }

    if (options?.column_type_overrides) {
        payload.column_type_overrides = options.column_type_overrides
    }

    if (options?.cross_field_rules) {
        payload.cross_field_rules = options.cross_field_rules
    }

    return makeRequest(ENDPOINTS.FILES_PROCESS(uploadId), authToken, {
        method: "POST",
        body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined
    })
}

export async function suggestCustomRule(
    uploadId: string,
    authToken: string,
    payload: { column: string; prompt: string }
): Promise<CustomRuleSuggestionResponse> {
    return makeRequest(ENDPOINTS.FILES_CUSTOM_RULE_SUGGEST(uploadId), authToken, {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

export async function suggestCrossColumnRule(
    uploadId: string,
    authToken: string,
    payload: { prompt: string; columns?: string[] }
): Promise<{ rules: CrossFieldRule[] }> {
    return makeRequest(ENDPOINTS.FILES_CROSS_RULE_SUGGEST(uploadId), authToken, {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

// ─── Complete Upload Workflow ───

export async function uploadFileComplete(file: File, authToken: string, useAI: boolean = false, onProgress?: (progress: number) => void, onStatusUpdate?: (status: FileStatusResponse) => void, autoProcess: boolean = false): Promise<FileStatusResponse> {
    try {
        if (onProgress) onProgress(0)
        // Step 1: Initialize upload - backend returns presigned URL
        const initResponse = await initUpload(file.name, file.type || 'text/csv', authToken, useAI)
        console.log('📤 Upload initialized:', initResponse)
        if (onProgress) onProgress(10)

        // Step 2: Upload to S3 using presigned POST (preferred) or PUT (fallback)
        console.log('📤 Uploading to S3...')
        if (initResponse.usePost && initResponse.presignedPost) {
            console.log('🟢 Using presigned POST method')
            await uploadToS3Post(
                initResponse.presignedPost.url,
                initResponse.presignedPost.fields,
                file,
                (s3Progress) => {
                    if (onProgress) onProgress(10 + (s3Progress * 0.4))
                }
            )
        }
        else if (initResponse.fields && initResponse.url) {
            console.log('🟡 Using fields-based POST method (legacy)')
            await uploadToS3Post(initResponse.url, initResponse.fields, file, (s3Progress) => {
                if (onProgress) onProgress(10 + (s3Progress * 0.4))
            })
        }
        else if (initResponse.uploadUrl) {
            console.log('🟠 Using PUT method (deprecated)')
            await uploadToS3(initResponse.uploadUrl, file, (s3Progress) => {
                if (onProgress) onProgress(10 + (s3Progress * 0.4))
            })
        }
        else if (initResponse.url) {
            console.log('🔴 Using url field with PUT (last resort)')
            await uploadToS3(initResponse.url, file, (s3Progress) => {
                if (onProgress) onProgress(10 + (s3Progress * 0.4))
            })
        } else {
            throw new Error('No valid upload method provided by backend')
        }
        console.log('✅ S3 upload complete')
        if (onProgress) onProgress(100)

        // Return upload status without auto-processing
        if (!autoProcess) {
            const uploadedStatus: FileStatusResponse = {
                upload_id: initResponse.upload_id,
                status: 'UPLOADED',
                filename: file.name,
                original_filename: file.name,
                created_at: new Date().toISOString(),
                rows_in: undefined,
                rows_out: undefined,
                dq_score: undefined,
                execution_arn: undefined,
            } as FileStatusResponse
            if (onStatusUpdate) onStatusUpdate(uploadedStatus)
            return uploadedStatus
        }

        // Step 3: Trigger processing
        try {
            await startProcessing(initResponse.upload_id, authToken)
            console.log('✅ Processing triggered')
            if (onProgress) onProgress(60)

            // Step 4: Poll for status with smart detection
            const finalStatus = await pollFileStatusSmart(initResponse.upload_id, authToken, (status) => {
                console.log('📊 Status update:', status.status)
                if (onStatusUpdate) onStatusUpdate(status)
                if (onProgress) {
                    const statusProgress: Record<string, number> = {
                        'UPLOADED': 70,
                        'VALIDATED': 72,
                        'QUEUED': 75,
                        'DQ_DISPATCHED': 78,
                        'DQ_RUNNING': 85,
                        'NORMALIZING': 90,
                        'DQ_FIXED': 100,
                        'FAILED': 100,
                        'COMPLETED': 100,
                        'REJECTED': 100,
                    }
                    onProgress(statusProgress[status.status] || 60)
                }
            }, 180)

            return finalStatus
        } catch (processingError) {
            console.error('⚠️ Processing failed but upload succeeded:', processingError)
            return {
                upload_id: initResponse.upload_id,
                status: 'UPLOADED',
                filename: file.name,
                created_at: new Date().toISOString(),
                rows_in: undefined,
                rows_out: undefined,
                dq_score: undefined,
                execution_arn: undefined,
            } as FileStatusResponse
        }
    } catch (error) {
        console.error('❌ Upload workflow failed:', error)
        throw error
    }
}
