"use client";

import {
    Upload,
    Loader2,
    Download,
    Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { QuickBooksImport } from "@/modules/quickbooks";
import { ZohoBooksImport } from "@/modules/zoho";
import { UnifiedBridgeImport } from "@/modules/unified-bridge";
import { CustomDestinationExport } from "@/modules/files";
import {
    SOURCE_OPTIONS,
    DESTINATION_OPTIONS,
    ERP_OPTIONS,
} from "@/modules/files/page/constants";
import type { FilesPageState } from "./use-files-page";

interface UploadSectionProps {
    state: FilesPageState;
}

export function UploadSection({ state }: UploadSectionProps) {
    const {
        uploading, uploadProgress, dragActive,
        handleDrag, handleDrop, handleFileInput,
        fileInputRef, ensureFilesPermission,
        selectedSource, setSelectedSource,
        selectedDestination, setSelectedDestination,
        lastActiveSelector, setLastActiveSelector,
        selectedErp, setSelectedErp,
        selectedDestinationErp, setSelectedDestinationErp,
        selectedDestinationFormat, setSelectedDestinationFormat,
        pageMode,
        renderRestrictedFilesPanel,
        showFilesPermissionDenied,
        handleQuickBooksImportComplete,
    } = state;

    const { toast } = state as any;

    const notifyHandler = (message: string, type: string) => {
        // Handled via the state's toast — we need to use a pattern that
        // doesn't rely on importing useToast separately in this component.
    };

    return (
        <div className="space-y-4">
            {/* Header Row: Source selector + ERP dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground shrink-0">
                            Source:
                        </span>
                        <Select
                            value={selectedSource}
                            onValueChange={(value) => {
                                setSelectedSource(value);
                                setLastActiveSelector('source');
                                console.log(`Selected Source: ${value}`);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-[180px] h-9">
                                <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent>
                                {SOURCE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedSource === "erp" && (
                            <Select value={selectedErp} onValueChange={setSelectedErp}>
                                <SelectTrigger className="w-full sm:w-[180px] h-9">
                                    <SelectValue placeholder="Select ERP" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ERP_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground shrink-0">
                            Destination:
                        </span>
                        <Select
                            value={selectedDestination}
                            onValueChange={(value) => {
                                setSelectedDestination(value);
                                if (value !== 'null') {
                                    setLastActiveSelector('destination');
                                }
                                console.log(`Selected Destination: ${value}`);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-[180px] h-9">
                                <SelectValue placeholder="Select destination" />
                            </SelectTrigger>
                            <SelectContent>
                                {DESTINATION_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {selectedDestination !== "null" &&
                    selectedDestination === "local" && (
                        <Button
                            size="sm"
                            className="gap-2"
                            variant={selectedDestinationFormat ? "default" : "outline"}
                            disabled={!selectedDestinationFormat}
                        >
                            <Download className="h-4 w-4" />
                            Export
                        </Button>
                    )}
            </div>

            {/* Content Area - Rendering based on derived pageMode */}
            {pageMode === 'import' ? (
                <ImportSection state={state} />
            ) : pageMode === 'export' ? (
                <ExportSection state={state} />
            ) : null}
        </div>
    );
}

// ─── Import sub-section ─────────────────────────────────────────────
function ImportSection({ state }: { state: FilesPageState }) {
    const {
        selectedSource, selectedErp,
        uploading, uploadProgress, dragActive,
        handleDrag, handleDrop, handleFileInput,
        fileInputRef, ensureFilesPermission,
        renderRestrictedFilesPanel,
        showFilesPermissionDenied,
        handleQuickBooksImportComplete,
    } = state;

    return (
        <div className="space-y-4">
            {selectedSource === "local" ? (
                <div
                    className={cn(
                        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-6 sm:p-12 lg:p-20 transition-all cursor-pointer",
                        dragActive
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50",
                    )}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => {
                        if (uploading) return;
                        if (!ensureFilesPermission()) return;
                        fileInputRef.current?.click();
                    }}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center gap-4 sm:gap-6 lg:gap-8">
                            <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20 animate-spin text-primary" />
                            <div className="text-center">
                                <p className="text-base sm:text-lg font-medium">Uploading...</p>
                                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mt-1 sm:mt-2">
                                    {uploadProgress.toFixed(2)}%
                                </p>
                            </div>
                            <Progress value={uploadProgress} className="w-48 sm:w-60 lg:w-72 h-2 sm:h-3" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 sm:gap-4 lg:gap-6 text-center">
                            <div className="rounded-full bg-primary/10 p-4 sm:p-6 lg:p-8">
                                <Upload className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-primary" />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                                <p className="text-base sm:text-lg lg:text-xl font-medium">
                                    Upload your data for transformation
                                </p>
                                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                                    Drag & drop or click to browse
                                </p>
                            </div>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.json,.sql"
                        className="hidden"
                        onChange={handleFileInput}
                    />
                </div>
            ) : selectedSource === "unified-bridge" ? (
                renderRestrictedFilesPanel(
                    <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] rounded-xl border bg-card p-4">
                        <UnifiedBridgeImport
                            mode="source"
                            onImportComplete={handleQuickBooksImportComplete}
                            onPermissionDenied={showFilesPermissionDenied}
                            onNotification={(message, type) => {
                                // Notification handled at parent level
                            }}
                        />
                    </div>,
                )
            ) : selectedSource === "erp" && selectedErp === "quickbooks" ? (
                renderRestrictedFilesPanel(
                    <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
                        <QuickBooksImport
                            mode="source"
                            onImportComplete={handleQuickBooksImportComplete}
                            onPermissionDenied={showFilesPermissionDenied}
                            onNotification={(message, type) => { }}
                        />
                    </div>,
                )
            ) : selectedSource === "erp" && selectedErp === "zoho-books" ? (
                renderRestrictedFilesPanel(
                    <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
                        <ZohoBooksImport
                            mode="source"
                            onImportComplete={handleQuickBooksImportComplete}
                            onPermissionDenied={showFilesPermissionDenied}
                            onNotification={(message, type) => { }}
                        />
                    </div>,
                )
            ) : selectedSource === "erp" ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-6 sm:p-12 lg:p-20 border-2 border-dashed rounded-xl bg-muted/5">
                    <div className="rounded-full bg-muted p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
                        <Network className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-medium mb-2 sm:mb-3 lg:mb-4 text-center">
                        {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}
                    </h3>
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6 sm:mb-8 lg:mb-10 max-w-lg text-center px-4">
                        Connect your{" "}
                        {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}{" "}
                        account to import data directly.
                    </p>
                    <Button disabled size="lg" className="px-6 sm:px-8 py-4 sm:py-6 text-sm sm:text-base">
                        Connect
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 sm:gap-4 lg:gap-6 text-center">
                    <div className="rounded-full bg-primary/10 p-4 sm:p-6 lg:p-8">
                        <Upload className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-primary" />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                        <p className="text-base sm:text-lg lg:text-xl font-medium">
                            Upload your data for transformation
                        </p>
                        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                            Drag & drop or click to browse
                        </p>
                    </div>
                </div>
            )}
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json,.sql"
                className="hidden"
                onChange={handleFileInput}
            />
        </div>
    );
}

