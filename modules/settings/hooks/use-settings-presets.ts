/**
 * use-settings-presets.ts — React hook for DQ preset list management.
 *
 * Responsibilities:
 *  - Fetch & cache the org's preset list on mount (and on explicit refresh).
 *  - Expose loading / error state so callers can render appropriate UI.
 *  - Provide create / update / delete mutations that optimistically update the
 *    local cache before awaiting the network round-trip.
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { settingsAPI } from "@/modules/settings/api/settings-api"
import type {
    SettingsPreset,
    CreatePresetBody,
    UpdatePresetBody,
} from "@/modules/settings/api/settings-api"

// ─── State shape ─────────────────────────────────────────────────────────────

export interface UseSettingsPresetsState {
    /** The current list of presets (undefined while loading). */
    presets: SettingsPreset[] | undefined
    /** True while the initial fetch (or a manual refresh) is in flight. */
    loading: boolean
    /** Non-null when the last fetch/mutation threw. */
    error: Error | null
    /** Reload the preset list from the server. */
    refresh: () => Promise<void>
    /** Create a preset and append it to the local list. */
    createPreset: (body: CreatePresetBody) => Promise<SettingsPreset>
    /** Update a preset in-place in the local list. */
    updatePreset: (presetId: string, updates: UpdatePresetBody) => Promise<void>
    /** Remove a preset from the local list. */
    deletePreset: (presetId: string) => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSettingsPresets(authToken?: string): UseSettingsPresetsState {
    const [presets, setPresets] = useState<SettingsPreset[] | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    // ── fetch ────────────────────────────────────────────────────────────────

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await settingsAPI.listPresets(authToken)
            setPresets(res.presets)
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setLoading(false)
        }
    }, [authToken])

    useEffect(() => {
        void refresh()
    }, [refresh])

    // ── create ───────────────────────────────────────────────────────────────

    const createPreset = useCallback(
        async (body: CreatePresetBody): Promise<SettingsPreset> => {
            const res = await settingsAPI.createPreset(body, authToken)
            // Fetch the full record so we have a proper SettingsPreset to return
            const newPreset = await settingsAPI.getPreset(res.preset_id!, authToken)
            setPresets((prev) => (prev ? [...prev, newPreset] : [newPreset]))
            return newPreset
        },
        [authToken],
    )

    // ── update ───────────────────────────────────────────────────────────────

    const updatePreset = useCallback(
        async (presetId: string, updates: UpdatePresetBody): Promise<void> => {
            await settingsAPI.updatePreset(presetId, updates, authToken)
            setPresets((prev) =>
                prev
                    ? prev.map((p) =>
                          p.preset_id === presetId ? { ...p, ...updates } : p,
                      )
                    : prev,
            )
        },
        [authToken],
    )

    // ── delete ───────────────────────────────────────────────────────────────

    const deletePreset = useCallback(
        async (presetId: string): Promise<void> => {
            await settingsAPI.deletePreset(presetId, authToken)
            setPresets((prev) =>
                prev ? prev.filter((p) => p.preset_id !== presetId) : prev,
            )
        },
        [authToken],
    )

    return { presets, loading, error, refresh, createPreset, updatePreset, deletePreset }
}
