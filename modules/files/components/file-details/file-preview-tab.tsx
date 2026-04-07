import { AlertTriangle, Loader2, Table as TableIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import type { FilePreviewData } from "@/modules/files/types"
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FilePreviewTabProps {
  previewLoading: boolean
  previewError: string | null
  previewData: FilePreviewData | null
}

// DQ metadata columns are used internally for cell coloring but should not
// appear as visible columns in the preview table.
const DQ_HIDDEN_COLUMNS = new Set([
  "dq_status", "dq_violations", "dq_cell_status", "fixes_applied",
  "dq_score", "dq_row_id",
])

export function FilePreviewTab({ previewLoading, previewError, previewData }: FilePreviewTabProps) {
  const visibleHeaders = previewData?.headers?.filter((h) =>
    !DQ_HIDDEN_COLUMNS.has(h) &&
    !h.endsWith("_dq_status") &&
    !h.endsWith("_dq_fixed") &&
    !h.endsWith("_dq_quarantined") &&
    !h.startsWith("_")
  ) ?? []

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
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
          <div className="w-16 h-16 bg-amber-100 dark:bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-yellow-500" />
          </div>
          <h3 className="text-lg font-medium mb-2">Preview Unavailable</h3>
          <p className="text-muted-foreground max-w-md">{previewError}</p>
        </div>
      )}

      {!previewLoading && !previewError && previewData && (
        <TooltipProvider delayDuration={150}>
          <div className="flex-1 overflow-auto relative bg-background mx-4 my-4 border rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-muted shadow-sm ">
                <tr>
                  {visibleHeaders.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap border-b border-r last:border-r-0 bg-muted select-none"
                    >
                      {header}
                    </th>
                  ))}
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

                      // ── Per-cell DQ status resolution ─────────────────────
                      // Backend returns cell_status map: { colName: "quarantined"|"fixed"|"clean" }
                      const cellStatusMap = (row as any)?.cell_status
                      let mapCellStatus = ""
                      if (cellStatusMap && typeof cellStatusMap === "object") {
                        mapCellStatus = String(cellStatusMap[header] || "").toLowerCase()
                      } else if (typeof cellStatusMap === "string") {
                        try {
                          const parsed = JSON.parse(cellStatusMap)
                          mapCellStatus = String(parsed?.[header] || "").toLowerCase()
                        } catch { /* not JSON */ }
                      }

                      // 3. Infer from dq_violations / fixes_applied strings
                      const violationsRaw = String((row as any)?.dq_violations || "")
                      const fixesRaw = String((row as any)?.fixes_applied || "")
                      const colLower = header.toLowerCase()

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
                        })

                      const colViolations = extractForCol(violationsRaw)
                      const colFixes = extractForCol(fixesRaw)

                      // Resolve status: cell_status map > inferred from violation/fix strings
                      const resolvedStatus =
                        (mapCellStatus && mapCellStatus !== "nan" && mapCellStatus !== "none"
                          ? mapCellStatus
                          : "") ||
                        (colViolations.length > 0 ? "quarantined" : "") ||
                        (colFixes.length > 0 ? "fixed" : "")

                      const cellClass =
                        resolvedStatus === "quarantined"
                          ? "bg-red-500/10 text-red-800 dark:text-red-400"
                          : resolvedStatus === "fixed"
                          ? "bg-amber-500/10 text-amber-800 dark:text-amber-400"
                          : resolvedStatus === "clean"
                          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
                          : ""

                      // ── Tooltip (only for non-clean cells) ─────────────────
                      const tooltipLines: string[] = []
                      if (resolvedStatus && resolvedStatus !== "clean") {
                        tooltipLines.push(`Status: ${resolvedStatus}`)
                        if (colViolations.length > 0) {
                          tooltipLines.push(`Issues: ${colViolations.join("; ")}`)
                        }
                        if (colFixes.length > 0) {
                          tooltipLines.push(`Fixes: ${colFixes.join("; ")}`)
                        }
                        if (resolvedStatus === "fixed" && colFixes.length === 0) {
                          tooltipLines.push("Auto-fixed by DQ engine")
                        }
                      }

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

                      // Only wrap in tooltip for cells that have DQ info
                      if (tooltipLines.length > 0) {
                        return (
                          <UiTooltip key={header}>
                            <TooltipTrigger asChild>
                              {cellContent}
                            </TooltipTrigger>
                            <TooltipContent align="start" className="max-w-xs break-words text-xs">
                              <div className="space-y-1">
                                {tooltipLines.map((line, i) => (
                                  <div key={i}>{line}</div>
                                ))}
                              </div>
                            </TooltipContent>
                          </UiTooltip>
                        )
                      }

                      return <td key={header} className="px-4 py-2.5 whitespace-nowrap border-r last:border-r-0 max-w-[260px] truncate">{value !== undefined ? String(value ?? "") : ""}</td>
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

      {!previewLoading && !previewError && !previewData && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <TableIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">No preview data available</p>
        </div>
      )}
    </div>
  )
}

