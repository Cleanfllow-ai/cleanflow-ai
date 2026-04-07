"use client"

import {
    Loader2,
    Download,
    Search,
    FolderOpen,
    FileSpreadsheet,
    FileText,
    ChevronRight,
    CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useState } from "react"
import { useStorageImport } from "./use-storage-import"
import type { StorageFile } from "@/modules/connectors/types"

interface StorageImportProps {
    provider: string
    mode?: "source" | "destination"
    uploadId?: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: "success" | "error") => void
}

function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(isoString: string): string {
    if (!isoString) return ""
    try {
        return new Date(isoString).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    } catch {
        return ""
    }
}

function getFileIcon(mimeType: string) {
    if (mimeType === "application/vnd.google-apps.spreadsheet") {
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />
    }
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
        return <FileSpreadsheet className="h-4 w-4 text-green-700" />
    }
    return <FileText className="h-4 w-4 text-blue-600" />
}

function getTypeBadge(mimeType: string) {
    if (mimeType === "application/vnd.google-apps.spreadsheet") {
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">Sheet</Badge>
    }
    if (mimeType === "text/csv") {
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">CSV</Badge>
    }
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">Excel</Badge>
    }
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">File</Badge>
}

export default function StorageImport({
    provider,
    mode = "source",
    onImportComplete,
    onNotification,
}: StorageImportProps) {
    const g = useStorageImport({ provider, onImportComplete, onNotification })
    const [localSearch, setLocalSearch] = useState("")

    // ── Not connected ─────────────────────────────────────────────────
    if (g.isCheckingStatus) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[250px] p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Checking connection...</p>
            </div>
        )
    }

    // ── File browser ─────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={`Search files in ${g.providerDisplayName}...`}
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            g.searchFiles(localSearch)
                        }
                    }}
                    className="pl-10 pr-20"
                />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => g.searchFiles(localSearch)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-3 text-xs"
                >
                    Search
                </Button>
            </div>

            {/* Breadcrumb navigation */}
            {!g.searchQuery && g.breadcrumb.length > 1 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
                    {g.breadcrumb.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-1 shrink-0">
                            {index > 0 && <ChevronRight className="h-3 w-3" />}
                            <button
                                onClick={() => g.navigateToBreadcrumb(index)}
                                className={`hover:text-foreground transition-colors ${
                                    index === g.breadcrumb.length - 1
                                        ? "text-foreground font-medium"
                                        : ""
                                }`}
                            >
                                {item.name}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {g.searchQuery && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                        Results for &ldquo;{g.searchQuery}&rdquo;
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setLocalSearch("")
                            g.searchFiles("")
                        }}
                        className="h-6 px-2 text-xs"
                    >
                        Clear
                    </Button>
                </div>
            )}

            {/* Import progress bar */}
            {g.isImporting && g.importingFileName && (
                <div className="border rounded-lg p-4 bg-muted/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm font-medium truncate max-w-[300px]">
                                {g.importingFileName}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {Math.round(g.importProgress)}%
                        </span>
                    </div>
                    <Progress value={g.importProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                        {g.importStatus}
                    </p>
                </div>
            )}

            {/* Import success */}
            {!g.isImporting && g.importResult && (
                <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                        Imported <strong>{g.importResult.filename}</strong>
                        {g.importResult.file_size
                            ? ` (${formatFileSize(g.importResult.file_size)})`
                            : ""}
                        . DQ processing started.
                    </AlertDescription>
                </Alert>
            )}

            {/* Folders */}
            {!g.searchQuery && g.folders.length > 0 && (
                <div className="space-y-1">
                    {g.folders.map((folder) => (
                        <button
                            key={folder.id}
                            onClick={() => g.navigateToFolder(folder)}
                            className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                            <FolderOpen className="h-4 w-4 text-yellow-600 shrink-0" />
                            <span className="text-sm truncate">{folder.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Files list */}
            {g.isLoadingFiles && g.files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Loading files...</p>
                </div>
            ) : g.files.length === 0 && g.folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                        {g.searchQuery
                            ? "No matching files found"
                            : "No CSV, Excel, or spreadsheet files in this folder"}
                    </p>
                </div>
            ) : (
                <div className="border rounded-lg divide-y max-h-[350px] overflow-y-auto">
                    {g.files.map((file) => (
                        <FileRow
                            key={file.id}
                            file={file}
                            isImporting={g.isImporting && g.importingFileId === file.id}
                            disabled={g.isImporting}
                            onImport={() => g.importFile(file)}
                        />
                    ))}
                </div>
            )}

            {/* Load more */}
            {g.nextPageToken && (
                <div className="flex justify-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={g.loadMore}
                        disabled={g.isLoadingFiles}
                    >
                        {g.isLoadingFiles ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            "Load More"
                        )}
                    </Button>
                </div>
            )}

        </div>
    )
}

// ── File row component ──────────────────────────────────────────────────

function FileRow({
    file,
    isImporting,
    disabled,
    onImport,
}: {
    file: StorageFile
    isImporting: boolean
    disabled: boolean
    onImport: () => void
}) {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors">
            <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{file.name}</span>
                    {getTypeBadge(file.mimeType)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                    {file.size != null && <span>{formatFileSize(file.size)}</span>}
                </div>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={onImport}
                disabled={disabled}
                className="shrink-0 h-7 px-3 text-xs"
            >
                {isImporting ? (
                    <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Importing...
                    </>
                ) : (
                    <>
                        <Download className="h-3 w-3 mr-1" />
                        Import
                    </>
                )}
            </Button>
        </div>
    )
}
