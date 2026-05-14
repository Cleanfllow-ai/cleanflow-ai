/**
 * Unit tests for PresetEditor component
 *
 * Covers:
 *  - Renders name field, default toggle, rules list, add-rule input
 *  - Create mode: shows "Create preset" button
 *  - Edit mode: pre-populates name + rules, shows "Update preset" button
 *  - Validation: name required
 *  - Add rule appends to rules list
 *  - Remove rule removes from list
 *  - Save in create mode calls settingsAPI.createPreset + getPreset then onSaved
 *  - Save in edit mode calls settingsAPI.updatePreset then onSaved
 *  - Cancel calls onCancel
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock("@/modules/settings/api/settings-api", () => ({
    settingsAPI: {
        createPreset: jest.fn(),
        updatePreset: jest.fn(),
        getPreset: jest.fn(),
        deletePreset: jest.fn(),
        listPresets: jest.fn(),
    },
}))

import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import { PresetEditor } from "@/modules/settings/components/preset-editor"
import { settingsAPI } from "@/modules/settings/api/settings-api"
import type { SettingsPreset } from "@/modules/settings/api/settings-api"

const mockCreate = settingsAPI.createPreset as jest.Mock
const mockUpdate = settingsAPI.updatePreset as jest.Mock
const mockGet = settingsAPI.getPreset as jest.Mock

function mkPreset(overrides: Partial<SettingsPreset> = {}): SettingsPreset {
    return {
        preset_id: "p-123",
        preset_name: "Invoice Rules",
        config: { rules_enabled: { R1_null_check: true, R5_email: true } },
        is_default: false,
        ...overrides,
    }
}

afterEach(() => jest.clearAllMocks())

// ─── Create mode ──────────────────────────────────────────────────────────────

describe("PresetEditor — create mode", () => {
    it("renders empty name field and Create button", () => {
        render(<PresetEditor onSaved={jest.fn()} onCancel={jest.fn()} />)
        expect((screen.getByTestId("preset-name-input") as HTMLInputElement).value).toBe("")
        expect(screen.getByTestId("preset-save-btn")).toHaveTextContent("Create preset")
    })

    it("shows name-required error on empty submit", () => {
        render(<PresetEditor onSaved={jest.fn()} onCancel={jest.fn()} />)
        fireEvent.click(screen.getByTestId("preset-save-btn"))
        expect(screen.getByTestId("preset-name-error")).toBeInTheDocument()
    })

    it("calls createPreset then getPreset on valid submit", async () => {
        const saved = mkPreset({ preset_id: "new-p", preset_name: "GL Rules" })
        mockCreate.mockResolvedValue({ preset_id: "new-p", message: "Created" })
        mockGet.mockResolvedValue(saved)

        const onSaved = jest.fn()
        render(<PresetEditor onSaved={onSaved} onCancel={jest.fn()} authToken="tok" />)
        fireEvent.change(screen.getByTestId("preset-name-input"), { target: { value: "GL Rules" } })
        await act(async () => { fireEvent.click(screen.getByTestId("preset-save-btn")) })

        await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ preset_name: "GL Rules" }),
            "tok",
        ))
        expect(mockGet).toHaveBeenCalledWith("new-p", "tok")
        expect(onSaved).toHaveBeenCalledWith(saved)
    })
})

// ─── Edit mode ────────────────────────────────────────────────────────────────

describe("PresetEditor — edit mode", () => {
    it("pre-populates name and rules from preset prop", () => {
        const preset = mkPreset()
        render(<PresetEditor preset={preset} onSaved={jest.fn()} onCancel={jest.fn()} />)
        expect((screen.getByTestId("preset-name-input") as HTMLInputElement).value).toBe("Invoice Rules")
        expect(screen.getByText("R1_null_check")).toBeInTheDocument()
        expect(screen.getByText("R5_email")).toBeInTheDocument()
    })

    it("shows Update button in edit mode", () => {
        render(<PresetEditor preset={mkPreset()} onSaved={jest.fn()} onCancel={jest.fn()} />)
        expect(screen.getByTestId("preset-save-btn")).toHaveTextContent("Update preset")
    })

    it("calls updatePreset then onSaved on submit", async () => {
        mockUpdate.mockResolvedValue({ message: "Updated" })
        const preset = mkPreset({ preset_id: "p-up" })
        const onSaved = jest.fn()
        render(<PresetEditor preset={preset} onSaved={onSaved} onCancel={jest.fn()} authToken="tok" />)
        fireEvent.change(screen.getByTestId("preset-name-input"), { target: { value: "Renamed" } })
        await act(async () => { fireEvent.click(screen.getByTestId("preset-save-btn")) })

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(
            "p-up",
            expect.objectContaining({ preset_name: "Renamed" }),
            "tok",
        ))
        expect(onSaved).toHaveBeenCalled()
    })
})

// ─── Add / Remove rules ───────────────────────────────────────────────────────

describe("PresetEditor — rule management", () => {
    it("adds a new rule to the list", () => {
        render(<PresetEditor onSaved={jest.fn()} onCancel={jest.fn()} />)
        fireEvent.change(screen.getByTestId("add-rule-input"), { target: { value: "R2_format" } })
        fireEvent.click(screen.getByTestId("add-rule-btn"))
        expect(screen.getByText("R2_format")).toBeInTheDocument()
    })

    it("removes a rule from the list", () => {
        const preset = mkPreset({ config: { rules_enabled: { R1_null_check: true } } })
        render(<PresetEditor preset={preset} onSaved={jest.fn()} onCancel={jest.fn()} />)
        expect(screen.getByText("R1_null_check")).toBeInTheDocument()
        fireEvent.click(screen.getByTestId("remove-rule-R1_null_check"))
        expect(screen.queryByText("R1_null_check")).not.toBeInTheDocument()
    })

    it("does not add a duplicate rule", () => {
        render(<PresetEditor onSaved={jest.fn()} onCancel={jest.fn()} />)
        fireEvent.change(screen.getByTestId("add-rule-input"), { target: { value: "R3" } })
        fireEvent.click(screen.getByTestId("add-rule-btn"))
        fireEvent.change(screen.getByTestId("add-rule-input"), { target: { value: "R3" } })
        fireEvent.click(screen.getByTestId("add-rule-btn"))
        const els = screen.getAllByText("R3")
        expect(els).toHaveLength(1)
    })
})

// ─── Cancel ───────────────────────────────────────────────────────────────────

describe("PresetEditor — cancel", () => {
    it("calls onCancel when Cancel is clicked", () => {
        const onCancel = jest.fn()
        render(<PresetEditor onSaved={jest.fn()} onCancel={onCancel} />)
        fireEvent.click(screen.getByTestId("preset-cancel-btn"))
        expect(onCancel).toHaveBeenCalledTimes(1)
    })
})
