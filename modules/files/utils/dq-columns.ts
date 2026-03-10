// ─── DQ Column Detection & Filtering ────────────────────────────────────────
// Shared utility for filtering out internal Data Quality columns from file columns
// before showing them in ERP export column selection / mapping dialogs.

const DQ_SUFFIXES = [
    '_dq_status', '_dq_fixed', '_dq_quarantined', '_dq_clean', '_dq_violations',
]

const DQ_STANDALONE = new Set([
    'dq_status', 'dq_violations', 'dq_cell_status', 'dq_summary', 'dq_score',
    'fixes_applied', 'violations_count',
])

/**
 * Returns true if a column is an internal DQ (data-quality) column that should
 * not be exported to external ERPs.
 */
export function isDQColumn(col: string, allColumns: string[]): boolean {
    const lower = col.toLowerCase()

    // Standalone DQ columns
    if (DQ_STANDALONE.has(lower)) return true

    // Columns that start with dq_ or __dq
    if (lower.startsWith('dq_') || lower.startsWith('__dq')) return true

    // Suffix-based: only if the base column also exists
    for (const suffix of DQ_SUFFIXES) {
        if (lower.endsWith(suffix)) {
            const base = col.slice(0, col.length - suffix.length)
            if (base && allColumns.some(c => c.toLowerCase() === base.toLowerCase())) {
                return true
            }
        }
    }

    return false
}

/**
 * Filters out all DQ columns from a list of file columns.
 */
export function filterDQColumns(columns: string[]): string[] {
    return columns.filter(col => !isDQColumn(col, columns))
}
