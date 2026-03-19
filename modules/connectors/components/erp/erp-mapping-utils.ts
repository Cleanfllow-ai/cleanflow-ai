// ─── Generic ERP field mapping helpers ────────────────────────────────────────
// No hardcoded schemas — field definitions come from the backend via
// erpConnectorsAPI.getEntityFields(provider, entity).

export interface MappingField {
  key: string
  label: string
  required: boolean
  help: string
}

/** Normalize a string for fuzzy matching (lowercase, strip spaces/underscores/hyphens). */
export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, "")
}

/**
 * Local column auto-mapping: match file columns to entity fields by
 * normalized key, normalized label, and common synonyms.
 * Used as a fast first-pass before calling AI auto-map on the backend.
 */
export function autoMapColumns(
  columns: string[],
  fields: MappingField[],
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const normalized = new Map(columns.map((c) => [normalizeKey(c), c]))

  for (const field of fields) {
    if (mapping[field.key]) continue

    // 1. Exact normalized key match
    const keyMatch = normalized.get(normalizeKey(field.key))
    if (keyMatch) { mapping[field.key] = keyMatch; continue }

    // 2. Exact normalized label match
    const labelMatch = normalized.get(normalizeKey(field.label))
    if (labelMatch) { mapping[field.key] = labelMatch; continue }

    // 3. Substring containment (field key contained in column or vice versa)
    const fieldNorm = normalizeKey(field.key)
    for (const [colNorm, colOriginal] of normalized) {
      if (!Object.values(mapping).includes(colOriginal)) {
        if (colNorm.includes(fieldNorm) || fieldNorm.includes(colNorm)) {
          mapping[field.key] = colOriginal
          break
        }
      }
    }
  }

  return mapping
}

/** Validate that all required fields have a mapped column. */
export function validateMapping(
  mapping: Record<string, string>,
  columns: string[],
  fields: MappingField[],
): { valid: boolean; message: string } {
  const available = new Set(columns)

  for (const field of fields) {
    if (field.required) {
      const source = mapping[field.key]
      if (!source || !available.has(source)) {
        return { valid: false, message: `Missing required mapping for ${field.label}.` }
      }
    }
  }

  return { valid: true, message: "" }
}
