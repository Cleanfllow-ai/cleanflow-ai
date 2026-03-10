export type RuleSeverity = "critical" | "warning" | "info"

export const RULE_IDS = Array.from({ length: 34 }, (_, i) => `R${i + 1}`)

export const RULE_METADATA: Record<
  string,
  { name: string; severity: RuleSeverity; description: string }
> = {
  R1: {
    name: "Missing required value",
    severity: "critical",
    description: "Flags empty values in required columns."
  },
  R2: {
    name: "Duplicate primary key",
    severity: "critical",
    description: "Detects repeated identifiers that should be unique."
  },
  R3: {
    name: "Duplicate transaction row",
    severity: "warning",
    description: "Finds repeated rows that may double-count activity."
  },
  R4: {
    name: "Whitespace issues",
    severity: "info",
    description: "Leading or trailing spaces that change matches."
  },
  R5: {
    name: "Casing or formatting inconsistency",
    severity: "info",
    description: "Mixed capitalization or formatting patterns."
  },
  R6: {
    name: "Encoding or mojibake",
    severity: "warning",
    description: "Unreadable characters from bad encoding."
  },
  R7: {
    name: "Special characters in IDs",
    severity: "warning",
    description: "IDs contain unexpected punctuation or symbols."
  },
  R8: {
    name: "Noise suffix",
    severity: "info",
    description: "Extra suffixes that look like system noise."
  },
  R9: {
    name: "Numeric stored as text",
    severity: "warning",
    description: "Numbers stored as strings can break calculations."
  },
  R10: {
    name: "Out-of-range or scale violation",
    severity: "critical",
    description: "Values fall outside expected numeric ranges."
  },
  R11: {
    name: "Unit or scale mismatch",
    severity: "warning",
    description: "Value looks like the wrong unit or scale."
  },
  R12: {
    name: "Date format inconsistency",
    severity: "warning",
    description: "Mixed date formats reduce parsing accuracy."
  },
  R13: {
    name: "Invalid calendar date",
    severity: "warning",
    description: "Dates like Feb 30 are not valid."
  },
  R14: {
    name: "Unparseable date",
    severity: "warning",
    description: "Date strings cannot be parsed reliably."
  },
  R15: {
    name: "Future-dated outside policy",
    severity: "critical",
    description: "Future dates outside expected policy windows."
  },
  R16: {
    name: "Mixed date separators",
    severity: "info",
    description: "Date separators vary within a column."
  },
  R17: {
    name: "Hidden null or control characters",
    severity: "warning",
    description: "Non-printable characters can corrupt exports."
  },
  R18: {
    name: "Excessively long text",
    severity: "info",
    description: "Text length exceeds normal expectations."
  },
  R19: {
    name: "Status outside enum",
    severity: "warning",
    description: "Values are outside the allowed set."
  },
  R20: {
    name: "Cross-field inconsistency",
    severity: "critical",
    description: "Values conflict across related columns."
  },
  R21: {
    name: "Truncated value or partial token",
    severity: "warning",
    description: "Values appear cut off or incomplete."
  },
  R22: {
    name: "Schema drift",
    severity: "critical",
    description: "Column meaning changed from expected schema."
  },
  R23: {
    name: "HTML or script injection",
    severity: "critical",
    description: "Potential markup or script injection risk."
  },
  R24: {
    name: "SQL injection pattern",
    severity: "critical",
    description: "Potential SQL injection-like strings."
  },
  R25: {
    name: "Boolean injection",
    severity: "warning",
    description: "Unexpected boolean-like tokens detected."
  },
  R26: {
    name: "Invalid tax registration",
    severity: "critical",
    description: "Tax registration values appear invalid."
  },
  R27: {
    name: "Invalid currency code",
    severity: "warning",
    description: "Currency codes do not match ISO patterns."
  },
  R28: {
    name: "Invalid GL or subledger code",
    severity: "critical",
    description: "Ledger codes do not match expected lists."
  },
  R29: {
    name: "Posting in closed period",
    severity: "critical",
    description: "Entries appear in a closed accounting period."
  },
  R30: {
    name: "Invalid or unknown UOM",
    severity: "warning",
    description: "Unit of measure does not match expected list."
  },
  R31: {
    name: "Invalid warehouse or location",
    severity: "warning",
    description: "Warehouse or location code not recognized."
  },
  R32: {
    name: "Negative inventory risk",
    severity: "critical",
    description: "Inventory may drop below zero."
  },
  R33: {
    name: "Invalid email or phone",
    severity: "warning",
    description: "Contact values do not match expected formats."
  },
  R34: {
    name: "Missing FX rate for date",
    severity: "critical",
    description: "Currency conversion is missing for the date."
  }
}

export function getRuleMeta(ruleId: string | undefined) {
  const normalized = ruleId?.toUpperCase() || ""
  return (
    RULE_METADATA[normalized] || {
      name: normalized || "Unknown rule",
      severity: "info" as RuleSeverity,
      description: "No description available."
    }
  )
}
