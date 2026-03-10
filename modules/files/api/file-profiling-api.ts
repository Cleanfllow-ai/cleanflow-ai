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

export async function getColumnProfilingPreview(
    fileId: string,
    authToken: string,
    columns?: string[],
    sampleSize: number = 500
): Promise<ProfilingResponse> {
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
