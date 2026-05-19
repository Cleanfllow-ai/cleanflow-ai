/**
 * Centralized humanized display labels for backend status enums and other
 * jargon-y string values. Wave 2 copy pass (Emily / Alex / Jagan personas):
 * engineers see DQ_FIXED in DDB; users see "Cleaned ✓" in the UI.
 *
 * IMPORTANT: this maps DISPLAY labels only. API contract values
 * (status enums posted/written to DDB) MUST remain the raw values like
 * "DQ_FIXED", "VALIDATED" etc. Only the rendered text changes.
 */

/**
 * Humanized status label for any FileRegistry status string.
 * Falls back to the raw value if not in the explicit map (defensive — we'd
 * rather show a raw code than crash).
 */
export function statusToLabel(rawStatus: string | null | undefined): string {
  if (!rawStatus) return "-"
  switch (rawStatus) {
    // ── Wave 2 humanization ──
    case "VALIDATED":
      return "Ready"
    case "DQ_FIXED":
      return "Cleaned ✓"
    case "DQ_RUNNING":
      return "Cleaning..."
    case "DQ_FAILED":
      return "Failed"
    case "REJECTED":
      return "Invalid file"
    // ── Pre-existing legacy mappings (kept, but tweaked to match the
    //     new "cleaned" vocabulary so the UI is consistent) ──
    case "COMPLETED":
    case "DQ_COMPLETE":
      return "Cleaned ✓"
    case "NORMALIZING":
      return "Cleaning..."
    case "DQ_DISPATCHED":
    case "QUEUED":
      return "Queued"
    case "UPLOADED":
      return "Uploaded"
    case "UPLOADING":
      return "Uploading"
    case "IMPORTING":
      return "Importing"
    case "IMPORT_FAILED":
      return "Import failed"
    case "FAILED":
      return "Failed"
    case "UPLOAD_FAILED":
      return "Upload failed"
    case "REPROCESSING":
      return "Reprocessing"
    case "REPROCESS_FAILED":
      return "Reprocess failed"
    case "SHARDING":
      return "Initiating..."
    case "SHARDED":
      return "Ready"
    case "SHARD_FAILED":
      return "Shard failed"
    case "OPTIMIZING":
      return "Optimizing…"
    case "OPTIMIZE_FAILED":
      return "Optimize failed"
    default:
      return rawStatus
  }
}

/**
 * Humanized cardinality label for the augmentation pipeline.
 * Replaces raw "MANY_TO_ONE" / "ONE_TO_ONE" jargon with business-friendly
 * descriptions.
 */
export function cardinalityToLabel(mode: string | null | undefined): string {
  if (!mode) return "-"
  switch (mode) {
    case "MANY_TO_ONE":
      return "Group-by aggregation"
    case "MANY_TO_MANY":
      return "Pivot table"
    case "ONE_TO_ONE":
      return "Simple derivation"
    case "ONE_TO_MANY":
      return "Explode rows"
    default:
      return mode
  }
}

/**
 * Short cardinality label suitable for badges where space is tight.
 * The augmentation pipeline tab used to show "1→1" / "N→1" / etc.
 * We replace these with shorter humanized variants that still fit a Badge.
 */
export const CARDINALITY_SHORT_LABEL: Record<string, string> = {
  ONE_TO_ONE: "Simple",
  ONE_TO_MANY: "Explode",
  MANY_TO_ONE: "Group-by",
  MANY_TO_MANY: "Pivot",
}

/**
 * Humanized canonical-type label (e.g. "core:decimal" → "Money",
 * "alias:quantity_decimal" → "Quantity").
 */
export function canonicalTypeToLabel(rawType: string | null | undefined): string {
  if (!rawType) return "-"
  const t = rawType.toLowerCase()
  // Currency / money types
  if (
    t.includes("currency") ||
    t.includes("money") ||
    t === "core:decimal" ||
    t === "decimal" ||
    t.startsWith("alias:currency") ||
    t.startsWith("alias:amount")
  ) {
    return "Money"
  }
  // Quantity types
  if (
    t.includes("quantity") ||
    t === "alias:quantity_decimal" ||
    t === "alias:quantity" ||
    t.startsWith("alias:qty")
  ) {
    return "Quantity"
  }
  // Identifier types
  if (
    t === "identifier" ||
    t.includes("identifier") ||
    t.endsWith("_id") ||
    t === "core:string" ||
    t.startsWith("alias:id")
  ) {
    return "Identifier"
  }
  // Email
  if (t.includes("email")) return "Email"
  // Phone
  if (t.includes("phone")) return "Phone"
  // Date / time
  if (t.includes("date") || t.includes("time") || t.includes("timestamp"))
    return "Date / Time"
  // Boolean
  if (t.includes("bool") || t === "core:bool") return "Yes / No"
  // Enum
  if (t.includes("enum")) return "Choice"
  // Integer
  if (
    t === "core:integer" ||
    t === "integer" ||
    t === "core:int" ||
    t.includes("int")
  ) {
    return "Whole number"
  }
  // Floats / numerics
  if (t.includes("number") || t.includes("float") || t.includes("numeric")) {
    return "Number"
  }
  // Text fallback
  if (t.includes("string") || t.includes("text") || t.includes("varchar")) {
    return "Text"
  }
  // Unknown type — strip the namespace prefix (`core:`, `alias:`) for
  // readability instead of leaking it raw.
  return rawType.replace(/^(core|alias):/i, "").replace(/_/g, " ")
}
