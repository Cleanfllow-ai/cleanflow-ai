"use client"

/**
 * schema-export-form.tsx
 *
 * Reverse of SchemaDropForm — auto-detects entities from the current file's
 * columns (DQ columns excluded), resolves each column to entity.cdf_field,
 * and exports cross-entity to the selected ERP.
 */

import { useState, useEffect, useMemo } from "react"
import {
    Loader2,
    CloudUpload,
    CheckCircle2,
    AlertCircle,
    Eye,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { filterDQColumns } from "@/modules/files/utils/dq-columns"
import { useMultiEntityExport } from "@/modules/files/hooks/use-multi-entity-export"

interface SchemaExportFormProps {
    provider: string
    file: any               // FileStatusResponse
    columns: string[]       // raw file columns (may include DQ columns)
    token: string
    onNotification?: (message: string, type: "success" | "error") => void
}

// ─── Entity progress row ────────────────────────────────────────────────────

function EntityProgressRow({
    entity,
    status,
    success,
    failed,
}: {
    entity: string
    status: "pending" | "running" | "done" | "failed"
    success: number
    failed: number
}) {
    const label = entity.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    return (
        <div className="flex items-center gap-2 text-sm">
            {status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
            {status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />}
            {status === "failed" && <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
            {status === "pending" && <span className="h-4 w-4 shrink-0" />}
            <span
                className={
                    status === "failed"
                        ? "text-red-700"
                        : status === "done"
                          ? "text-green-700"
                          : "text-muted-foreground"
                }
            >
                {label}
            </span>
            {status === "done" && (
                <span className="text-xs text-muted-foreground ml-auto">({success} exported)</span>
            )}
            {status === "running" && (
                <span className="text-xs text-muted-foreground ml-auto">exporting…</span>
            )}
            {status === "failed" && (
                <span className="text-xs text-red-600 ml-auto">({failed} failed)</span>
            )}
            {status === "pending" && (
                <span className="text-xs text-muted-foreground ml-auto">waiting</span>
            )}
        </div>
    )
}

// ─── View Mapping drawer ────────────────────────────────────────────────────

function ViewMappingDrawer({
    open,
    onOpenChange,
    resolutions,
    unmappedColumns,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    resolutions: Array<{ column: string; entity: string; cdf_field: string }>
    unmappedColumns: string[]
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Column Mapping</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-1">
                    {resolutions.map((r) => (
                        <div
                            key={r.column}
                            className="grid grid-cols-2 gap-2 text-sm py-1 border-b last:border-0"
                        >
                            <span className="text-muted-foreground truncate">{r.column}</span>
                            <span className="font-medium truncate">
                                {r.entity}.{r.cdf_field}
                            </span>
                        </div>
                    ))}
                    {unmappedColumns.map((col) => (
                        <div
                            key={col}
                            className="grid grid-cols-2 gap-2 text-sm py-1 border-b last:border-0"
                        >
                            <span className="text-amber-600 truncate">{col}</span>
                            <span className="text-muted-foreground italic text-xs">unmapped</span>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function SchemaExportForm({
    provider,
    file,
    columns,
    token,
    onNotification,
}: SchemaExportFormProps) {
    const [mappingOpen, setMappingOpen] = useState(false)

    // Filter out DQ columns — only real file columns should be exported
    const fileColumns = useMemo(() => filterDQColumns(columns), [columns])

    const uploadId = file?.upload_id ?? null
    const filename = file?.original_filename || file?.filename || "file"
    const cleanRows = file?.rows_clean ?? file?.rows_out ?? 0

    const multiExport = useMultiEntityExport({
        uploadId,
        columns: fileColumns,
        provider,
    })

    // Auto-detect entities when we have columns
    useEffect(() => {
        if (fileColumns.length > 0 && multiExport.exportState === "idle") {
            multiExport.detectEntities()
        }
    }, [fileColumns.length, provider]) // eslint-disable-line react-hooks/exhaustive-deps

    // Reset when provider changes
    useEffect(() => {
        multiExport.reset()
    }, [provider]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleExport = () => {
        multiExport.startExport()
    }

    const providerLabel =
        provider === "quickbooks"
            ? "QuickBooks Online"
            : provider === "zohobooks" || provider === "zoho-books"
              ? "Zoho Books"
              : provider.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

    const isExporting = multiExport.exportState === "exporting"
    const isDone = multiExport.exportState === "done"

    if (!fileColumns.length) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                    No columns available for this file. Select a file that has been processed.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <>
            <div className="space-y-4">
                {/* File info */}
                <div className="rounded-lg border p-3 bg-muted/50">
                    <p className="text-sm font-medium truncate">{filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {cleanRows.toLocaleString()} clean rows &middot; {fileColumns.length} columns (DQ columns excluded)
                    </p>
                </div>

                {/* Detecting */}
                {multiExport.exportState === "detecting" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Detecting entities from file columns…
                    </div>
                )}

                {/* Detected — summary card */}
                {(multiExport.exportState === "detected" ||
                    multiExport.exportState === "exporting" ||
                    multiExport.exportState === "done" ||
                    multiExport.exportState === "error") &&
                    multiExport.entities.length > 0 && (
                        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                            <p className="text-sm font-medium text-muted-foreground">
                                {multiExport.entities
                                    .map((e) =>
                                        e
                                            .replace(/_/g, " ")
                                            .replace(/\b\w/g, (l) => l.toUpperCase())
                                    )
                                    .join(" → ")}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <Badge
                                    variant="secondary"
                                    className="gap-1 text-green-700 bg-green-50"
                                >
                                    <CheckCircle2 className="h-3 w-3" />
                                    {multiExport.mappedCount} mapped
                                </Badge>
                                {multiExport.unmappedColumns.length > 0 && (
                                    <Badge
                                        variant="secondary"
                                        className="gap-1 text-amber-700 bg-amber-50"
                                    >
                                        <AlertCircle className="h-3 w-3" />
                                        {multiExport.unmappedColumns.length} unmapped
                                    </Badge>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-6 px-2 ml-auto"
                                    onClick={() => setMappingOpen(true)}
                                >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View Mapping
                                </Button>
                            </div>
                        </div>
                    )}

                {/* Export progress */}
                {(multiExport.exportState === "exporting" ||
                    multiExport.exportState === "done" ||
                    multiExport.exportState === "error") && (
                    <div className="space-y-1 rounded-lg border p-3 bg-muted/20">
                        {multiExport.entityProgress.map((ep) => (
                            <EntityProgressRow key={ep.entity} {...ep} />
                        ))}
                    </div>
                )}

                {/* Error */}
                {multiExport.exportState === "error" && multiExport.error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{multiExport.error}</AlertDescription>
                    </Alert>
                )}

                {/* Done */}
                {isDone && (
                    <Alert className="border-green-200 bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-900">
                            Export complete —{" "}
                            {multiExport.finalResults.reduce(
                                (sum, r) => sum + r.success_count,
                                0
                            )}{" "}
                            records exported to {providerLabel}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Action button */}
                {!isDone && (
                    <Button
                        onClick={handleExport}
                        disabled={
                            isExporting ||
                            multiExport.exportState === "detecting" ||
                            multiExport.exportState === "idle" ||
                            !multiExport.resolutions.length
                        }
                        className="gap-2 w-full"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Exporting…
                            </>
                        ) : (
                            <>
                                <CloudUpload className="h-4 w-4" />
                                Export to {providerLabel}
                            </>
                        )}
                    </Button>
                )}

                {/* Reset */}
                {(isDone || multiExport.exportState === "error") && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => multiExport.reset()}
                        className="w-full"
                    >
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Reset
                    </Button>
                )}
            </div>

            <ViewMappingDrawer
                open={mappingOpen}
                onOpenChange={setMappingOpen}
                resolutions={multiExport.resolutions}
                unmappedColumns={multiExport.unmappedColumns}
            />
        </>
    )
}