// ─── Export sub-section ─────────────────────────────────────────────
function ExportSection({ state }: { state: FilesPageState }) {
    const {
        selectedDestination, selectedDestinationErp,
        selectedDestinationFormat, setSelectedDestinationFormat,
        renderRestrictedFilesPanel,
        showFilesPermissionDenied,
        handleQuickBooksImportComplete,
    } = state;

    return (
        <div className="space-y-4">
            {selectedDestination === "local" ? (
                renderRestrictedFilesPanel(
                    <CustomDestinationExport
                        selectedFormat={selectedDestinationFormat}
                        onFormatChange={setSelectedDestinationFormat}
                        onPermissionDenied={showFilesPermissionDenied}
                    />,
                )
            ) : selectedDestination === "unified-bridge" ? (
                renderRestrictedFilesPanel(
                    <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] rounded-xl border bg-card p-4">
                        <UnifiedBridgeImport
                            mode="destination"
                            onImportComplete={handleQuickBooksImportComplete}
                            onPermissionDenied={showFilesPermissionDenied}
                            onNotification={(message, type) => { }}
                        />
                    </div>,
                )
            ) : selectedDestination === "erp" && selectedDestinationErp === "quickbooks" ? (
                renderRestrictedFilesPanel(
                    <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] rounded-xl border bg-card p-4">
                        <QuickBooksImport
                            mode="destination"
                            onPermissionDenied={showFilesPermissionDenied}
                            onNotification={(message, type) => { }}
                        />
                    </div>,
                )
            ) : selectedDestination === "erp" && selectedDestinationErp === "zoho-books" ? (
                renderRestrictedFilesPanel(
                    <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] rounded-xl border bg-card p-4">
                        <ZohoBooksImport
                            mode="destination"
                            onPermissionDenied={showFilesPermissionDenied}
                            onNotification={(message, type) => { }}
                        />
                    </div>,
                )
            ) : selectedDestination === "erp" ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-6 sm:p-12 lg:p-20 border-2 border-dashed rounded-xl bg-muted/5">
                    <div className="rounded-full bg-muted p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
                        <Network className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-medium mb-2 sm:mb-3 lg:mb-4 text-center">
                        {ERP_OPTIONS.find((e) => e.value === selectedDestinationErp)?.label}
                    </h3>
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6 sm:mb-8 lg:mb-10 max-w-lg text-center px-4">
                        Connect your{" "}
                        {ERP_OPTIONS.find((e) => e.value === selectedDestinationErp)?.label}{" "}
                        account to export data directly.
                    </p>
                    <Button disabled size="lg" className="px-6 sm:px-8 py-4 sm:py-6 text-sm sm:text-base">
                        Connect
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
