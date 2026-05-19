export const DQ_RULE_NAMES: Record<string, string> = {
  // Universal rules
  R1: "Missing Required Value",
  R2: "Duplicate Primary Key",
  R3: "Duplicate Transaction Row",
  R4: "Whitespace Issues",
  R5: "Casing/Formatting",
  R6: "Encoding/Mojibake",
  R7: "Special Characters in IDs",
  R8: "Noise Suffix",
  // Numeric rules
  R9: "Numeric as Text",
  R10: "Out-of-Range / Scale Violation",
  R11: "Unit / Scale Mismatch",
  // Date rules
  R12: "Date Format Inconsistency",
  R13: "Invalid Calendar Date",
  R14: "Unparseable Date",
  R15: "Future-Dated Outside Policy",
  R16: "Mixed Date Separators",
  // Universal (continued)
  R17: "Hidden Null / Control Characters",
  R18: "Excessively Long Text",
  R19: "Status Outside Enum",
  R20: "Business Consistency Violation",
  R21: "Truncated Value / Partial Token",
  R22: "Schema Drift",
  // Security rules
  R23: "HTML Injection",
  R24: "SQL Injection",
  R25: "Script Injection / XSS",
  R26: "PII / Sensitive Data",
  // Domain rules
  R27: "Invalid Currency Code",
  R28: "Invalid GL Account Code",
  R29: "Invalid Fiscal Period",
  R30: "Invalid UOM Code",
  // Contact rules
  R31: "Invalid Address Format",
  R32: "Invalid IP Address",
  R33: "Invalid Email / Phone",
  R34: "Invalid Tax Registration",
  R35: "Unexpected Special Characters",
  R36: "Null-Like Placeholder",
  R37: "Invalid Boolean Value",
  R38: "Numeric Parsability Failure",
  R39: "Mixed-Type Column Value",
}

export const getRuleLabel = (ruleId?: string | null): string => {
  if (!ruleId) return "Unknown Rule"
  if (DQ_RULE_NAMES[ruleId]) return DQ_RULE_NAMES[ruleId]
  if (ruleId.startsWith("CUST_")) return "Custom Rule"
  return "Custom Rule"
}

/**
 * Long-form, business-friendly descriptions used in hover tooltips on every
 * user-facing surface that previously rendered the raw rule code (R1..R39 /
 * CUST_*). The text is intentionally non-technical — no rule numbers, no
 * regex, no DQ-engine jargon — so a junior analyst can read it without
 * Googling.
 *
 * Source of truth: each sentence mirrors the BE
 * `rule_business_messages.RULE_DESCRIPTIONS` entry so the FE and the
 * BE-emitted `top_violations[].description` stay aligned. When the BE
 * supplies a description, callers prefer it; this catalog is the
 * never-empty fallback.
 */
export const DQ_RULE_DESCRIPTIONS: Record<string, string> = {
  R1: "Required value is missing. Every row needs a value in this column.",
  R2: "Primary key is duplicated. Identifiers in this column should be unique.",
  R3: "Transaction row is duplicated. The same row appears more than once.",
  R4: "Leading or trailing whitespace can break joins and lookups.",
  R5: "Mixed capitalization or formatting reduces consistency across rows.",
  R6: "Unreadable characters from a bad encoding (mojibake) — usually a CSV import issue.",
  R7: "Identifier contains unexpected punctuation or special characters.",
  R8: "Value has a noise suffix that looks like a system artifact (e.g. _copy1).",
  R9: "Number is stored as text. Calculations and aggregations will break.",
  R10: "Value is outside the expected numeric range or scale for this column.",
  R11: "Decimal precision or unit does not match the column's expected scale.",
  R12: "Date format varies across rows — mixed formats reduce parsing reliability.",
  R13: "Calendar date does not exist (e.g. Feb 30, 2026-13-05).",
  R14: "Date string cannot be parsed as a real date.",
  R15: "Date is in the future, outside the expected policy window.",
  R16: "Date separators vary within this column (slash + dash + dot mixed).",
  R17: "Hidden null bytes or control characters that can corrupt exports.",
  R18: "Text is excessively long compared to other values in this column.",
  R19: "Value is outside the allowed set of statuses or enum values.",
  R20: "Values across related columns conflict with a business consistency rule.",
  R21: "Value looks truncated or contains only part of an expected token.",
  R22: "Column meaning has drifted from the expected schema definition.",
  R23: "Value contains HTML markup that could be an injection attempt.",
  R24: "Value contains a SQL-injection-like pattern.",
  R25: "Value contains script tags or XSS-style payload.",
  R26: "Sensitive PII detected in a column that should not contain it.",
  R27: "Currency code does not match the ISO 4217 list (USD, EUR, ...).",
  R28: "GL account code is not in the expected ledger code list.",
  R29: "Entry posts to a closed or invalid fiscal period.",
  R30: "Unit of measure is not in the expected UOM list.",
  R31: "Address format does not match the expected postal-address pattern.",
  R32: "IP address is malformed or outside the expected range.",
  R33: "Email or phone number does not match the expected format.",
  R34: "Tax registration ID does not match the expected pattern.",
  R35: "Value contains unexpected special characters for this column type.",
  R36: "Value is a null-like placeholder (N/A, NULL, --, ?).",
  R37: "Boolean value is not one of the accepted true/false representations.",
  R38: "Value should parse as a number but cannot.",
  R39: "Column contains a mix of incompatible value types (text + dates + numbers).",
}

export const getRuleDescription = (ruleId?: string | null): string => {
  if (!ruleId) return ""
  if (DQ_RULE_DESCRIPTIONS[ruleId]) return DQ_RULE_DESCRIPTIONS[ruleId]
  if (ruleId.startsWith("CUST_")) {
    return "Custom rule created by you or your team — see Rules tab for the definition."
  }
  if (ruleId.startsWith("CROSS:")) {
    return "Cross-column business consistency rule — values across the related columns must satisfy the configured relationship."
  }
  if (ruleId.startsWith("INTRA:")) {
    return "Cross-row group-consistency rule — values within the same group of rows must agree."
  }
  return "Data quality rule violation detected in this value."
}
