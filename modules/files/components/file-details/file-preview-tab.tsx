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
  const visibleHeaders = previewData?.headers?.filter((h) => !DQ_HIDDEN_COLUMNS.has(h)) ?? []

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
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
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
                    title={row?.dq_violations || row?.dq_status || ""}
                  >
                    {visibleHeaders.map((header) => {
                      const value = row && typeof row === "object" ? row[header] : ""
                      const status = String(row?.dq_status || "").toLowerCase()
                      const cellStatus = row?.cell_status ? row.cell_status[header] : undefined
                      const resolvedStatus = (cellStatus || "clean") as string
                      const isStatusCell = header === "dq_status"
                      const isViolationCell = header === "dq_violations"
                      const cellClass = isStatusCell
                        ? status === "clean"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : status === "fixed"
                            ? "bg-amber-500/10 text-amber-700"
                            : status === "quarantined"
                              ? "bg-red-500/10 text-red-700"
                              : ""
                        : isViolationCell
                          ? status === "quarantined"
                            ? "bg-red-500/10 text-red-800"
                            : status === "fixed"
                              ? "bg-amber-500/10 text-amber-800"
                              : ""
                          : resolvedStatus === "quarantined"
                            ? "bg-red-500/10 text-red-800"
                            : resolvedStatus === "fixed"
                              ? "bg-amber-500/10 text-amber-800"
                              : resolvedStatus === "clean"
                                ? "bg-emerald-500/5 text-emerald-800"
                                : ""

                      const tooltipLines: string[] = []
                      if (resolvedStatus) {
                        tooltipLines.push(`Status: ${resolvedStatus}`)
                      }

                      const violationsRaw = (row as any)?.dq_violations as string | undefined
                      if (violationsRaw) {
                        const tokens = violationsRaw.split(";").map((v) => v.trim()).filter(Boolean)
                        const perCell = tokens.filter((t) => t.toLowerCase().includes(header.toLowerCase()))
                        const toShow = perCell.length > 0 ? perCell : tokens
                        if (toShow.length > 0) {
                          tooltipLines.push(`Issues: ${toShow.join(", ")}`)
                        }
                      }

                      const fixesRaw = (row as any)?.fixes_applied as string | undefined
                      if (fixesRaw) {
                        const tokens = fixesRaw.split(";").map((v) => v.trim()).filter(Boolean)
                        const perCell = tokens.filter((t) => t.toLowerCase().includes(header.toLowerCase()))
                        const toShow = perCell.length > 0 ? perCell : tokens
                        if (toShow.length > 0) {
                          tooltipLines.push(`Fixes: ${toShow.join(", ")}`)
                        }
                      }

                      if (tooltipLines.length === 0) {
                        tooltipLines.push("Status: clean")
                      }

                      return (
                        <UiTooltip key={header}>
                          <TooltipTrigger asChild>
                            <td
                              className={cn(
                                "px-4 py-2.5 whitespace-nowrap border-r last:border-r-0 max-w-[260px] truncate",
                                cellClass
                              )}
                            >
                              {value !== undefined ? String(value ?? "") : ""}
                            </td>
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
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t bg-muted/10 shrink-0">
            <div className="text-sm text-muted-foreground text-center">
              Showing 1-{Math.min(20, previewData.total_rows)} of {previewData.total_rows} total records
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

