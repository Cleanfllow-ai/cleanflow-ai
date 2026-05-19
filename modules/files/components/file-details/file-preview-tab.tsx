import { AlertTriangle, Calculator, FileX, Loader2, RefreshCw, Table as TableIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import type { FilePreviewData } from "@/modules/files/types"
import type { PreviewErrorKind } from "@/modules/files/hooks/use-file-details"
import { Button } from "@/components/ui/button"
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FilePreviewTabProps {
  previewLoading: boolean
  previewError: string | null
  previewErrorKind?: PreviewErrorKind | null
  previewData: FilePreviewData | null
  /** Columns that were synthesised by formula rules (#11). Names in
   *  this set get a calculator icon next to the header so the operator
   *  can tell at a glance which columns are derived. Empty when no
   *  formulas ran. Read from dq_matrix.json's `synthesised_columns`. */
  synthesisedColumns?: string[]
  /** Called when the user clicks Retry after a recoverable error. */
  onRetry?: () => void
  /** Called when the user wants to open the quarantine editor instead. */
  onOpenEditor?: () => void
  /** Called when the user wants to refresh the file list (e.g. after deletion). */
  onRefreshList?: () => void
}

// DQ metadata columns are used internally for cell coloring but should not
// appear as visible columns in the preview table.
const DQ_HIDDEN_COLUMNS = new Set([
  "dq_status", "dq_violations", "dq_cell_status", "fixes_applied",
  "dq_score", "dq_row_id", "row_id", "__row_idx", "__index_level_0__",
])

const STATUS_VALUES = new Set(["clean", "fixed", "quarantined", "edited"])

/**
 * Resolve a single cell's DQ status from any of:
 *   1. row.cell_status[column]                (preferred — built by backend)
 *   2. row[`${column}_dq_status`]             (raw parquet sidecar)
 *   3. row[`${column}_dq_quarantined`]        (rule-list — implies "quarantined")
 *   4. row[`${column}_dq_fixed`]              (rule-list — implies "fixed")
 *   5. inferred from row.dq_violations / row.fixes_applied text
 *
 * Any non-empty value that ISN'T explicitly "clean"/"fixed" is treated as
 * "quarantined" (defensive fallback so unknown sidecar payloads still render
 * red instead of silently disappearing).
 */
function resolveCellStatus(row: any, header: string): "clean" | "fixed" | "quarantined" | "" {
  if (!row || typeof row !== "object") return ""

  // 1. cell_status map
  const csMap = row.cell_status
  let raw = ""
  if (csMap && typeof csMap === "object") {
    raw = String(csMap[header] ?? "")
  } else if (typeof csMap === "string") {
    try {
      const parsed = JSON.parse(csMap)
      raw = String(parsed?.[header] ?? "")
    } catch { /* not JSON */ }
  }

  // 2. {col}_dq_status sidecar
  if (!raw) raw = String(row[`${header}_dq_status`] ?? "")

  raw = raw.trim().toLowerCase()
  if (raw && raw !== "nan" && raw !== "none" && raw !== "null") {
    if (STATUS_VALUES.has(raw)) return raw as any
    // Unknown but non-empty — assume it's a rule list / violation marker
    return "quarantined"
  }

  // 3 & 4. {col}_dq_quarantined / {col}_dq_fixed payloads (lists of rule names)
  const qPayload = String(row[`${header}_dq_quarantined`] ?? "").trim()
  if (qPayload && qPayload.toLowerCase() !== "nan" && qPayload.toLowerCase() !== "none") {
    return "quarantined"
  }
  const fPayload = String(row[`${header}_dq_fixed`] ?? "").trim()
  if (fPayload && fPayload.toLowerCase() !== "nan" && fPayload.toLowerCase() !== "none") {
    return "fixed"
  }

  // 5. infer from row-level dq_violations / fixes_applied strings
  const colLower = header.toLowerCase()
  const matches = (raw: string) => {
    return raw.split(";").some((tok) => {
      const lower = tok.trim().toLowerCase()
      return (
        lower.startsWith(`${colLower}:`) ||
        lower.startsWith(`${colLower} :`) ||
        lower.startsWith(`${colLower}=`) ||
        lower.includes(`(${colLower})`) ||
        lower.includes(` ${colLower}:`)
      )
    })
  }
  const vRaw = String(row.dq_violations ?? "")
  const fRaw = String(row.fixes_applied ?? "")
  if (vRaw && matches(vRaw)) return "quarantined"
  if (fRaw && matches(fRaw)) return "fixed"

  return ""
}

/** Build the tooltip lines for a DQ-flagged cell. */
function buildTooltipLines(
  row: any,
  header: string,
  status: "fixed" | "quarantined",
): string[] {
  const colLower = header.toLowerCase()
  const stripColPrefix = (token: string) => {
    let cleaned = token.trim()
    const colonIdx = cleaned.indexOf(":")
    if (colonIdx > 0 && cleaned.substring(0, colonIdx).trim().toLowerCase() === colLower) {
      cleaned = cleaned.substring(colonIdx + 1).trim()
    }
    return cleaned
  }
  const stripColRef = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim()
  const extractForCol = (raw: string) =>
    raw.split(";").map((t) => t.trim()).filter((t) => {
      if (!t) return false
      const lower = t.toLowerCase()
      return (
        lower.includes(`(${colLower})`) ||
        lower.startsWith(`${colLower}:`) ||
        lower.startsWith(`${colLower} :`) ||
        lower.startsWith(`${colLower}=`) ||
        lower.includes(` ${colLower}:`) ||
        lower.includes(` ${colLower} `)
      )
    }).map(stripColPrefix).map(stripColRef).filter(Boolean)

  const lines: string[] = []
  const vRaw = String(row?.dq_violations ?? "")
  const fRaw = String(row?.fixes_applied ?? "")
  const colViolations = extractForCol(vRaw)
  const colFixes = extractForCol(fRaw)

  if (colViolations.length > 0) lines.push(...colViolations)

  if (status === "fixed") {
    if (colFixes.length > 0) {
      lines.push(...colFixes)
    } else if (colViolations.length === 0) {
      lines.push("Auto-fixed by DQ engine")
    }
  }

  // Sidecar payload fallback ({col}_dq_quarantined / _dq_fixed contain rule lists)
  if (lines.length === 0) {
    const sidecar = status === "quarantined"
      ? String(row?.[`${header}_dq_quarantined`] ?? "")
      : String(row?.[`${header}_dq_fixed`] ?? "")
    const parts = sidecar.split(";").map((t) => stripColRef(t.trim())).filter(Boolean)
    if (parts.length > 0) lines.push(...parts)
  }

  // Final fallback: raw row-level violation string or generic label
  if (lines.length === 0) {
    const rawTrim = vRaw.trim()
    if (rawTrim) {
      lines.push(rawTrim)
    } else {
      lines.push(status === "fixed" ? "Auto-fixed" : "Quarantined")
    }
  }
  return lines
}

function isHiddenHeader(h: string): boolean {
  if (DQ_HIDDEN_COLUMNS.has(h)) return true
  if (h.startsWith("_")) return true
  if (h.endsWith("_dq_status")) return true
  if (h.endsWith("_dq_fixed")) return true
  if (h.endsWith("_dq_quarantined")) return true
  return false
}

export function FilePreviewTab({
  previewLoading,
  previewError,
  previewErrorKind,
  previewData,
  synthesisedColumns,
  onRetry,
  onOpenEditor,
  onRefreshList,
}: FilePreviewTabProps) {
  const visibleHeaders = previewData?.headers?.filter((h) => !isHiddenHeader(h)) ?? []
  const synthesisedSet = new Set(synthesisedColumns ?? [])
  // Failure mode 6: header-only file
  const isHeaderOnly = !previewLoading && !previewError && previewData !== null &&
    previewData.total_rows === 0 && previewData.headers.length > 0

  return (
    <div className="h-full flex flex-col">
      {previewLoading && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading preview data...</p>
          </div>
        </div>
      )}

      {previewError && (
        <PreviewErrorState
          kind={previewErrorKind ?? "generic"}
          message={previewError}
          onRetry={onRetry}
          onOpenEditor={onOpenEditor}
          onRefreshList={onRefreshList}
        />
      )}

      {isHeaderOnly && (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8" data-testid="preview-header-only">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <TableIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-medium mb-2">Headers Only</h3>
          <p className="text-muted-foreground max-w-md">This file has only headers — no data rows were found.</p>
        </div>
      )}

      {!previewLoading && !previewError && previewData && !isHeaderOnly && (
        <TooltipProvider delayDuration={150}>
          {/* ── DQ status legend ──────────────────────────────────────── */}
          <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-4 border-b text-[11px] text-muted-foreground shrink-0">
            <span className="font-medium uppercase tracking-wider text-[10px]">DQ Cell Status</span>
            <LegendDot variant="clean" label="Clean" />
            <LegendDot variant="fixed" label="Fixed (auto-corrected)" />
            <LegendDot variant="quarantined" label="Quarantined (needs review)" />
            <span className="ml-auto text-[10px] italic text-muted-foreground/70">
              Hover a coloured cell for the rule that flagged it. This view is read-only — open the Quarantine Editor to make corrections.
            </span>
          </div>

          <div className="flex-1 overflow-auto relative bg-background mx-4 my-3 border rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-muted shadow-sm">
                <tr>
                  {visibleHeaders.map((header) => {
                    const isSynthesised = synthesisedSet.has(header)
                    return (
                      <th
                        key={header}
                        className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap border-b border-r last:border-r-0 bg-muted select-none"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {isSynthesised && (
                            <UiTooltip>
                              <TooltipTrigger asChild>
                                <Calculator className="h-3 w-3 shrink-0 text-violet-600" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Derived column — value computed by a formula rule
                              </TooltipContent>
                            </UiTooltip>
                          )}
                          <span>{header}</span>
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {previewData.sample_data?.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b transition-colors hover:bg-muted/30"
                  >
                    {visibleHeaders.map((header) => {
                      const value = row && typeof row === "object" ? row[header] : ""
                      const status = resolveCellStatus(row, header)

                      const cellClass =
                        status === "quarantined"
                          ? "bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-300 shadow-[inset_2px_0_0_#ef4444]"
                          : status === "fixed"
                          ? "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300 shadow-[inset_2px_0_0_#f97316]"
                          : ""

                      const cellContent = (
                        <td
                          className={cn(
                            "px-4 py-2.5 whitespace-nowrap border-r last:border-r-0 max-w-[260px] truncate",
                            cellClass
                          )}
                        >
                          {value !== undefined ? String(value ?? "") : ""}
                        </td>
                      )

                      if (status === "quarantined" || status === "fixed") {
                        const lines = buildTooltipLines(row, header, status)
                        return (
                          <UiTooltip key={header}>
                            <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                            <TooltipContent align="start" className="max-w-xs break-words text-xs">
                              <div className="space-y-1">
                                <div className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
                                  {status === "quarantined" ? "Quarantined" : "Auto-fixed"}
                                </div>
                                {lines.map((line, i) => (
                                  <div key={i}>{line}</div>
                                ))}
                              </div>
                            </TooltipContent>
                          </UiTooltip>
                        )
                      }

                      return (
                        <td
                          key={header}
                          className="px-4 py-2.5 whitespace-nowrap border-r last:border-r-0 max-w-[260px] truncate"
                        >
                          {value !== undefined ? String(value ?? "") : ""}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t bg-muted/10 shrink-0">
            <div className="text-sm text-muted-foreground text-center">
              Showing 1-{Math.min(50, previewData.total_rows)} of {previewData.total_rows} total records
            </div>
          </div>
        </TooltipProvider>
      )}

      {!previewLoading && !previewError && !previewData && !isHeaderOnly && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <TableIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">No preview data available</p>
        </div>
      )}
    </div>
  )
}

// ── Error state component ────────────────────────────────────────────────────

interface PreviewErrorStateProps {
  kind: PreviewErrorKind
  message: string
  onRetry?: () => void
  onOpenEditor?: () => void
  onRefreshList?: () => void
}

function PreviewErrorState({ kind, message, onRetry, onOpenEditor, onRefreshList }: PreviewErrorStateProps) {
  let title = "Preview Unavailable"
  let icon = <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-yellow-500" />
  let iconBg = "bg-amber-100 dark:bg-yellow-500/10"
  let cta: React.ReactNode = null

  switch (kind) {
    case "uploading":
      title = "File Still Processing"
      cta = onRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
          data-testid="preview-retry-btn"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      ) : null
      break

    case "rejected":
      title = "File Rejected"
      icon = <FileX className="h-8 w-8 text-red-600 dark:text-red-400" />
      iconBg = "bg-red-100 dark:bg-red-500/10"
      break

    case "timeout":
      title = "Preview Timed Out"
      cta = (
        <div className="flex gap-2 mt-4 flex-wrap justify-center">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} data-testid="preview-retry-btn">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          )}
          {onOpenEditor && (
            <Button variant="default" size="sm" onClick={onOpenEditor} data-testid="preview-open-editor-btn">
              Open Quarantine Editor
            </Button>
          )}
        </div>
      )
      break

    case "server_error":
      title = "Preview Failed"
      cta = onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry} data-testid="preview-retry-btn">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      ) : null
      break

    case "not_found":
      title = "File Not Found"
      icon = <FileX className="h-8 w-8 text-muted-foreground" />
      iconBg = "bg-muted"
      cta = onRefreshList ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRefreshList} data-testid="preview-refresh-list-btn">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh List
        </Button>
      ) : null
      break
  }

  return (
    <div
      className="flex flex-col items-center justify-center flex-1 text-center p-8"
      data-testid={`preview-error-${kind}`}
    >
      <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-4", iconBg)}>
        {icon}
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md">{message}</p>
      {cta}
    </div>
  )
}

function LegendDot({
  variant,
  label,
}: {
  variant: "clean" | "fixed" | "quarantined"
  label: string
}) {
  const dotClass =
    variant === "clean"
      ? "bg-transparent border border-border"
      : variant === "fixed"
      ? "bg-amber-500"
      : "bg-red-500"
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block w-2.5 h-2.5 rounded-full", dotClass)} />
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  )
}
