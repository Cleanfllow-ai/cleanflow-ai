/**
 * Tests for the role-gating + error-surfacing fixes on the settings module.
 *
 * Covers:
 *  - PresetEditor: canEdit=false renders banner, disables save, doesn't submit
 *  - PresetEditor: onError is invoked when settingsAPI throws (no silent swallow)
 *  - PresetEditor: rule_spec is included in the POST body (BE contract)
 *  - PresetList:   canMutate=false hides edit + delete buttons
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
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { PresetEditor } from "@/modules/settings/components/preset-editor"
import { PresetList } from "@/modules/settings/components/preset-list"
import { settingsAPI } from "@/modules/settings/api/settings-api"
import type { SettingsPreset } from "@/modules/settings/api/settings-api"
import { ApiError } from "@/modules/shared/api-error"

const mockCreate = settingsAPI.createPreset as jest.Mock
const mockUpdate = settingsAPI.updatePreset as jest.Mock
const mockGet = settingsAPI.getPreset as jest.Mock

function mkPreset(overrides: Partial<SettingsPreset> = {}): SettingsPreset {
    return {
        preset_id: "p-1",
        preset_name: "Invoice Rules",
        config: { rules_enabled: { R1: true } },
        is_default: false,
        ...overrides,
    }
}

afterEach(() => jest.clearAllMocks())

// ─── PresetEditor — role gating ───────────────────────────────────────────────

describe("PresetEditor — canEdit gate", () => {
    it("renders the read-only banner when canEdit=false", () => {
        render(
            <PresetEditor canEdit={false} onSaved={jest.fn()} onCancel={jest.fn()} />,
        )
        expect(screen.getByTestId("preset-editor-readonly-banner")).toBeInTheDocument()
    })

    it("disables save button when canEdit=false", () => {
        render(
            <PresetEditor canEdit={false} onSaved={jest.fn()} onCancel={jest.fn()} />,
        )
        expect(screen.getByTestId("preset-save-btn")).toBeDisabled()
    })

    it("does not call settingsAPI when canEdit=false and form submitted", async () => {
        const onSaved = jest.fn()
        render(
            <PresetEditor canEdit={false} onSaved={onSaved} onCancel={jest.fn()} />,
        )
        // Force a submit even though button is disabled
        fireEvent.submit(screen.getByTestId("preset-editor-form"))
        expect(mockCreate).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(onSaved).not.toHaveBeenCalled()
    })

    it("renders normally and enables save when canEdit defaults to true", () => {
        render(<PresetEditor onSaved={jest.fn()} onCancel={jest.fn()} />)
        expect(screen.queryByTestId("preset-editor-readonly-banner")).not.toBeInTheDocument()
        expect(screen.getByTestId("preset-save-btn")).not.toBeDisabled()
    })
})

// ─── PresetEditor — onError surfaces BE failures ─────────────────────────────

describe("PresetEditor — onError surfaces failures", () => {
    it("invokes onError when createPreset rejects (no silent swallow)", async () => {
        const err = new ApiError({
            status: 409,
            message: "name taken",
            code: "SETTINGS_PRESET_NAME_TAKEN",
        })
        mockCreate.mockRejectedValue(err)
        const onError = jest.fn()
        render(
            <PresetEditor
                onSaved={jest.fn()}
                onCancel={jest.fn()}
                onError={onError}
                authToken="t"
            />,
        )
        fireEvent.change(screen.getByTestId("preset-name-input"), {
            target: { value: "Dup" },
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId("preset-save-btn"))
        })
        await waitFor(() => expect(onError).toHaveBeenCalledWith(err))
    })

    it("invokes onError when updatePreset rejects with stale-etag", async () => {
        const err = new ApiError({
            status: 409,
            message: "stale",
            code: "SETTINGS_PRESET_STALE",
        })
        mockUpdate.mockRejectedValue(err)
        const onError = jest.fn()
        const preset = mkPreset()
        render(
            <PresetEditor
                preset={preset}
                onSaved={jest.fn()}
                onCancel={jest.fn()}
                onError={onError}
                authToken="t"
            />,
        )
        await act(async () => {
            fireEvent.click(screen.getByTestId("preset-save-btn"))
        })
        await waitFor(() => expect(onError).toHaveBeenCalledWith(err))
    })

    it("resets saving state to false after error", async () => {
        mockCreate.mockRejectedValue(new Error("boom"))
        const onError = jest.fn()
        render(
            <PresetEditor
                onSaved={jest.fn()}
                onCancel={jest.fn()}
                onError={onError}
            />,
        )
        fireEvent.change(screen.getByTestId("preset-name-input"), {
            target: { value: "X" },
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId("preset-save-btn"))
        })
        await waitFor(() => expect(onError).toHaveBeenCalled())
        // After failure, the button should NOT remain in "Saving…" state.
        expect(screen.getByTestId("preset-save-btn")).not.toHaveTextContent("Saving…")
    })
})

// ─── PresetEditor — wire format ───────────────────────────────────────────────

describe("PresetEditor — wire format", () => {
    it("includes rule_spec[] (with id+rule_id+type) in the POST body", async () => {
        mockCreate.mockResolvedValue({ preset_id: "p-new", message: "ok" })
        mockGet.mockResolvedValue(mkPreset({ preset_id: "p-new" }))

        render(
            <PresetEditor onSaved={jest.fn()} onCancel={jest.fn()} authToken="t" />,
        )
        fireEvent.change(screen.getByTestId("preset-name-input"), {
            target: { value: "Test" },
        })
        // Add a rule first
        fireEvent.change(screen.getByTestId("add-rule-input"), {
            target: { value: "R1_null_check" },
        })
        fireEvent.click(screen.getByTestId("add-rule-btn"))

        await act(async () => {
            fireEvent.click(screen.getByTestId("preset-save-btn"))
        })

        await waitFor(() => expect(mockCreate).toHaveBeenCalled())
        const body = mockCreate.mock.calls[0][0]
        expect(body.config).toBeDefined()
        expect(body.config.rules_enabled).toEqual({ R1_null_check: true })
        expect(Array.isArray(body.config.rule_spec)).toBe(true)
        expect(body.config.rule_spec).toHaveLength(1)
        const spec = body.config.rule_spec[0]
        expect(spec.id).toBeDefined()
        expect(spec.rule_id).toBeDefined()
        expect(spec.type).toBeDefined()
    })

    it("refetches the preset after update to capture fresh updated_at", async () => {
        mockUpdate.mockResolvedValue({ message: "Updated" })
        const fresh = mkPreset({ preset_name: "After", updated_at: "2026-05-15T01:00:00Z" })
        mockGet.mockResolvedValue(fresh)

        const onSaved = jest.fn()
        render(
            <PresetEditor
                preset={mkPreset({ preset_name: "Before" })}
                onSaved={onSaved}
                onCancel={jest.fn()}
                authToken="t"
            />,
        )
        fireEvent.change(screen.getByTestId("preset-name-input"), {
            target: { value: "After" },
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId("preset-save-btn"))
        })

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith(fresh))
        expect(mockGet).toHaveBeenCalledWith("p-1", "t")
    })
})

// ─── PresetList — canMutate gate ─────────────────────────────────────────────

describe("PresetList — canMutate gate", () => {
    it("hides edit + delete buttons when canMutate=false", () => {
        const preset = mkPreset({ preset_id: "p-x", is_default: false })
        render(
            <PresetList
                presets={[preset]}
                canMutate={false}
                onEdit={jest.fn()}
                onDelete={jest.fn()}
            />,
        )
        expect(screen.queryByTestId("edit-preset-p-x")).not.toBeInTheDocument()
        expect(screen.queryByTestId("delete-preset-p-x")).not.toBeInTheDocument()
    })

    it("still renders preset names when canMutate=false (read-only view)", () => {
        const preset = mkPreset({ preset_id: "p-x", preset_name: "Read Only" })
        render(
            <PresetList
                presets={[preset]}
                canMutate={false}
                onEdit={jest.fn()}
                onDelete={jest.fn()}
            />,
        )
        expect(screen.getByText("Read Only")).toBeInTheDocument()
    })

    it("shows edit + delete by default (canMutate omitted)", () => {
        const preset = mkPreset({ preset_id: "p-y", is_default: false })
        render(<PresetList presets={[preset]} onEdit={jest.fn()} onDelete={jest.fn()} />)
        expect(screen.getByTestId("edit-preset-p-y")).toBeInTheDocument()
        expect(screen.getByTestId("delete-preset-p-y")).toBeInTheDocument()
    })
})
