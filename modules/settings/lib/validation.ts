/**
 * Client-side validators for DQ preset rule definitions.
 *
 * Catches malformed payloads BEFORE the network round-trip so the user
 * gets an inline error instead of a 400 / 422 from the backend.
 *
 * Backend contract (contexts/settings/presentation/api/handler.py):
 *   - POST /settings  body: { preset_name, is_default, config: { rule_spec[] } }
 *   - Each rule_spec item must be an object with at least one of: id, rule_id, type
 *   - Custom rules carry a `polars_expr` string compiled with `pl.sql_expr(...)`
 *     by the DQ engine. Invalid expressions surface as a runtime engine error
 *     much later — we want to flag them at save time.
 *
 * Scope:
 *   - validateRegex      → for rule_type === "format"
 *   - validatePolarsExpr → for rule_type === "custom"
 *   - validateRuleSpec   → top-level dispatcher used by editors
 */

import type { RuleType, DQRuleFields } from "@/modules/settings/components/rule-editor"

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ValidationResult {
    valid: boolean
    /** Human-readable error message (empty when valid). */
    error: string
}

const OK: ValidationResult = { valid: true, error: "" }

// ─── Regex validation ─────────────────────────────────────────────────────────

/**
 * Verify that `pattern` parses as a JavaScript regex. We use the JS engine
 * as a proxy because regex grammars are largely portable; the Polars engine
 * uses Rust's `regex` crate which is a strict superset of POSIX ERE but the
 * common syntactic mistakes (unbalanced parens, dangling `\`, bad character
 * class) all fail here too. False positives are acceptable — the engine has
 * its own safe_re wrapper as a backstop.
 */
export function validateRegex(pattern: string): ValidationResult {
    if (typeof pattern !== "string" || pattern.trim() === "") {
        return { valid: false, error: "Pattern is required for format rules." }
    }
    try {
        new RegExp(pattern)
        return OK
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { valid: false, error: `Invalid regex: ${msg}` }
    }
}

// ─── Polars expression validation ─────────────────────────────────────────────

/**
 * Lightweight syntactic check for a Polars SQL expression string.
 *
 * Full parsing requires the Polars runtime, which we cannot ship to the
 * browser. We catch the high-frequency mistakes that have caused BE 422s
 * historically:
 *   - empty / whitespace-only string
 *   - unbalanced parentheses, brackets, or braces
 *   - unbalanced single / double quotes
 *   - trailing operator (`AND`, `OR`, `=`, `<`, `>`, `+`, `-`, `*`, `/`)
 *   - obviously dangerous SQL (semicolon, DROP, DELETE FROM, etc.)
 */
const DANGEROUS_SQL = /(\b(DROP|DELETE\s+FROM|TRUNCATE|ALTER|EXEC|INSERT\s+INTO|UPDATE\s+\w+\s+SET)\b|;)/i
const TRAILING_OP = /(\b(AND|OR)\b|[=<>+\-*/])\s*$/i

export function validatePolarsExpr(expr: string): ValidationResult {
    if (typeof expr !== "string" || expr.trim() === "") {
        return { valid: false, error: "Expression is required for custom rules." }
    }

    // Balanced delimiters
    const pairs: Array<[string, string]> = [["(", ")"], ["[", "]"], ["{", "}"]]
    for (const [open, close] of pairs) {
        let depth = 0
        for (const ch of expr) {
            if (ch === open) depth++
            else if (ch === close) depth--
            if (depth < 0) {
                return { valid: false, error: `Unbalanced ${open}${close} in expression.` }
            }
        }
        if (depth !== 0) {
            return { valid: false, error: `Unbalanced ${open}${close} in expression.` }
        }
    }

    // Balanced quotes (single + double, not inside the other)
    let single = 0
    let double = 0
    let escaped = false
    for (const ch of expr) {
        if (escaped) { escaped = false; continue }
        if (ch === "\\") { escaped = true; continue }
        if (ch === "'" && double === 0) single = single === 0 ? 1 : 0
        else if (ch === "\"" && single === 0) double = double === 0 ? 1 : 0
    }
    if (single !== 0 || double !== 0) {
        return { valid: false, error: "Unbalanced quotes in expression." }
    }

    // Trailing operator
    if (TRAILING_OP.test(expr.trim())) {
        return { valid: false, error: "Expression ends with an operator — incomplete." }
    }

    // Dangerous SQL guard (we never want a DML/DDL statement reaching the engine)
    if (DANGEROUS_SQL.test(expr)) {
        return { valid: false, error: "Expression contains disallowed SQL keywords." }
    }

    return OK
}

// ─── Rule-level dispatcher ───────────────────────────────────────────────────

export interface RuleSpecValidationError {
    column?: string
    threshold?: string
    pattern?: string
    polars_expr?: string
}

/**
 * Validate a single DQRuleFields entry (plus optional `pattern` / `polars_expr`).
 *
 * Returns an object map keyed by field. Empty object means the rule is valid.
 */
export function validateRuleSpec(
    rule: Partial<DQRuleFields> & { pattern?: string; polars_expr?: string },
): RuleSpecValidationError {
    const errs: RuleSpecValidationError = {}

    if (!rule.column || rule.column.trim() === "") {
        errs.column = "Column name is required."
    }
    if (rule.threshold !== undefined) {
        if (isNaN(rule.threshold) || rule.threshold < 0 || rule.threshold > 1) {
            errs.threshold = "Threshold must be a number between 0 and 1."
        }
    }
    if (rule.rule_type === "format") {
        const r = validateRegex(rule.pattern ?? "")
        if (!r.valid) errs.pattern = r.error
    }
    if (rule.rule_type === "custom") {
        const r = validatePolarsExpr(rule.polars_expr ?? "")
        if (!r.valid) errs.polars_expr = r.error
    }

    return errs
}

// ─── Rule-spec payload builder ────────────────────────────────────────────────

/**
 * Build the BE-compatible `rule_spec[]` array from the FE editor's rule list.
 *
 * Each entry MUST include at least one of {id, rule_id, type} per BE _validate_config.
 * We synthesise a deterministic `id` from the rule key so the BE check passes.
 */
export interface BackendRuleSpec {
    id: string
    rule_id: string
    type: RuleType | string
    column?: string
    enabled: boolean
    threshold?: number
    pattern?: string
    polars_expr?: string
}

export function buildRuleSpec(
    rules: Array<Partial<DQRuleFields> & { id?: string; pattern?: string; polars_expr?: string }>,
): BackendRuleSpec[] {
    return rules.map((r, idx) => {
        const id = r.id ?? `rule_${idx}_${(r.column ?? "unnamed").trim().toLowerCase().replace(/\s+/g, "_")}`
        const type = r.rule_type ?? "null_check"
        const spec: BackendRuleSpec = {
            id,
            rule_id: id,
            type,
            enabled: r.enabled ?? true,
        }
        if (r.column) spec.column = r.column
        if (r.threshold !== undefined) spec.threshold = r.threshold
        if (r.pattern) spec.pattern = r.pattern
        if (r.polars_expr) spec.polars_expr = r.polars_expr
        return spec
    })
}
