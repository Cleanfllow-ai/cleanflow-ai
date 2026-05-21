/**
 * Customer-friendly display label for FileRegistry status enums.
 *
 * Used by the status pill in the file explorer table and any other surface
 * that renders a bare backend status enum.
 *
 * NOTE: this only affects the rendered DISPLAY text. The raw enum values
 * (DQ_FIXED, VALIDATED, etc.) remain the API contract and continue to be
 * written to/read from DynamoDB unchanged.
 *
 * The mapping intentionally diverges from `statusToLabel()` in
 * `status-labels.ts` for the in-flight verb tense ("Processing…" instead of
 * "Cleaning..."), per the brand-consistency pass dated 2026-05-21.
 */
export function getFriendlyStatusLabel(status: string | null | undefined): string {
  if (!status) return "-"
  switch (status) {
    case "DQ_FIXED":
      return "Cleaned ✓"
    case "VALIDATED":
      return "Ready"
    case "DQ_DISPATCHED":
      return "Queued"
    case "DQ_RUNNING":
      return "Processing…"
    case "DQ_FAILED":
      return "Failed"
    case "REJECTED":
      return "Rejected"
    case "UPLOADED":
      return "Uploaded"
    default:
      return titleCase(status)
  }
}

function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
