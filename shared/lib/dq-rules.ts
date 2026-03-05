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
  R20: "Cross-Field Inconsistency",
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
}

export const getRuleLabel = (ruleId?: string | null): string => {
  if (!ruleId) return "Unknown Rule"
  return DQ_RULE_NAMES[ruleId] || `Rule ${ruleId}`
}
