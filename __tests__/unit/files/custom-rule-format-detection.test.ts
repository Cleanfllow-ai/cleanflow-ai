/**
 * Unit tests for detectGeneratedRuleFormat (Phase 8 Custom Rules DSL).
 *
 * The helper picks how to render the `rule_code` field returned by
 * /apply-rule. Pre-Phase 8 the field is Python source; post-Phase 8 it can
 * also be a JSON DSL doc with a `schema_version` discriminator. The dialog
 * stays presentation-identical either way — only the label above the
 * <pre> block changes.
 *
 * Edge cases covered:
 *   - Plain Python source                                    → python
 *   - Python source that happens to mention "{"              → python
 *   - Phase 8 DSL JSON object with schema_version            → dsl, pretty-printed
 *   - JSON without schema_version                            → python (defensive)
 *   - JSON array (not an object)                             → python
 *   - Malformed JSON                                         → python (no throw)
 *   - Whitespace around the JSON                             → dsl, still detected
 */
import { detectGeneratedRuleFormat } from "@/modules/files/components/quarantine-editor/rule-format"

describe("detectGeneratedRuleFormat", () => {
  it("classifies Python source as python", () => {
    const code = `def fix_row(row):\n    row['email'] = row['email'].lower()\n    return row\n`
    const result = detectGeneratedRuleFormat(code)
    expect(result.format).toBe("python")
    expect(result.display).toBe(code)
  })

  it("classifies Python source containing '{' inside a docstring as python", () => {
    const code = `def fix_row(row):\n    """rebuild {something}"""\n    return row\n`
    const result = detectGeneratedRuleFormat(code)
    expect(result.format).toBe("python")
  })

  it("classifies a Phase 8 DSL JSON object with schema_version as dsl", () => {
    const dslDoc = {
      schema_version: "1.0",
      rule: { type: "lowercase", column: "email" },
    }
    const result = detectGeneratedRuleFormat(JSON.stringify(dslDoc))
    expect(result.format).toBe("dsl")
    // Display is pretty-printed JSON
    expect(result.display).toContain('"schema_version": "1.0"')
    expect(result.display.split("\n").length).toBeGreaterThan(1)
  })

  it("falls back to python for JSON object missing schema_version", () => {
    const code = JSON.stringify({ rule: "noop" })
    const result = detectGeneratedRuleFormat(code)
    expect(result.format).toBe("python")
  })

  it("falls back to python for a JSON array", () => {
    const code = JSON.stringify([1, 2, 3])
    expect(detectGeneratedRuleFormat(code).format).toBe("python")
  })

  it("falls back to python for malformed JSON without throwing", () => {
    const code = "{schema_version: bad json"
    const result = detectGeneratedRuleFormat(code)
    expect(result.format).toBe("python")
    expect(result.display).toBe(code)
  })

  it("detects DSL with leading whitespace", () => {
    const dsl = JSON.stringify({ schema_version: "1.0", rule: {} })
    const result = detectGeneratedRuleFormat("   \n" + dsl)
    expect(result.format).toBe("dsl")
  })
})
