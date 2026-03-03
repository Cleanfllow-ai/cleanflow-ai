"use client"

import {
    Loader2,
    Snowflake,
    Link2,
    Unlink,
    Download,
    Upload,
    CheckCircle2,
    AlertCircle,
    Table,
    Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useSnowflakeImport } from "./use-snowflake-import"

interface SnowflakeImportProps {
    mode?: "source" | "destination"
    uploadId?: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: "success" | "error") => void
}

export default function SnowflakeImport({
    mode = "source",
    uploadId,
    onImportComplete,
    onNotification,
}: SnowflakeImportProps) {
    const s = useSnowflakeImport({
        mode,
        uploadId,
        onImportComplete,
        onNotification,
    })

    // ─── Loading state ────────────────────────────────────────────────────
    if (s.isCheckingStatus) {
        return (
            <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] py-8 sm:py-12 lg:py-16">
                <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4 sm:space-y-6 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-4 sm:p-6 lg:p-8">

            {/* Success Alert */}
            {s.importResult && mode === "source" && (
                <Alert className="border-green-200 bg-green-50 py-2 sm:py-3">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <AlertDescription className="text-sm sm:text-base text-green-900">
                        Imported {s.importResult.records_imported || 0} records • {s.importResult.filename}
                    </AlertDescription>
                </Alert>
            )}

            {/* Export Success Alert */}
            {s.exportResult && mode === "destination" && (
                <Alert className="border-green-200 bg-green-50 py-2 sm:py-3">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <AlertDescription className="text-sm sm:text-base text-green-900">
                        {s.exportResult.message || "Successfully exported to Snowflake"}
                    </AlertDescription>
                </Alert>
            )}

            {/* Not Connected State */}
            {!s.connectionStatus.connected ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16 text-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 sm:mb-5 lg:mb-6">
                        <Snowflake className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-blue-600" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-medium mb-2">Snowflake</h3>
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-4 sm:mb-5 lg:mb-6 max-w-md px-4">
                        Connect your Snowflake account to {mode === "source" ? "import" : "export"} data directly
                    </p>
                    <Button
                        onClick={s.connectOAuth}
                        disabled={s.isConnecting}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 px-6 sm:px-8 py-4 sm:py-6 text-sm sm:text-base"
                    >
                        {s.isConnecting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Link2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                                Connect Snowflake
                            </>
                        )}
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 sm:space-y-6">
                    {/* Connected Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                            <span className="text-sm sm:text-base font-medium text-blue-900">Connected</span>
                            {s.connectionStatus.account_identifier && (
                                <span className="text-xs sm:text-sm text-blue-700 truncate max-w-[120px] sm:max-w-none">
                                    ({s.connectionStatus.account_identifier})
                                </span>
                            )}
                            {s.connectionStatus.sf_provisioned && s.connectionStatus.sf_user_schema && (
                                <Badge variant="secondary" className="text-xs">
                                    {s.connectionStatus.sf_user_database}.{s.connectionStatus.sf_user_schema}
                                </Badge>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={s.disconnect}
                            className="h-7 sm:h-8 text-xs sm:text-sm text-red-600 hover:text-red-700 hover:bg-red-50 self-end sm:self-auto"
                        >
                            <Unlink className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                            Disconnect
                        </Button>
                    </div>

                    {/* Import Form - Source Mode */}
                    {mode === "source" && (
                        <div className="grid gap-3 sm:gap-4">
                            {s.metadataLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                                    <span className="text-sm text-muted-foreground">Loading Snowflake metadata...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Table + Limit */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                            <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">
                                                <Table className="inline h-3.5 w-3.5 mr-1 relative -top-px" />
                                                Table
                                            </Label>
                                            <Select
                                                value={s.selectedTable}
                                                onValueChange={s.setSelectedTable}
                                                disabled={!s.selectedSchema}
                                            >
                                                <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                                                    <SelectValue placeholder={s.selectedSchema ? "Select table" : "Select schema first"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {s.tables.map((tbl) => (
                                                        <SelectItem key={tbl.name} value={tbl.name}>
                                                            {tbl.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">Max Records</Label>
                                            <Input
                                                type="number"
                                                value={s.importLimit}
                                                onChange={(e) =>
                                                    s.setImportLimit(parseInt(e.target.value) || 10000)
                                                }
                                                min={1}
                                                max={100000}
                                                className="h-9 sm:h-10 text-sm sm:text-base"
                                            />
                                        </div>
                                    </div>

                                    {/* Import Button */}
                                    <Button
                                        onClick={s.runImport}
                                        disabled={s.isImporting || !s.selectedTable}
                                        className="w-full bg-blue-600 hover:bg-blue-700 h-10 sm:h-12 text-sm sm:text-base"
                                    >
                                        {s.isImporting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                                                Import from Snowflake
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Export Form - Destination Mode */}
                    {mode === "destination" && (
                        <div className="grid gap-3 sm:gap-4">
                            {/* File Selection */}
                            <div>
                                <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">Select File to Export</Label>
                                {s.files && s.files.length > 0 ? (
                                    <Select
                                        value={s.selectedFile?.upload_id || ""}
                                        onValueChange={s.handleFileSelect}
                                    >
                                        <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                                            <SelectValue placeholder="Choose a file to export" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[...s.files]
                                                .sort((a, b) => {
                                                    const dateA = new Date(a.updated_at || a.status_timestamp || 0).getTime()
                                                    const dateB = new Date(b.updated_at || b.status_timestamp || 0).getTime()
                                                    return dateB - dateA
                                                })
                                                .map((file) => (
                                                    <SelectItem key={file.upload_id} value={file.upload_id}>
                                                        {file.original_filename || file.filename}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="w-full h-9 sm:h-10 flex items-center px-3 border border-input rounded-md bg-muted text-sm text-muted-foreground">
                                        No files available. Please upload and process files first.
                                    </div>
                                )}
                            </div>

                            {/* Selected File Info */}
                            {s.selectedFile && (
                                <Alert className="border-blue-200 bg-blue-50 py-2 sm:py-3">
                                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                                    <AlertDescription className="text-sm sm:text-base text-blue-900 ml-2">
                                        {s.selectedFile.original_filename || s.selectedFile.filename} • Status: {s.selectedFile.status}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Destination Table */}
                            <div>
                                <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">
                                    <Table className="inline h-3.5 w-3.5 mr-1 relative -top-px" />
                                    Destination Table
                                </Label>
                                <Select
                                    value={s.selectedExportTable}
                                    onValueChange={s.setSelectedExportTable}
                                >
                                    <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                                        <SelectValue placeholder="Select destination table" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__create_new__">
                                            <span className="flex items-center gap-2">
                                                <Plus className="h-3.5 w-3.5" />
                                                Create New Table
                                            </span>
                                        </SelectItem>
                                        {s.tables.map((tbl) => (
                                            <SelectItem key={tbl.name} value={tbl.name}>
                                                {tbl.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* New Table Name */}
                            {s.selectedExportTable === "__create_new__" && (
                                <div>
                                    <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">New Table Name</Label>
                                    <Input
                                        placeholder="MY_TABLE_NAME"
                                        value={s.newTableName}
                                        onChange={(e) => s.setNewTableName(e.target.value)}
                                        className="h-9 sm:h-10 text-sm sm:text-base uppercase"
                                    />
                                </div>
                            )}

                            {/* Mapping + Export Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => s.setMappingOpen(true)}
                                    disabled={
                                        !s.selectedFile ||
                                        !s.selectedExportTable ||
                                        s.selectedExportTable === "__create_new__" ||
                                        s.tableColumns.length === 0
                                    }
                                    className="h-10 sm:h-12 text-sm sm:text-base"
                                >
                                    {s.tableColumnsLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Mapping
                                </Button>
                                <Button
                                    onClick={s.runExport}
                                    disabled={
                                        s.isExporting ||
                                        !s.selectedFile ||
                                        !s.selectedExportTable ||
                                        (s.selectedExportTable === "__create_new__" && !s.newTableName.trim())
                                    }
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 h-10 sm:h-12 text-sm sm:text-base"
                                >
                                    {s.isExporting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                                            Export to Snowflake
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Export Error */}
                            {s.error && (
                                <Alert variant="destructive" className="py-2 sm:py-3">
                                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                    <AlertDescription className="text-sm sm:text-base ml-2">
                                        {s.error}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Column Selection Dialog */}
            <AlertDialog open={s.columnModalOpen} onOpenChange={s.setColumnModalOpen}>
                <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Select Columns to Export</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose which columns from {s.selectedFile?.original_filename || s.selectedFile?.filename} should be exported to Snowflake.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-3">
                        {s.columnsLoading ? (
                            <div className="flex items-center space-x-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading columns...</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center space-x-2 py-2 border-b">
                                    <Checkbox
                                        id="select-all-columns"
                                        checked={s.selectedColumns.size === s.availableColumns.length && s.availableColumns.length > 0}
                                        onCheckedChange={(checked) => s.handleToggleAllColumns(checked === true)}
                                    />
                                    <label htmlFor="select-all-columns" className="text-sm font-medium cursor-pointer">
                                        Select All
                                    </label>
                                </div>

                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                    {s.availableColumns.length > 0 ? (
                                        s.availableColumns.map((col) => (
                                            <div key={col} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`col-${col}`}
                                                    checked={s.selectedColumns.has(col)}
                                                    onCheckedChange={(checked) => s.handleToggleColumn(col, checked === true)}
                                                />
                                                <label htmlFor={`col-${col}`} className="text-sm cursor-pointer truncate flex-1">
                                                    {col}
                                                </label>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No columns available</p>
                                    )}
                                </div>

                                {s.columnsError && (
                                    <Alert variant="destructive" className="py-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-xs ml-2">{s.columnsError}</AlertDescription>
                                    </Alert>
                                )}
                            </>
                        )}
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={s.selectedColumns.size === 0 || s.isExporting}
                            onClick={() => s.setColumnModalOpen(false)}
                        >
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Column Mapping Dialog */}
            <Dialog open={s.mappingOpen} onOpenChange={s.setMappingOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Map columns to {s.selectedExportTable}</DialogTitle>
                        <DialogDescription>
                            Map your file columns to the Snowflake table columns before export.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-2">
                        {s.tableColumnsLoading ? (
                            <div className="flex items-center space-x-2 text-muted-foreground py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading table columns...</span>
                            </div>
                        ) : s.tableColumns.length > 0 ? (
                            s.tableColumns.map((col) => (
                                <div key={col} className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-3 items-center">
                                    <div className="text-sm font-medium truncate" title={col}>
                                        {col}
                                    </div>
                                    <Select
                                        value={s.columnMapping[col] || ""}
                                        onValueChange={(value) =>
                                            s.setColumnMapping((prev) => ({ ...prev, [col]: value }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select file column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__unmapped__">
                                                <span className="text-muted-foreground">— Skip —</span>
                                            </SelectItem>
                                            {s.availableColumns.map((fc) => (
                                                <SelectItem key={`${col}-${fc}`} value={fc}>
                                                    {fc}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground py-4">
                                No columns found in the selected table.
                            </p>
                        )}
                    </div>

                    <Separator />

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => s.setMappingOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => s.setMappingOpen(false)}>
                            Save mapping
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
