import { makeRequest } from './file-upload-api'
import type {
    SettingsPreset,
} from '@/modules/files/types'

// API Endpoints used by this module
const ENDPOINTS = {
    SETTINGS: '/settings',
    SETTINGS_BY_ID: (id: string) => `/settings/${id}`,
}

// ─── Settings Presets ───

export async function getSettingsPresets(authToken?: string): Promise<{ presets: SettingsPreset[]; count: number }> {
    const token = authToken ?? (await getAuth())
    return makeRequest(ENDPOINTS.SETTINGS, token, { method: 'GET' })
}

export async function getSettingsPreset(presetId: string, authToken?: string): Promise<SettingsPreset> {
    const token = authToken ?? (await getAuth())
    return makeRequest(ENDPOINTS.SETTINGS_BY_ID(presetId), token, { method: 'GET' })
}

export async function createSettingsPreset(
    preset: { preset_name: string; config: any; is_default?: boolean },
    authToken?: string
): Promise<{ preset_id: string; message: string }> {
    const token = authToken ?? (await getAuth())
    return makeRequest(ENDPOINTS.SETTINGS, token, {
        method: 'POST',
        body: JSON.stringify(preset)
    })
}

export async function updateSettingsPreset(
    presetId: string,
    updates: { preset_name?: string; config?: any; is_default?: boolean },
    authToken?: string
): Promise<{ message: string }> {
    const token = authToken ?? (await getAuth())
    return makeRequest(ENDPOINTS.SETTINGS_BY_ID(presetId), token, {
        method: 'PUT',
        body: JSON.stringify(updates)
    })
}

export async function deleteSettingsPreset(presetId: string, authToken?: string): Promise<{ message: string }> {
    const token = authToken ?? (await getAuth())
    return makeRequest(ENDPOINTS.SETTINGS_BY_ID(presetId), token, { method: 'DELETE' })
}

// ─── Auth Helper ───

export async function getAuth(): Promise<string> {
    if (typeof window === 'undefined') {
        return ''
    }

    // Primary: use stored authTokens from localStorage (idToken preferred)
    try {
        const raw = window.localStorage.getItem('authTokens')
        if (raw) {
            const parsed = JSON.parse(raw)
            return parsed?.idToken || parsed?.accessToken || ''
        }
    } catch {
        // ignore
    }

    // Fallback: use the global auth token if present
    if ((window as any).__AUTH_TOKEN__) {
        return (window as any).__AUTH_TOKEN__
    }

    return ''
}
