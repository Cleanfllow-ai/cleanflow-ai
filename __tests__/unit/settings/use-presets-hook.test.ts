/**
 * Unit tests for useSettingsPresets hook
 *
 * Covers:
 *  - Initial fetch: loading=true then false, presets populated
 *  - Fetch error: loading=false, error set
 *  - refresh() re-fetches and updates presets
 *  - createPreset appends to local list
 *  - updatePreset merges fields in-place
 *  - deletePreset removes from local list
 */

jest.mock("@/modules/settings/api/settings-api", () => ({
    settingsAPI: {
        listPresets: jest.fn(),
        createPreset: jest.fn(),
        updatePreset: jest.fn(),
        deletePreset: jest.fn(),
        getPreset: jest.fn(),
    },
}))

import { renderHook, act, waitFor } from "@testing-library/react"
import { useSettingsPresets } from "@/modules/settings/hooks/use-settings-presets"
import { settingsAPI } from "@/modules/settings/api/settings-api"
import type { SettingsPreset } from "@/modules/settings/api/settings-api"

const mockList = settingsAPI.listPresets as jest.Mock
const mockCreate = settingsAPI.createPreset as jest.Mock
const mockUpdate = settingsAPI.updatePreset as jest.Mock
const mockDelete = settingsAPI.deletePreset as jest.Mock
const mockGetPreset = settingsAPI.getPreset as jest.Mock

function mkPreset(overrides: Partial<SettingsPreset> = {}): SettingsPreset {
    return {
        preset_id: `p-${Math.random().toString(36).slice(2)}`,
        preset_name: "Test Preset",
        config: {},
        is_default: false,
        ...overrides,
    }
}

afterEach(() => jest.clearAllMocks())

// ─── Initial fetch ────────────────────────────────────────────────────────────

describe("useSettingsPresets — initial fetch", () => {
    it("starts with loading=true and presets=undefined", () => {
        // Keep the promise pending so we can assert mid-flight state
        mockList.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => useSettingsPresets("tok"))
        expect(result.current.loading).toBe(true)
        expect(result.current.presets).toBeUndefined()
    })

    it("sets presets after successful fetch", async () => {
        const presets = [mkPreset({ preset_name: "GL Rules" })]
        mockList.mockResolvedValue({ presets, count: 1 })
        const { result } = renderHook(() => useSettingsPresets("tok"))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.presets).toHaveLength(1)
        expect(result.current.presets![0].preset_name).toBe("GL Rules")
        expect(result.current.error).toBeNull()
    })

    it("sets error on fetch failure", async () => {
        mockList.mockRejectedValue(new Error("network failure"))
        const { result } = renderHook(() => useSettingsPresets("tok"))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.error?.message).toBe("network failure")
        expect(result.current.presets).toBeUndefined()
    })
})

// ─── refresh ─────────────────────────────────────────────────────────────────

describe("useSettingsPresets — refresh", () => {
    it("re-fetches and updates preset list", async () => {
        const first = [mkPreset({ preset_name: "Old Preset" })]
        const second = [mkPreset({ preset_name: "New Preset" })]
        mockList.mockResolvedValueOnce({ presets: first, count: 1 })
        const { result } = renderHook(() => useSettingsPresets("tok"))
        await waitFor(() => expect(result.current.loading).toBe(false))

        mockList.mockResolvedValueOnce({ presets: second, count: 1 })
        await act(async () => { await result.current.refresh() })

        expect(result.current.presets![0].preset_name).toBe("New Preset")
    })
})

// ─── createPreset ─────────────────────────────────────────────────────────────

describe("useSettingsPresets — createPreset", () => {
    it("appends the new preset to the local list", async () => {
        mockList.mockResolvedValue({ presets: [], count: 0 })
        const newP = mkPreset({ preset_id: "p-new", preset_name: "Created" })
        mockCreate.mockResolvedValue({ preset_id: "p-new", message: "Created" })
        mockGetPreset.mockResolvedValue(newP)

        const { result } = renderHook(() => useSettingsPresets("tok"))
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.createPreset({ preset_name: "Created", config: {} })
        })

        expect(result.current.presets).toHaveLength(1)
        expect(result.current.presets![0].preset_name).toBe("Created")
    })
})

// ─── updatePreset ─────────────────────────────────────────────────────────────

describe("useSettingsPresets — updatePreset", () => {
    it("merges update fields into the existing preset in-place", async () => {
        const existing = mkPreset({ preset_id: "p-upd", preset_name: "Before" })
        mockList.mockResolvedValue({ presets: [existing], count: 1 })
        mockUpdate.mockResolvedValue({ message: "Updated" })

        const { result } = renderHook(() => useSettingsPresets("tok"))
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.updatePreset("p-upd", { preset_name: "After" })
        })

        expect(result.current.presets![0].preset_name).toBe("After")
    })
})

// ─── deletePreset ─────────────────────────────────────────────────────────────

describe("useSettingsPresets — deletePreset", () => {
    it("removes the preset from the local list", async () => {
        const toDelete = mkPreset({ preset_id: "p-del" })
        const keeper = mkPreset({ preset_id: "p-keep" })
        mockList.mockResolvedValue({ presets: [toDelete, keeper], count: 2 })
        mockDelete.mockResolvedValue({ message: "Deleted" })

        const { result } = renderHook(() => useSettingsPresets("tok"))
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.deletePreset("p-del")
        })

        expect(result.current.presets).toHaveLength(1)
        expect(result.current.presets![0].preset_id).toBe("p-keep")
    })
})
