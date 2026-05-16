// ─── Generated rule format detection (Phase 8: Custom Rules DSL) ──────────────
//
// Pre-Phase 8 the backend's /apply-rule endpoint returns `rule_code` as a
// Python source string (`def fix_row(row): ...`). After Phase 8 the same
// field may contain a JSON DSL document with a `schema_version`
// discriminator. This helper picks the format at render-time so the
// Custom Rule dialog can show the right label + the right pretty-printed
// body without changing any other UX.
//
// Pure module — intentionally has no React / lucide / Radix imports so
// the unit tests can exercise it without dragging the full UI tree
// through Jest's transformer.

export interface GeneratedRuleFormat {
  /** "dsl" → Phase 8 JSON document; "python" → legacy Python string. */
  format: "dsl" | "python"
  /** The text to render inside <pre>. JSON is pretty-printed for DSL. */
  display: string
}

/**
 * Returns the format + display string for a generated rule payload.
 *
 * DSL is recognised iff the payload parses as a JSON object containing a
 * `schema_version` field (the Phase 8 discriminator). Anything else falls
 * back to Python rendering, including:
 *   - plain Python source strings (the legacy default)
 *   - malformed JSON
 *   - JSON arrays
 *   - JSON objects without `schema_version`
 *
 * The cheap "starts with `{`" pre-check keeps legacy Python source out of
 * the JSON.parse path entirely.
 */
export function detectGeneratedRuleFormat(ruleCode: string): GeneratedRuleFormat {
  const trimmed = ruleCode.trim()
  if (!trimmed.startsWith("{")) {
    return { format: "python", display: ruleCode }
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "schema_version" in (parsed as Record<string, unknown>)
    ) {
      return { format: "dsl", display: JSON.stringify(parsed, null, 2) }
    }
  } catch {
    // Malformed JSON — render verbatim as Python rather than crashing.
  }
  return { format: "python", display: ruleCode }
}
