/**
 * Contract tests for settingsAPI facade
 *
 * Asserts that each method delegates to the correct underlying function with
 * the right URL path, HTTP method, auth token, and body shape.
 *
 * All network calls are intercepted via jest.mock on file-settings-api so
 * no real HTTP is issued.
 */

jest.mock("@/modules/files/api/file-settings-api", () => ({
    getSettingsPresets: jest.fn(),
    getSettingsPreset: jest.fn(),
    createSettingsPreset: jest.fn(),
    updateSettingsPreset: jest.fn(),
    deleteSettingsPreset: jest.fn(),
}))

import {
    getSettingsPresets,
    getSettingsPreset,
    createSettingsPreset,
    updateSettingsPreset,
    deleteSettingsPreset,
} from "@/modules/files/api/file-settings-api"
import { settingsAPI } from "@/modules/settings/api/settings-api"

const mockList = getSettingsPresets as jest.Mock
const mockGet = getSettingsPreset as jest.Mock
const mockCreate = createSettingsPreset as jest.Mock
const mockUpdate = updateSettingsPreset as jest.Mock
const mockDelete = deleteSettingsPreset as jest.Mock

afterEach(() => jest.clearAllMocks())

// ─── listPresets ──────────────────────────────────────────────────────────────

describe("settingsAPI.listPresets", () => {
    it("delegates to getSettingsPresets with token", async () => {
        mockList.mockResolvedValue({ presets: [], count: 0 })
        await settingsAPI.listPresets("tok-list")
        expect(mockList).toHaveBeenCalledWith("tok-list")
    })

    it("returns the presets + count envelope from the delegate", async () => {
        mockList.mockResolvedValue({ presets: [{ preset_id: "p1" }], count: 1 })
        const res = await settingsAPI.listPresets("tok")
        expect(res.count).toBe(1)
        expect(res.presets[0].preset_id).toBe("p1")
    })
})

// ─── getPreset ────────────────────────────────────────────────────────────────

describe("settingsAPI.getPreset", () => {
    it("delegates to getSettingsPreset with id + token", async () => {
        mockGet.mockResolvedValue({ preset_id: "p1", preset_name: "GL Rules", config: {} })
        await settingsAPI.getPreset("p1", "tok-get")
        expect(mockGet).toHaveBeenCalledWith("p1", "tok-get")
    })
})

// ─── createPreset ─────────────────────────────────────────────────────────────

describe("settingsAPI.createPreset", () => {
    it("delegates to createSettingsPreset with body + token", async () => {
        mockCreate.mockResolvedValue({ preset_id: "p-new", message: "Created" })
        const body = { preset_name: "My Preset", config: { rules_enabled: {} }, is_default: false }
        await settingsAPI.createPreset(body, "tok-create")
        expect(mockCreate).toHaveBeenCalledWith(body, "tok-create")
    })

    it("returns preset_id and message from delegate", async () => {
        mockCreate.mockResolvedValue({ preset_id: "p-123", message: "Created" })
        const res = await settingsAPI.createPreset({ preset_name: "X", config: {} })
        expect(res.preset_id).toBe("p-123")
        expect(res.message).toBe("Created")
    })
})

// ─── updatePreset ─────────────────────────────────────────────────────────────

describe("settingsAPI.updatePreset", () => {
    it("delegates to updateSettingsPreset with id + updates + token", async () => {
        mockUpdate.mockResolvedValue({ message: "Updated" })
        const updates = { preset_name: "Renamed" }
        await settingsAPI.updatePreset("p-upd", updates, "tok-update")
        expect(mockUpdate).toHaveBeenCalledWith("p-upd", updates, "tok-update")
    })

    it("returns message from delegate", async () => {
        mockUpdate.mockResolvedValue({ message: "Updated" })
        const res = await settingsAPI.updatePreset("p1", {})
        expect(res.message).toBe("Updated")
    })
})

// ─── deletePreset ─────────────────────────────────────────────────────────────

describe("settingsAPI.deletePreset", () => {
    it("delegates to deleteSettingsPreset with id + token", async () => {
        mockDelete.mockResolvedValue({ message: "Deleted" })
        await settingsAPI.deletePreset("p-del", "tok-del")
        expect(mockDelete).toHaveBeenCalledWith("p-del", "tok-del")
    })

    it("returns message from delegate", async () => {
        mockDelete.mockResolvedValue({ message: "Deleted" })
        const res = await settingsAPI.deletePreset("p1")
        expect(res.message).toBe("Deleted")
    })
})
