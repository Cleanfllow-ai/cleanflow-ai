/**
 * Unit tests for client-side preset validators
 * (modules/settings/lib/validation.ts)
 *
 * Covers:
 *  - validateRegex      → pattern parses as JS RegExp
 *  - validatePolarsExpr → balanced delimiters / quotes, trailing op, DML guard
 *  - validateRuleSpec   → dispatcher returns per-field errors
 *  - buildRuleSpec      → emits BE-shape entries with id+rule_id+type
 */

import {
    validateRegex,
    validatePolarsExpr,
    validateRuleSpec,
    buildRuleSpec,
} from "@/modules/settings/lib/validation"

// ── validateRegex ────────────────────────────────────────────────────────────

describe("validateRegex", () => {
    it("accepts a well-formed pattern", () => {
        expect(validateRegex("^[A-Z]{2,4}-\\d{6}$").valid).toBe(true)
    })

    it("rejects an empty pattern", () => {
        const r = validateRegex("")
        expect(r.valid).toBe(false)
        expect(r.error).toMatch(/required/i)
    })

    it("rejects whitespace-only pattern", () => {
        expect(validateRegex("   ").valid).toBe(false)
    })

    it("rejects an unbalanced group", () => {
        const r = validateRegex("(unclosed")
        expect(r.valid).toBe(false)
        expect(r.error).toMatch(/invalid regex/i)
    })

    it("rejects a dangling backslash", () => {
        const r = validateRegex("trailing\\")
        expect(r.valid).toBe(false)
    })

    it("rejects a bad character class", () => {
        const r = validateRegex("[z-a]")
        expect(r.valid).toBe(false)
    })
})

// ── validatePolarsExpr ───────────────────────────────────────────────────────

describe("validatePolarsExpr", () => {
    it("accepts a well-formed expression", () => {
        expect(validatePolarsExpr("amount > 0 AND currency = 'USD'").valid).toBe(true)
    })

    it("rejects empty / whitespace-only", () => {
        expect(validatePolarsExpr("").valid).toBe(false)
        expect(validatePolarsExpr("   ").valid).toBe(false)
    })

    it("rejects unbalanced parentheses", () => {
        const r = validatePolarsExpr("col_a > (3 + 4")
        expect(r.valid).toBe(false)
        expect(r.error).toMatch(/unbalanced/i)
    })

    it("rejects unbalanced brackets", () => {
        const r = validatePolarsExpr("arr[0")
        expect(r.valid).toBe(false)
    })

    it("rejects unbalanced quotes", () => {
        const r = validatePolarsExpr("status = 'open")
        expect(r.valid).toBe(false)
        expect(r.error).toMatch(/quotes/i)
    })

    it("allows escaped quotes", () => {
        // \' should not toggle the single-quote counter
        const r = validatePolarsExpr("note = 'it\\'s ok'")
        expect(r.valid).toBe(true)
    })

    it("rejects trailing operator", () => {
        expect(validatePolarsExpr("amount >").valid).toBe(false)
        expect(validatePolarsExpr("a AND").valid).toBe(false)
        expect(validatePolarsExpr("x +").valid).toBe(false)
    })

    it("rejects dangerous SQL keywords", () => {
        const r = validatePolarsExpr("DROP TABLE users")
        expect(r.valid).toBe(false)
        expect(r.error).toMatch(/disallowed/i)
    })

    it("rejects DELETE FROM", () => {
        expect(validatePolarsExpr("DELETE FROM x").valid).toBe(false)
    })

    it("rejects statement terminator", () => {
        expect(validatePolarsExpr("amount > 0;").valid).toBe(false)
    })
})

// ── validateRuleSpec dispatcher ──────────────────────────────────────────────

describe("validateRuleSpec", () => {
    it("returns no errors for a valid null_check rule", () => {
        const errs = validateRuleSpec({
            column: "invoice_date",
            rule_type: "null_check",
            enabled: true,
        })
        expect(Object.keys(errs)).toHaveLength(0)
    })

    it("flags missing column", () => {
        const errs = validateRuleSpec({ rule_type: "null_check", enabled: true })
        expect(errs.column).toBeDefined()
    })

    it("flags out-of-range threshold", () => {
        const errs = validateRuleSpec({ column: "x", threshold: 1.5 })
        expect(errs.threshold).toBeDefined()
    })

    it("flags missing pattern for format rules", () => {
        const errs = validateRuleSpec({
            column: "x",
            rule_type: "format",
            enabled: true,
        })
        expect(errs.pattern).toBeDefined()
    })

    it("flags invalid pattern for format rules", () => {
        const errs = validateRuleSpec({
            column: "x",
            rule_type: "format",
            pattern: "(unclosed",
            enabled: true,
        })
        expect(errs.pattern).toBeDefined()
    })

    it("flags missing polars_expr for custom rules", () => {
        const errs = validateRuleSpec({
            column: "x",
            rule_type: "custom",
            enabled: true,
        })
        expect(errs.polars_expr).toBeDefined()
    })

    it("flags invalid polars_expr (unbalanced quotes)", () => {
        const errs = validateRuleSpec({
            column: "x",
            rule_type: "custom",
            polars_expr: "status = 'open",
            enabled: true,
        })
        expect(errs.polars_expr).toBeDefined()
    })

    it("passes a valid custom rule with sane polars_expr", () => {
        const errs = validateRuleSpec({
            column: "x",
            rule_type: "custom",
            polars_expr: "amount > 0",
            enabled: true,
        })
        expect(Object.keys(errs)).toHaveLength(0)
    })
})

// ── buildRuleSpec ────────────────────────────────────────────────────────────

describe("buildRuleSpec", () => {
    it("emits one entry per input rule", () => {
        const out = buildRuleSpec([
            { id: "r1", column: "a", rule_type: "null_check", enabled: true },
            { id: "r2", column: "b", rule_type: "range", enabled: false },
        ])
        expect(out).toHaveLength(2)
    })

    it("every entry has id, rule_id, and type — the three BE-validated fields", () => {
        const out = buildRuleSpec([
            { id: "r1", column: "a", rule_type: "null_check", enabled: true },
        ])
        expect(out[0].id).toBe("r1")
        expect(out[0].rule_id).toBe("r1")
        expect(out[0].type).toBe("null_check")
    })

    it("synthesises a deterministic id from column when not provided", () => {
        const out = buildRuleSpec([
            { column: "Invoice Amount", rule_type: "range", enabled: true },
        ])
        expect(out[0].id).toContain("invoice_amount")
        expect(out[0].rule_id).toBe(out[0].id)
    })

    it("preserves threshold / pattern / polars_expr when present", () => {
        const out = buildRuleSpec([
            {
                id: "r-fmt",
                column: "code",
                rule_type: "format",
                pattern: "^[A-Z]+$",
                threshold: 0.9,
                enabled: true,
            },
        ])
        expect(out[0].pattern).toBe("^[A-Z]+$")
        expect(out[0].threshold).toBe(0.9)
    })

    it("defaults enabled=true when omitted", () => {
        const out = buildRuleSpec([{ id: "r1", column: "a", rule_type: "null_check" }])
        expect(out[0].enabled).toBe(true)
    })
})
