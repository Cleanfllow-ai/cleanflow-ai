/**
 * Unit tests for RuleEditor component + validateRule helper
 *
 * Covers:
 *  - Renders all fields (column, rule_type, threshold, enabled)
 *  - Pre-populates from initial prop
 *  - validateRule: required column, threshold range 0-1
 *  - Inline validation errors shown on invalid submit
 *  - Valid submit calls onSave with correct payload
 *  - Cancel calls onCancel
 */

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { RuleEditor, validateRule } from "@/modules/settings/components/rule-editor"
import type { DQRuleFields } from "@/modules/settings/components/rule-editor"

afterEach(() => jest.clearAllMocks())

// ─── validateRule unit ────────────────────────────────────────────────────────

describe("validateRule", () => {
    it("returns no errors for valid fields", () => {
        const errs = validateRule({ column: "invoice_date", rule_type: "null_check", enabled: true })
        expect(Object.keys(errs)).toHaveLength(0)
    })

    it("requires column to be non-empty", () => {
        expect(validateRule({ column: "" }).column).toBeDefined()
        expect(validateRule({ column: "  " }).column).toBeDefined()
    })

    it("rejects threshold below 0", () => {
        const errs = validateRule({ column: "col", threshold: -0.1 })
        expect(errs.threshold).toBeDefined()
    })

    it("rejects threshold above 1", () => {
        const errs = validateRule({ column: "col", threshold: 1.5 })
        expect(errs.threshold).toBeDefined()
    })

    it("accepts threshold exactly 0 and 1", () => {
        expect(validateRule({ column: "col", threshold: 0 }).threshold).toBeUndefined()
        expect(validateRule({ column: "col", threshold: 1 }).threshold).toBeUndefined()
    })

    it("accepts undefined threshold (optional field)", () => {
        const errs = validateRule({ column: "col", threshold: undefined })
        expect(errs.threshold).toBeUndefined()
    })
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("RuleEditor — rendering", () => {
    it("renders column, rule_type, threshold, and enabled fields", () => {
        render(<RuleEditor onSave={jest.fn()} onCancel={jest.fn()} />)
        expect(screen.getByTestId("rule-column-input")).toBeInTheDocument()
        expect(screen.getByTestId("rule-type-select")).toBeInTheDocument()
        expect(screen.getByTestId("rule-threshold-input")).toBeInTheDocument()
        expect(screen.getByTestId("rule-enabled-checkbox")).toBeInTheDocument()
    })

    it("pre-populates fields from initial prop", () => {
        const initial: Partial<DQRuleFields> = {
            column: "amount",
            rule_type: "range",
            threshold: 0.9,
            enabled: false,
        }
        render(<RuleEditor initial={initial} onSave={jest.fn()} onCancel={jest.fn()} />)
        expect((screen.getByTestId("rule-column-input") as HTMLInputElement).value).toBe("amount")
        expect((screen.getByTestId("rule-type-select") as HTMLSelectElement).value).toBe("range")
        expect((screen.getByTestId("rule-threshold-input") as HTMLInputElement).value).toBe("0.9")
        expect((screen.getByTestId("rule-enabled-checkbox") as HTMLInputElement).checked).toBe(false)
    })
})

// ─── Validation errors ────────────────────────────────────────────────────────

describe("RuleEditor — inline validation", () => {
    it("shows column-required error on submit with empty column", () => {
        render(<RuleEditor onSave={jest.fn()} onCancel={jest.fn()} />)
        fireEvent.submit(screen.getByTestId("rule-editor-form"))
        expect(screen.getByTestId("rule-column-error")).toBeInTheDocument()
    })

    it("shows threshold error when value is out of range", () => {
        render(<RuleEditor onSave={jest.fn()} onCancel={jest.fn()} />)
        fireEvent.change(screen.getByTestId("rule-column-input"), { target: { value: "col" } })
        fireEvent.change(screen.getByTestId("rule-threshold-input"), { target: { value: "2" } })
        fireEvent.submit(screen.getByTestId("rule-editor-form"))
        expect(screen.getByTestId("rule-threshold-error")).toBeInTheDocument()
    })
})

// ─── Submission ───────────────────────────────────────────────────────────────

describe("RuleEditor — submit", () => {
    it("calls onSave with correct payload on valid submit", () => {
        const onSave = jest.fn()
        render(<RuleEditor onSave={onSave} onCancel={jest.fn()} />)
        fireEvent.change(screen.getByTestId("rule-column-input"), { target: { value: "vendor_code" } })
        fireEvent.change(screen.getByTestId("rule-type-select"), { target: { value: "enum" } })
        fireEvent.submit(screen.getByTestId("rule-editor-form"))
        expect(onSave).toHaveBeenCalledTimes(1)
        const arg: DQRuleFields = onSave.mock.calls[0][0]
        expect(arg.column).toBe("vendor_code")
        expect(arg.rule_type).toBe("enum")
        expect(arg.enabled).toBe(true)
    })

    it("does NOT call onSave when validation fails", () => {
        const onSave = jest.fn()
        render(<RuleEditor onSave={onSave} onCancel={jest.fn()} />)
        fireEvent.submit(screen.getByTestId("rule-editor-form"))
        expect(onSave).not.toHaveBeenCalled()
    })
})

// ─── Cancel ───────────────────────────────────────────────────────────────────

describe("RuleEditor — cancel", () => {
    it("calls onCancel when Cancel button is clicked", () => {
        const onCancel = jest.fn()
        render(<RuleEditor onSave={jest.fn()} onCancel={onCancel} />)
        fireEvent.click(screen.getByTestId("rule-cancel-btn"))
        expect(onCancel).toHaveBeenCalledTimes(1)
    })
})
