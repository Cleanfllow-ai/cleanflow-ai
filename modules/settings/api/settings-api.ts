/**
 * settings-api.ts — DQ Preset CRUD client.
 *
 * Wraps modules/files/api/file-settings-api.ts to provide a single
 * settings-scoped namespace. All network calls delegate to file-settings-api
 * so there is one canonical implementation of the auth + makeRequest pattern.
 */

import {
    getSettingsPresets,
    getSettingsPreset,
    createSettingsPreset,
    updateSettingsPreset,
    deleteSettingsPreset,
} from "@/modules/files/api/file-settings-api"
import type { SettingsPreset } from "@/modules/files/types"

// ─── Re-export types used across the settings module ─────────────────────────

export type { SettingsPreset }

// ─── Request / Response shapes ───────────────────────────────────────────────

export interface CreatePresetBody {
    preset_name: string
    config: SettingsPreset["config"]
    is_default?: boolean
}

export interface UpdatePresetBody {
    preset_name?: string
    config?: SettingsPreset["config"]
    is_default?: boolean
}

export interface PresetListResponse {
    presets: SettingsPreset[]
    count: number
}

export interface MutationResponse {
    preset_id?: string
    message: string
}

// ─── API surface ─────────────────────────────────────────────────────────────

export const settingsAPI = {
    /**
     * GET /settings — list all DQ presets for the caller's org.
     */
    listPresets: (token?: string): Promise<PresetListResponse> =>
        getSettingsPresets(token),

    /**
     * GET /settings/{id} — fetch a single preset.
     */
    getPreset: (presetId: string, token?: string): Promise<SettingsPreset> =>
        getSettingsPreset(presetId, token),

    /**
     * POST /settings — create a new DQ preset.
     */
    createPreset: (body: CreatePresetBody, token?: string): Promise<MutationResponse> =>
        createSettingsPreset(body, token),

    /**
     * PUT /settings/{id} — update preset fields.
     */
    updatePreset: (
        presetId: string,
        updates: UpdatePresetBody,
        token?: string,
    ): Promise<MutationResponse> =>
        updateSettingsPreset(presetId, updates, token),

    /**
     * DELETE /settings/{id} — remove a preset (admin-only).
     */
    deletePreset: (presetId: string, token?: string): Promise<MutationResponse> =>
        deleteSettingsPreset(presetId, token),
}
