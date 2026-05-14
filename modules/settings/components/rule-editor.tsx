/**
 * RuleEditor — form for a single DQ rule entry.
 *
 * Fields:
 *  - column      (string, required)
 *  - rule_type   (enum: "null_check" | "range" | "format" | "enum" | "custom")
 *  - threshold   (0-1 float, optional — used by range / custom rules)
 *  - pattern     (regex string, required when rule_type === "format")
 *  - polars_expr (Polars SQL expression, required when rule_type === "custom")
 *  - enabled     (boolean toggle)
 *
 * Validation runs client-side via modules/settings/lib/validation::validateRuleSpec
 * BEFORE submit so users see inline errors instead of waiting for a BE 422.
 *
 * Calls onSave(DQRuleFields) on submit and onCancel when dismissed.
 */

"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    validateRuleSpec,
    type RuleSpecValidationError,
} from "@/modules/settings/lib/validation"

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuleType = "null_check" | "range" | "format" | "enum" | "custom"

export interface DQRuleFields {
    column: string
    rule_type: RuleType
    threshold?: number
    /** Regex pattern — required when rule_type === "format". */
    pattern?: string
    /** Polars SQL expression — required when rule_type === "custom". */
    polars_expr?: string
    enabled: boolean
}

export interface RuleEditorProps {
    initial?: Partial<DQRuleFields>
    onSave: (rule: DQRuleFields) => void
    onCancel: () => void
}

// ─── Validation (legacy export — delegates to the shared validator) ──────────

export type RuleValidationError = RuleSpecValidationError

/**
 * Back-compat shim: validateRule() is consumed by existing unit tests.
 * Delegates to the shared validateRuleSpec().
 */
export function validateRule(
    rule: Partial<DQRuleFields>,
): RuleValidationError {
    return validateRuleSpec(rule)
}

// ─── Component ────────────────────────────────────────────────────────────────

const RULE_TYPES: RuleType[] = ["null_check", "range", "format", "enum", "custom"]

export function RuleEditor({ initial = {}, onSave, onCancel }: RuleEditorProps) {
    const [column, setColumn] = useState(initial.column ?? "")
    const [ruleType, setRuleType] = useState<RuleType>(initial.rule_type ?? "null_check")
    const [threshold, setThreshold] = useState(
        initial.threshold !== undefined ? String(initial.threshold) : "",
    )
    const [pattern, setPattern] = useState(initial.pattern ?? "")
    const [polarsExpr, setPolarsExpr] = useState(initial.polars_expr ?? "")
    const [enabled, setEnabled] = useState(initial.enabled ?? true)
    const [errors, setErrors] = useState<RuleValidationError>({})

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const parsed: Partial<DQRuleFields> & { pattern?: string; polars_expr?: string } = {
            column: column.trim(),
            rule_type: ruleType,
            threshold: threshold !== "" ? parseFloat(threshold) : undefined,
            enabled,
        }
        if (ruleType === "format") parsed.pattern = pattern
        if (ruleType === "custom") parsed.polars_expr = polarsExpr

        const errs = validateRuleSpec(parsed)
        if (Object.keys(errs).length > 0) {
            setErrors(errs)
            return
        }
        setErrors({})
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

                {/* Pattern (format rules) */}
                {ruleType === "format" && (
                    <div>
                        <Label htmlFor="rule-pattern">Regex pattern</Label>
                        <Input
                            id="rule-pattern"
                            value={pattern}
                            onChange={(e) => setPattern(e.target.value)}
                            placeholder="^[A-Z]{2,4}-\\d{6}$"
                            data-testid="rule-pattern-input"
                        />
                        {errors.pattern && (
                            <p className="text-destructive text-xs mt-1" data-testid="rule-pattern-error">
                                {errors.pattern}
                            </p>
                        )}
                    </div>
                )}

                {/* Polars expression (custom rules) */}
                {ruleType === "custom" && (
                    <div>
                        <Label htmlFor="rule-polars-expr">Polars SQL expression</Label>
                        <Input
                            id="rule-polars-expr"
                            value={polarsExpr}
                            onChange={(e) => setPolarsExpr(e.target.value)}
                            placeholder="amount > 0 AND currency = 'USD'"
                            data-testid="rule-polars-expr-input"
                        />
                        {errors.polars_expr && (
                            <p className="text-destructive text-xs mt-1" data-testid="rule-polars-expr-error">
                                {errors.polars_expr}
                            </p>
                        )}
                    </div>
                )}

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
