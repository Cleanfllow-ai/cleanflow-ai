/**
 * PresetEditor — create or edit a DQ preset.
 *
 * Renders:
 *  - Preset name field
 *  - "Default" toggle
 *  - List of rules (enabled flags from config.rules_enabled)
 *  - Add rule / Remove rule controls
 *  - Save button → POST /settings (create) or PUT /settings/{id} (update)
 */

"use client"

import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { settingsAPI } from "@/modules/settings/api/settings-api"
import type { SettingsPreset } from "@/modules/settings/api/settings-api"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PresetEditorProps {
    /** When provided, the editor is in "edit" mode. */
    preset?: SettingsPreset
    authToken?: string
    onSaved: (saved: SettingsPreset) => void
    onCancel: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PresetEditor({ preset, authToken, onSaved, onCancel }: PresetEditorProps) {
    const isEdit = !!preset

    const [name, setName] = useState(preset?.preset_name ?? "")
    const [isDefault, setIsDefault] = useState(preset?.is_default ?? false)
    const [rules, setRules] = useState<string[]>(
        Object.keys(preset?.config?.rules_enabled ?? {}),
    )
    const [newRule, setNewRule] = useState("")
    const [saving, setSaving] = useState(false)
    const [nameError, setNameError] = useState("")

    // ── validation ───────────────────────────────────────────────────────────

    function validate(): boolean {
        if (!name.trim()) {
            setNameError("Preset name is required.")
            return false
        }
        setNameError("")
        return true
    }

    // ── rule helpers ─────────────────────────────────────────────────────────

    function addRule() {
        const trimmed = newRule.trim()
        if (!trimmed || rules.includes(trimmed)) return
        setRules((r) => [...r, trimmed])
        setNewRule("")
    }

    function removeRule(rule: string) {
        setRules((r) => r.filter((x) => x !== rule))
    }

    // ── submit ───────────────────────────────────────────────────────────────

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!validate()) return

        const rulesEnabled = Object.fromEntries(rules.map((r) => [r, true]))
        const config: SettingsPreset["config"] = { rules_enabled: rulesEnabled }

        setSaving(true)
        try {
            if (isEdit && preset) {
                await settingsAPI.updatePreset(
                    preset.preset_id,
                    { preset_name: name.trim(), config, is_default: isDefault },
                    authToken,
                )
                onSaved({ ...preset, preset_name: name.trim(), config, is_default: isDefault })
            } else {
                const res = await settingsAPI.createPreset(
                    { preset_name: name.trim(), config, is_default: isDefault },
                    authToken,
                )
                const created = await settingsAPI.getPreset(res.preset_id!, authToken)
                onSaved(created)
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} data-testid="preset-editor-form">
            <div className="space-y-5">
                {/* Name */}
                <div>
                    <Label htmlFor="preset-name">Preset name</Label>
                    <Input
                        id="preset-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Invoice Validation"
                        data-testid="preset-name-input"
                    />
                    {nameError && (
                        <p className="text-destructive text-xs mt-1" data-testid="preset-name-error">
                            {nameError}
                        </p>
                    )}
                </div>

                {/* Default toggle */}
                <div className="flex items-center gap-2">
                    <input
                        id="preset-is-default"
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        data-testid="preset-default-checkbox"
                    />
                    <Label htmlFor="preset-is-default">Set as default preset</Label>
                </div>

                {/* Rules list */}
                <div>
                    <Label>Rules</Label>
                    <ul data-testid="preset-rules-list">
                        {rules.map((rule) => (
                            <li key={rule} className="flex items-center gap-2 mt-1">
                                <span className="flex-1 text-sm font-mono">{rule}</span>
                                <button
                                    type="button"
                                    onClick={() => removeRule(rule)}
                                    aria-label={`Remove rule ${rule}`}
                                    data-testid={`remove-rule-${rule}`}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>

                    {/* Add rule */}
                    <div className="flex gap-2 mt-2">
                        <Input
                            value={newRule}
                            onChange={(e) => setNewRule(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRule() } }}
                            placeholder="rule key, e.g. R1_null_check"
                            data-testid="add-rule-input"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={addRule}
                            data-testid="add-rule-btn"
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mt-6">
                <Button type="submit" disabled={saving} data-testid="preset-save-btn">
                    {saving ? "Saving…" : isEdit ? "Update preset" : "Create preset"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    data-testid="preset-cancel-btn"
                >
                    Cancel
                </Button>
            </div>
        </form>
    )
}
