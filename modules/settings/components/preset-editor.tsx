/**
 * PresetEditor — create or edit a DQ preset.
 *
 * Renders:
 *  - Preset name field
 *  - "Default" toggle
 *  - List of rules (rule-key strings; toggled into config.rules_enabled)
 *  - Add rule / Remove rule controls
 *  - Save button → POST /settings (create) or PUT /settings/{id} (update)
 *
 * Wire-format contract (matches contexts/settings/presentation/api/handler.py):
 *   POST /settings  { preset_name, is_default,
 *                     config: { rules_enabled, rule_spec: [{id, rule_id, type, enabled}] } }
 *
 * Both `rules_enabled` (legacy display map) AND `rule_spec` (BE validation
 * target, each item has id+rule_id+type) are sent so the BE validator passes.
 *
 * Errors thrown by settingsAPI bubble out via the `onError` prop so the parent
 * can render a toast — no silent swallow. Validation runs client-side before
 * the network call to catch malformed rule_spec.
 *
 * Role gating: when `canEdit === false` the save button is disabled and a
 * read-only banner is shown. Defaults to `true` to preserve existing callers.
 */

"use client"

import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { settingsAPI } from "@/modules/settings/api/settings-api"
import type { SettingsPreset } from "@/modules/settings/api/settings-api"
import { buildRuleSpec } from "@/modules/settings/lib/validation"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PresetEditorProps {
    /** When provided, the editor is in "edit" mode. */
    preset?: SettingsPreset
    authToken?: string
    onSaved: (saved: SettingsPreset) => void
    onCancel: () => void
    /**
     * Optional error sink. Called when a settingsAPI call rejects so the
     * parent can show a toast (typically via mapSettingsErrorToToast).
     * Without this, save errors would be silently swallowed by the finally
     * block — F2 / F3 / F5 BE errors would never reach the user.
     */
    onError?: (err: unknown) => void
    /**
     * Role gate: when false the save button is disabled and a banner shown.
     * Only Admin / Super Admin should be allowed to mutate presets per BE
     * `_require_settings_admin`. Defaults to true.
     */
    canEdit?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PresetEditor({
    preset,
    authToken,
    onSaved,
    onCancel,
    onError,
    canEdit = true,
}: PresetEditorProps) {
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
        if (!canEdit) return
        if (!validate()) return

        const rulesEnabled = Object.fromEntries(rules.map((r) => [r, true]))
        // BE _validate_config inspects config.rule_spec[] — each entry must carry
        // id+rule_id+type. We synthesise a deterministic rule_spec from the rules
        // list so payloads pass BE validation.
        const ruleSpec = buildRuleSpec(
            rules.map((r) => ({
                id: r,
                column: r,
                rule_type: "custom",
                enabled: true,
            })),
        )
        const config: SettingsPreset["config"] & { rule_spec?: unknown[] } = {
            rules_enabled: rulesEnabled,
        }
        ;(config as Record<string, unknown>).rule_spec = ruleSpec

        setSaving(true)
        try {
            if (isEdit && preset) {
                await settingsAPI.updatePreset(
                    preset.preset_id,
                    { preset_name: name.trim(), config, is_default: isDefault },
                    authToken,
                )
                // Refetch to capture server-assigned updated_at / etag instead
                // of relying on a stale local merge.
                try {
                    const refreshed = await settingsAPI.getPreset(preset.preset_id, authToken)
                    onSaved(refreshed)
                } catch {
                    // If refetch fails (e.g. 401 token expired between calls),
                    // fall back to the optimistic merge so the UI still closes.
                    onSaved({ ...preset, preset_name: name.trim(), config, is_default: isDefault })
                }
            } else {
                const res = await settingsAPI.createPreset(
                    { preset_name: name.trim(), config, is_default: isDefault },
                    authToken,
                )
                const created = await settingsAPI.getPreset(res.preset_id!, authToken)
                onSaved(created)
            }
        } catch (err) {
            // Surface to the parent so a toast can be rendered. Never swallow.
            if (onError) onError(err)
            else throw err
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} data-testid="preset-editor-form">
            {!canEdit && (
                <div
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-4"
                    data-testid="preset-editor-readonly-banner"
                >
                    You don't have permission to edit presets. Contact your admin to request access.
                </div>
            )}
            <div className="space-y-5">
                {/* Name */}
                <div>
                    <Label htmlFor="preset-name">Preset name</Label>
                    <Input
                        id="preset-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Invoice Validation"
                        disabled={!canEdit}
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
                        disabled={!canEdit}
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
                                    disabled={!canEdit}
                                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
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
                            disabled={!canEdit}
                            data-testid="add-rule-input"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={addRule}
                            disabled={!canEdit}
                            data-testid="add-rule-btn"
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mt-6">
                <Button
                    type="submit"
                    disabled={saving || !canEdit}
                    data-testid="preset-save-btn"
                >
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
