/**
 * formatFileDisplayName — turns raw uploaded-file names into friendlier
 * labels for the Data Catalog. Connector imports land with machine-style
 * filenames like `salesforce_accounts_20260520_142351.csv`; the unstructured
 * importer mints UUID-suffixed names like `unstructured-eecb0039-29d0-4655-
 * a101-d4daeb7840b5`. Both render poorly in tables next to user-uploaded
 * files like "Q1_2026_Customers.csv".
 *
 * Behaviour:
 *   - Salesforce / QuickBooks / Zoho Books connector pattern
 *     `<provider>_<entity>_<YYYYMMDD>_<HHMMSS>.csv` ->
 *     "Salesforce · <Entity> · MMM DD"
 *   - Unstructured importer `unstructured-<UUID>` ->
 *     "Unstructured Import · <relative time>" (uses meta.importedAt)
 *   - Everything else (regular user uploads) returns the original name
 *     unchanged so we never mangle a real customer filename.
 *
 * The result is for DISPLAY ONLY — `original_filename` / `filename` on the
 * row remain the source of truth for downloads, search-match, and API
 * round-trips.
 */

type DisplayMeta = {
  source?: string
  importedAt?: string
}

const PROVIDER_LABEL: Record<string, string> = {
  salesforce: "Salesforce",
  quickbooks: "QuickBooks",
  zohobooks: "Zoho Books",
  zoho: "Zoho Books",
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const titleCaseToken = (s: string): string =>
  s.length === 0 ? "" : s[0].toUpperCase() + s.slice(1).toLowerCase()

const titleCaseEntity = (raw: string): string =>
  raw
    .split(/[_-]+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ")

/** Format an `YYYYMMDD` token as `MMM DD`. Returns null on bad input. */
const formatYyyymmdd = (token: string): string | null => {
  if (!/^\d{8}$/.test(token)) return null
  const year = Number(token.slice(0, 4))
  const month = Number(token.slice(4, 6))
  const day = Number(token.slice(6, 8))
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  if (year < 2000 || year > 2999) return null
  return `${MONTHS_SHORT[month - 1]} ${String(day).padStart(2, "0")}`
}

/**
 * Render `importedAt` (ISO 8601) as a coarse relative time:
 * "just now" / "5m ago" / "3h ago" / "2d ago" / "Jan 12".
 * Falls back to empty string on bad input so we don't show
 * "Unstructured Import · NaNm ago".
 */
const formatRelativeTime = (iso?: string): string => {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const deltaMs = Date.now() - t
  if (deltaMs < 0) return "just now"
  const sec = Math.floor(deltaMs / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const d = new Date(t)
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Match connector-import pattern:
 *   <provider>_<entity>_<YYYYMMDD>_<HHMMSS>.csv
 * where <entity> may contain underscores (we greedily eat tokens until
 * the trailing `_YYYYMMDD_HHMMSS.csv` shape).
 */
const CONNECTOR_RE = /^([a-z]+)_(.+)_(\d{8})_(\d{6})\.csv$/i

/** Match `unstructured-<anything>` — the importer always prefixes. */
const UNSTRUCTURED_RE = /^unstructured-/i

export function formatFileDisplayName(
  name: string,
  meta?: DisplayMeta,
): string {
  if (!name) return name

  // Unstructured importer pattern — UUIDs are noise, surface the import time.
  if (UNSTRUCTURED_RE.test(name)) {
    const rel = formatRelativeTime(meta?.importedAt)
    return rel ? `Unstructured Import · ${rel}` : "Unstructured Import"
  }

  // Connector pattern.
  const m = name.match(CONNECTOR_RE)
  if (m) {
    const providerKey = m[1].toLowerCase()
    const providerLabel = PROVIDER_LABEL[providerKey]
    if (providerLabel) {
      const entityLabel = titleCaseEntity(m[2])
      const datePart = formatYyyymmdd(m[3]) ?? ""
      const parts = [providerLabel, entityLabel]
      if (datePart) parts.push(datePart)
      return parts.join(" · ")
    }
  }

  // Default — preserve customer-uploaded filenames untouched.
  return name
}
