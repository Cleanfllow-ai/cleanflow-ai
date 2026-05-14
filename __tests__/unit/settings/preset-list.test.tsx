/**
 * Unit tests for PresetList component
 *
 * Covers:
 *  - Empty state renders copy
 *  - List renders all preset names
 *  - Default preset shows "Default" badge
 *  - Non-default presets do NOT show "Default" badge
 *  - Edit button triggers onEdit callback with correct preset
 *  - Delete button triggers onDelete for non-default presets
 *  - Delete button is absent for the default preset
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { PresetList } from "@/modules/settings/components/preset-list"
import type { SettingsPreset } from "@/modules/settings/api/settings-api"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkPreset(overrides: Partial<SettingsPreset> = {}): SettingsPreset {
    return {
        preset_id: `p-${Math.random().toString(36).slice(2)}`,
        preset_name: "My Preset",
        config: {},
        is_default: false,
        ...overrides,
    }
}

const noop = jest.fn()
afterEach(() => jest.clearAllMocks())

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("PresetList — empty state", () => {
    it("renders empty-state copy when no presets", () => {
        render(<PresetList presets={[]} onEdit={noop} onDelete={noop} />)
        expect(screen.getByTestId("preset-list-empty")).toBeInTheDocument()
    })

    it("does NOT render the list element when empty", () => {
        render(<PresetList presets={[]} onEdit={noop} onDelete={noop} />)
        expect(screen.queryByTestId("preset-list")).not.toBeInTheDocument()
    })
})

// ─── List rendering ───────────────────────────────────────────────────────────

describe("PresetList — list rendering", () => {
    it("renders all preset names", () => {
        const presets = [mkPreset({ preset_name: "Invoice Rules" }), mkPreset({ preset_name: "GL Rules" })]
        render(<PresetList presets={presets} onEdit={noop} onDelete={noop} />)
        expect(screen.getByText("Invoice Rules")).toBeInTheDocument()
        expect(screen.getByText("GL Rules")).toBeInTheDocument()
    })

    it("renders one row per preset", () => {
        const presets = [mkPreset(), mkPreset(), mkPreset()]
        const { container } = render(<PresetList presets={presets} onEdit={noop} onDelete={noop} />)
        const rows = container.querySelectorAll("[data-testid^='preset-row-']")
        expect(rows).toHaveLength(3)
    })
})

// ─── Default badge ────────────────────────────────────────────────────────────

describe("PresetList — default badge", () => {
    it("shows Default badge for the default preset", () => {
        const preset = mkPreset({ preset_id: "def-1", is_default: true })
        render(<PresetList presets={[preset]} onEdit={noop} onDelete={noop} />)
        expect(screen.getByTestId("preset-default-badge-def-1")).toBeInTheDocument()
        expect(screen.getByText("Default")).toBeInTheDocument()
    })

    it("does NOT show Default badge for non-default presets", () => {
        const preset = mkPreset({ preset_id: "nd-1", is_default: false })
        render(<PresetList presets={[preset]} onEdit={noop} onDelete={noop} />)
        expect(screen.queryByTestId("preset-default-badge-nd-1")).not.toBeInTheDocument()
    })
})

// ─── Edit action ──────────────────────────────────────────────────────────────

describe("PresetList — Edit action", () => {
    it("calls onEdit with the correct preset when Edit is clicked", () => {
        const onEdit = jest.fn()
        const preset = mkPreset({ preset_id: "p-edit", preset_name: "GL Preset" })
        render(<PresetList presets={[preset]} onEdit={onEdit} onDelete={noop} />)
        fireEvent.click(screen.getByTestId("edit-preset-p-edit"))
        expect(onEdit).toHaveBeenCalledTimes(1)
        expect(onEdit).toHaveBeenCalledWith(preset)
    })
})

// ─── Delete action ────────────────────────────────────────────────────────────

describe("PresetList — Delete action", () => {
    it("calls onDelete with the correct preset when Delete is clicked", () => {
        const onDelete = jest.fn()
        const preset = mkPreset({ preset_id: "p-del", is_default: false })
        render(<PresetList presets={[preset]} onEdit={noop} onDelete={onDelete} />)
        fireEvent.click(screen.getByTestId("delete-preset-p-del"))
        expect(onDelete).toHaveBeenCalledTimes(1)
        expect(onDelete).toHaveBeenCalledWith(preset)
    })

    it("does NOT render Delete button for the default preset", () => {
        const preset = mkPreset({ preset_id: "p-default", is_default: true })
        render(<PresetList presets={[preset]} onEdit={noop} onDelete={noop} />)
        expect(screen.queryByTestId("delete-preset-p-default")).not.toBeInTheDocument()
    })
})
