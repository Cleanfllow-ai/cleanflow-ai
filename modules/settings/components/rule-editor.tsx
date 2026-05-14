/**
 * RuleEditor — form for a single DQ rule entry.
 *
 * Fields:
 *  - column     (string, required)
 *  - rule_type  (enum: "null_check" | "range" | "format" | "enum" | "custom")
 *  - threshold  (0-1 float, optional — used by range / custom rules)
 *  - enabled    (boolean toggle)
 *
 * Calls onSave({ column, rule_type, threshold, enabled }) on submit.
 * Calls onCancel when the user dismisses without saving.
 */

"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuleType = "null_check" | "range" | "format" | "enum" | "custom"

export interface DQRuleFields {
    column: string
    rule_type: RuleType
    threshold?: number
    enabled: boolean
}

export interface RuleEditorProps {
    initial?: Partial<DQRuleFields>
    onSave: (rule: DQRuleFields) => void
    onCancel: () => void
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface RuleValidationError {
    column?: string
    threshold?: string
}

export function validateRule(rule: Partial<DQRuleFields>): RuleValidationError {
    const errs: RuleValidationError = {}
    if (!rule.column || rule.column.trim() === "") {
        errs.column = "Column name is required."
    }
    if (rule.threshold !== undefined) {
        if (isNaN(rule.threshold) || rule.threshold < 0 || rule.threshold > 1) {
            errs.threshold = "Threshold must be a number between 0 and 1."
        }
    }
    return errs
}

// ─── Component ────────────────────────────────────────────────────────────────

const RULE_TYPES: RuleType[] = ["null_check", "range", "format", "enum", "custom"]

export function RuleEditor({ initial = {}, onSave, onCancel }: RuleEditorProps) {
    const [column, setColumn] = useState(initial.column ?? "")
    const [ruleType, setRuleType] = useState<RuleType>(initial.rule_type ?? "null_check")
    const [threshold, setThreshold] = useState(
        initial.threshold !== undefined ? String(initial.threshold) : "",
    )
    const [enabled, setEnabled] = useState(initial.enabled ?? true)
    const [errors, setErrors] = useState<RuleValidationError>({})

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const parsed: Partial<DQRuleFields> = {
            column: column.trim(),
            rule_type: ruleType,
            threshold: threshold !== "" ? parseFloat(threshold) : undefined,
            enabled,
        }
        const errs = validateRule(parsed)
        if (Object.keys(errs).length > 0) {
            setErrors(errs)
            return
        }
        onSave(parsed as DQRuleFields)
    }

    return (
        <form onSubmit={handleSubmit} data-testid="rule-editor-form">
            <div className="space-y-4">
                {/* Column */}
                <div>
                    <Label htmlFor="rule-column">Column</Label>
                    <Input
                        id="rule-column"
                        value={column}
                        onChange={(e) => setColumn(e.target.value)}
                        placeholder="e.g. invoice_date"
                        data-testid="rule-column-input"
                    />
                    {errors.column && (
                        <p className="text-destructive text-xs mt-1" data-testid="rule-column-error">
                            {errors.column}
                        </p>
                    )}
                </div>

                {/* Rule type */}
                <div>
                    <Label htmlFor="rule-type">Rule type</Label>
                    <select
                        id="rule-type"
                        value={ruleType}
                        onChange={(e) => setRuleType(e.target.value as RuleType)}
                        data-testid="rule-type-select"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        {RULE_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Threshold */}
                <div>
                    <Label htmlFor="rule-threshold">Threshold (0–1, optional)</Label>
                    <Input
                        id="rule-threshold"
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                        placeholder="0.95"
                        data-testid="rule-threshold-input"
                    />
                    {errors.threshold && (
                        <p className="text-destructive text-xs mt-1" data-testid="rule-threshold-error">
                            {errors.threshold}
                        </p>
                    )}
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center gap-2">
                    <input
                        id="rule-enabled"
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        data-testid="rule-enabled-checkbox"
                    />
                    <Label htmlFor="rule-enabled">Enabled</Label>
                </div>
            </div>

            <div className="flex gap-2 mt-6">
                <Button type="submit" data-testid="rule-save-btn">
                    Save rule
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} data-testid="rule-cancel-btn">
                    Cancel
                </Button>
            </div>
        </form>
    )
}
