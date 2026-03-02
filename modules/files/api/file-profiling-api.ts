import { makeRequest } from './file-upload-api'
import type {
    ProfilingResponse,
} from '@/modules/files/types'

// API Endpoints used by this module
const ENDPOINTS = {
    FILES_PROFILING: (id: string) => `/files/${id}/profiling`,
    FILES_PROFILING_PREVIEW: (id: string) => `/files/${id}/profiling-preview`,
}

// ─── Column Profiling ───

export async function getColumnProfiling(fileId: string, authToken: string): Promise<ProfilingResponse> {
    return makeRequest(ENDPOINTS.FILES_PROFILING(fileId), authToken, { method: 'GET' })
}

/**
 * Single request to the profiling-preview endpoint.
 * May return full profiling data OR {status: "in_progress"} if the backend
 * is running asynchronously.
 */
export async function getColumnProfilingPreview(
    fileId: string,
    authToken: string,
    columns?: string[],
    sampleSize: number = 500
): Promise<ProfilingResponse & { status?: string }> {
    const params = new URLSearchParams()
    if (columns && columns.length > 0) {
        params.set('columns', columns.join(','))
    }
    if (sampleSize) {
        params.set('sample', String(sampleSize))
    }
    const qs = params.toString() ? `?${params.toString()}` : ''
    return makeRequest(`${ENDPOINTS.FILES_PROFILING_PREVIEW(fileId)}${qs}`, authToken, { method: 'GET' })
}

/**
 * Poll-based profiling that handles the async backend pattern.
 * Calls the endpoint, and if the backend returns {status: "in_progress"},
 * re-polls every `intervalMs` until results arrive or `timeoutMs` is exceeded.
 */
export async function getColumnProfilingPreviewWithPolling(
    fileId: string,
    authToken: string,
    columns?: string[],
    sampleSize: number = 500,
    opts?: {
        intervalMs?: number
        timeoutMs?: number
        onProgress?: (elapsed: number) => void
        signal?: AbortSignal
    }
): Promise<ProfilingResponse> {
    const intervalMs = opts?.intervalMs ?? 3000
    const timeoutMs = opts?.timeoutMs ?? 600_000 // 10 min max
    const start = Date.now()

    // First call — triggers async profiling if not cached
    const first = await getColumnProfilingPreview(fileId, authToken, columns, sampleSize)
    if (!first.status || first.status !== 'in_progress') {
        return first as ProfilingResponse
    }

    // Poll until ready
    while (true) {
        if (opts?.signal?.aborted) {
            throw new DOMException('Profiling cancelled', 'AbortError')
        }

        const elapsed = Date.now() - start
        if (elapsed > timeoutMs) {
            throw new Error('Profiling timed out. Please try again.')
        }

        opts?.onProgress?.(elapsed)

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, intervalMs)
            opts?.signal?.addEventListener('abort', () => {
                clearTimeout(timer)
                reject(new DOMException('Profiling cancelled', 'AbortError'))
            }, { once: true })
        })

        const poll = await getColumnProfilingPreview(fileId, authToken, columns, sampleSize)
        if (!poll.status || poll.status !== 'in_progress') {
            return poll as ProfilingResponse
        }
    }
}
