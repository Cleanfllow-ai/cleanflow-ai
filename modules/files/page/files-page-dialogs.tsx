"use client";

import {
    Loader2,
    CloudUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/shared/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RULE_IDS, getRuleMeta } from "@/shared/lib/rule-metadata";
import {
    RULE_SEVERITY_STYLES,
} from "@/modules/files/page/constants";
import {
    DownloadFormatModal,
    ColumnExportContent,
    ColumnExportDialog,
    ERPTransformationModal,
    FileDetailsDialog,
    PushToERPModal,
    ColumnProfilingPanel,
    QuarantineEditorDialog,
} from "@/modules/files";
import { WizardDialog } from "@/modules/processing";
import type { FilesPageState } from "./use-files-page";

interface FilesPageDialogsProps {
    state: FilesPageState;
}

export function FilesPageDialogs({ state }: FilesPageDialogsProps) {
    const {
        // Details
        selectedFile, detailsOpen, setDetailsOpen,
        // Download format
        showDownloadModal, setShowDownloadModal, downloadModalFile, handleFormatSelected, downloadingFormat,
        // ERP transformation
        showErpModal, setShowErpModal, erpModalConfig, handleDownloadWithErp,
        // Push to ERP
        pushQBModalOpen, setPushQBModalOpen, fileToPush, setFileToPush,
        // Wizard
        wizardOpen, wizardFile, handleWizardOpenChange, handleWizardComplete,
        idToken, loadFiles, setWizardOpen,
        // Column export
        showColumnExportModal, setShowColumnExportModal,
        columnExportFile, setColumnExportFile,
        columnExportColumns, setColumnExportColumns,
        columnExportLoading, handleColumnExport,
        downloading,
        // Actions dialog
        actionsDialogOpen, setActionsDialogOpen,
        actionsDialogFile,
        actionsErpMode, setActionsErpMode, actionsErpTarget, setActionsErpTarget,
        // Delete
        showDeleteModal, setShowDeleteModal, fileToDelete, handleDeleteConfirm,
        // Display columns
        displayColumnModalOpen, setDisplayColumnModalOpen,
        pendingVisibleColumns, setPendingVisibleColumns,
        visibleColumns, setVisibleColumns,
        // Column selection modal
        columnModalOpen, setColumnModalOpen,
        availableColumns, selectedColumns, columnsLoading, columnsError,
        selectionFileError, selectionProfilingData, selectionProfilingLoading, selectionProfilingError,
        handleToggleColumn, handleToggleAllColumns, handleColumnConfirm, handleColumnCancel,
        selectionFileInputRef, handleSelectionFileInput,
        // Confirm columns
        confirmColumnsOpen, setConfirmColumnsOpen, confirmColumns, confirmAllColumns,
        handleConfirmColumnsCancel, handleConfirmColumnsProceed,
        // Rules dialog
        rulesDialogOpen, setRulesDialogOpen, rulesConfirmed,
        handleOpenRulesDialog, handleCloseRulesDialog, handleConfirmRulesDialog,
        globalDisabledRules, requiredColumns,
        disableRulesByColumn, overrideRulesByColumn,
        rulesDisableColumn, rulesOverrideColumn,
        handleToggleGlobalRule, handleToggleRequiredColumn,
        handleSelectDisableColumn, handleSelectOverrideColumn,
        handleToggleDisableRule, handleToggleOverrideRule,
        // Custom rules
        customRules, customRuleColumn, setCustomRuleColumn,
        customRulePrompt, setCustomRulePrompt,
        customRuleSuggestion, setCustomRuleSuggestion,
        customRuleSuggesting, customRuleSuggestError,
        handleGenerateCustomRule, handleApproveCustomRule, handleRemoveCustomRule,
        // Profiling
        profilingFileId, setProfilingFileId, profilingData, loadingProfiling,
        // Quarantine editor
        quarantineEditorOpen, setQuarantineEditorOpen,
        quarantineEditorFile, setQuarantineEditorFile,
        handleOpenQuarantineEditor, handleQuarantineEditorComplete,
        // Rename on duplicate
        showRenameDialog, setShowRenameDialog,
        pendingUploadFile, renameValue, setRenameValue,
        renameError, setRenameError,
        handleRenameConfirm,
    } = state;

    const renderRuleOption = (
        ruleId: string,
        checked: boolean,
        onCheckedChange: (checked: boolean) => void,
    ) => {
        const meta = getRuleMeta(ruleId);
        return (
            <label
                key={ruleId}
                className="flex items-start gap-3 rounded-md border border-muted/60 p-3"
            >
                <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onCheckedChange(Boolean(value))}
                />
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{meta.name}</span>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] h-5 px-2 uppercase",
                                RULE_SEVERITY_STYLES[meta.severity] || RULE_SEVERITY_STYLES.info,
                            )}
                        >
                            {meta.severity}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                    <p className="text-[10px] text-muted-foreground">Rule ID: {ruleId}</p>
                </div>
            </label>
        );
    };

    return (
        <>
            {/* Display Columns Modal */}
            <AlertDialog open={displayColumnModalOpen} onOpenChange={setDisplayColumnModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Display Columns</AlertDialogTitle>
                        <AlertDialogDescription>
                            Select which columns to display in the file explorer table.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="select-all-display-columns"
                                    checked={pendingVisibleColumns.size === 10}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setPendingVisibleColumns(new Set([
                                                "file", "score", "quality", "rows", "category",
                                                "status", "uploaded", "updated", "processingTime", "actions",
                                            ]));
                                        } else {
                                            setPendingVisibleColumns(new Set());
                                        }
                                    }}
                                />
                                <Label htmlFor="select-all-display-columns" className="text-sm font-medium">Select all</Label>
                            </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                            {[
                                { id: "file", label: "File" },
                                { id: "score", label: "Score" },
                                { id: "quality", label: "Data Quality" },
                                { id: "rows", label: "Rows" },
                                { id: "category", label: "Ingestion Type" },
                                { id: "status", label: "Status" },
                                { id: "uploaded", label: "Uploaded" },
                                { id: "updated", label: "Updated" },
                                { id: "processingTime", label: "Processing Time" },
                                { id: "actions", label: "Actions" },
                            ].map((col) => (
                                <div key={col.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`display-col-${col.id}`}
                                        checked={pendingVisibleColumns.has(col.id)}
                                        onCheckedChange={(checked) => {
                                            const newVisible = new Set(pendingVisibleColumns);
                                            if (checked) newVisible.add(col.id); else newVisible.delete(col.id);
                                            setPendingVisibleColumns(newVisible);
                                        }}
                                    />
                                    <Label htmlFor={`display-col-${col.id}`} className="text-sm cursor-pointer">{col.label}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <Button onClick={() => { setVisibleColumns(new Set(pendingVisibleColumns)); setDisplayColumnModalOpen(false); }}>Apply</Button>
                        <AlertDialogCancel onClick={() => setPendingVisibleColumns(new Set(visibleColumns))}>Close</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Column Selection Modal */}
            <AlertDialog open={columnModalOpen} onOpenChange={setColumnModalOpen}>
                <AlertDialogContent className="!max-w-[95vw] !w-[95vw] h-[90vh] sm:!max-w-[95vw] overflow-hidden grid-rows-[auto_1fr_auto]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Select columns to process</AlertDialogTitle>
                        <AlertDialogDescription>Choose which columns should be included for this run. All columns are selected by default.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 overflow-hidden pr-1 min-h-0">
                        {columnsLoading ? (
                            <div className="col-span-full flex items-center justify-center h-full text-muted-foreground">
                                <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading columns...</span></div>
                            </div>
                        ) : (
                            <div className="space-y-3 min-h-0">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="select-all-columns"
                                            checked={availableColumns.length > 0 && selectedColumns.size === availableColumns.length}
                                            onCheckedChange={(checked) => handleToggleAllColumns(Boolean(checked))}
                                        />
                                        <Label htmlFor="select-all-columns" className="text-sm">Select all</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input ref={selectionFileInputRef} type="file" accept=".json,.csv,.xlsx,.xls" className="hidden" onChange={handleSelectionFileInput} />
                                        <Button variant="outline" size="sm" onClick={() => selectionFileInputRef.current?.click()}>Upload selection</Button>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <p className="text-xs text-muted-foreground">
                                        Tip: upload a CSV / Excel / JSON with columns: <code>name</code> and <code>include</code> (true/false) to quickly apply selections.
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 max-h-[60vh]">
                                    {availableColumns.map((col) => (
                                        <div key={col} className="flex items-center space-x-2">
                                            <Checkbox id={`col-${col}`} checked={selectedColumns.has(col)} onCheckedChange={(checked) => handleToggleColumn(col, Boolean(checked))} />
                                            <Label htmlFor={`col-${col}`} className="text-sm">{col}</Label>
                                        </div>
                                    ))}
                                    {availableColumns.length === 0 && (
                                        <p className="text-sm text-muted-foreground">Columns could not be detected automatically. You can still proceed to process all columns.</p>
                                    )}
                                </div>
                                {columnsError && <p className="text-sm text-destructive">{columnsError}</p>}
                                {selectionFileError && <p className="text-sm text-destructive">{selectionFileError}</p>}
                            </div>
                        )}
                        <div className="space-y-2 min-h-0 overflow-hidden">
                            <p className="text-sm font-medium">Column profiling preview</p>
                            {selectionProfilingError && <p className="text-sm text-destructive mt-1">{selectionProfilingError}</p>}
                            {selectionProfilingLoading || selectionProfilingData ? (
                                <div className="mt-2 min-h-0 overflow-y-auto">
                                    <ColumnProfilingPanel data={selectionProfilingData} loading={selectionProfilingLoading} embedded />
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">Profiling preview will appear here.</p>
                            )}
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleColumnCancel}>Cancel</AlertDialogCancel>
                        {!columnsLoading && !selectionProfilingLoading && !rulesConfirmed && (
                            <Button variant="outline" onClick={handleOpenRulesDialog}>Next: Review rules</Button>
                        )}
                        {!columnsLoading && !selectionProfilingLoading && rulesConfirmed && (
                            <AlertDialogAction onClick={handleColumnConfirm}>Proceed</AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rules Dialog */}
            <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>AI-based suggestions (optional)</DialogTitle>
                        <DialogDescription>AI reviews this dataset and suggests extra checks. Review and confirm before applying.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Add deterministic checks for specific columns. Nothing is auto-fixed or deleted.</p>
                        <p className="text-xs text-muted-foreground">Scope: this dataset only. You can change these settings before processing starts.</p>
                    </div>
                    <Tabs defaultValue="global" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="custom">Custom Checks</TabsTrigger>
                            <TabsTrigger value="global">Global Rules</TabsTrigger>
                            <TabsTrigger value="required">Required Fields</TabsTrigger>
                            <TabsTrigger value="disable">Disable Rules</TabsTrigger>
                            <TabsTrigger value="override">Edit Rules</TabsTrigger>
                        </TabsList>

                        <TabsContent value="custom" className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Column</Label>
                                    <Select value={customRuleColumn} onValueChange={setCustomRuleColumn}>
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Select column" /></SelectTrigger>
                                        <SelectContent>
                                            {availableColumns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs text-muted-foreground">Prompt</Label>
                                    <Input value={customRulePrompt} onChange={(event) => setCustomRulePrompt(event.target.value)} placeholder="Validate this column as IPv4 address" />
                                </div>
                                <div className="flex items-end">
                                    <Button variant="outline" onClick={handleGenerateCustomRule} disabled={customRuleSuggesting}>
                                        {customRuleSuggesting ? "Generating..." : "Generate rule"}
                                    </Button>
                                </div>
                            </div>

                            {customRuleSuggestError && <p className="text-sm text-destructive">{customRuleSuggestError}</p>}

                            {customRuleSuggestion?.suggestion && (
                                <div className="rounded-md border border-muted/60 p-3 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium">{customRuleSuggestion.suggestion.rule_name || "Suggested rule"}</span>
                                        {customRuleSuggestion.suggestion.severity && (
                                            <Badge variant="outline" className={cn("text-[10px] h-5 px-2 uppercase", RULE_SEVERITY_STYLES[customRuleSuggestion.suggestion.severity] || RULE_SEVERITY_STYLES.info)}>
                                                {customRuleSuggestion.suggestion.severity}
                                            </Badge>
                                        )}
                                        {typeof customRuleSuggestion.suggestion.confidence === "number" && (
                                            <span className="text-xs text-muted-foreground">{(customRuleSuggestion.suggestion.confidence * 100).toFixed(0)}% confidence</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Template: {customRuleSuggestion.suggestion.template}</p>
                                    {customRuleSuggestion.suggestion.explanation && <p className="text-xs text-muted-foreground">{customRuleSuggestion.suggestion.explanation}</p>}
                                    {customRuleSuggestion.suggestion.template === "code" && customRuleSuggestion.suggestion.code && (
                                        <details className="mt-2">
                                            <summary className="text-xs text-primary cursor-pointer hover:underline">View Python Code</summary>
                                            <pre className="mt-2 p-3 bg-zinc-900 text-green-400 text-xs rounded-md overflow-x-auto max-h-48 overflow-y-auto">
                                                <code>{customRuleSuggestion.suggestion.code}</code>
                                            </pre>
                                        </details>
                                    )}
                                    {customRuleSuggestion.executable === false && <p className="text-xs text-destructive">This rule template is not supported for execution yet.</p>}
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" onClick={handleApproveCustomRule} disabled={customRuleSuggestion.executable === false}>Approve</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setCustomRuleSuggestion(null)}>Reject</Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <p className="text-xs text-muted-foreground">Approved checks will run during processing for this file.</p>
                                {customRules.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No custom checks added yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {customRules.map((rule) => (
                                            <div key={rule.rule_id} className="flex items-start justify-between gap-4 rounded-md border border-muted/60 p-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-medium">{rule.rule_name || "Custom check"}</span>
                                                        {rule.severity && (
                                                            <Badge variant="outline" className={cn("text-[10px] h-5 px-2 uppercase", RULE_SEVERITY_STYLES[rule.severity] || RULE_SEVERITY_STYLES.info)}>
                                                                {rule.severity}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Column: {rule.column} · Template: {rule.template}</p>
                                                    {rule.explanation && <p className="text-xs text-muted-foreground">{rule.explanation}</p>}
                                                    {rule.template === "code" && rule.code && (
                                                        <details className="mt-1">
                                                            <summary className="text-xs text-primary cursor-pointer hover:underline">View Python Code</summary>
                                                            <pre className="mt-2 p-2 bg-zinc-900 text-green-400 text-xs rounded-md overflow-x-auto max-h-32 overflow-y-auto">
                                                                <code>{rule.code}</code>
                                                            </pre>
                                                        </details>
                                                    )}
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveCustomRule(rule.rule_id)}>Remove</Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="global" className="space-y-3">
                            <p className="text-sm text-muted-foreground">Turn off specific checks for all columns in this dataset.</p>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {RULE_IDS.map((ruleId) => renderRuleOption(ruleId, globalDisabledRules.includes(ruleId), (checked) => handleToggleGlobalRule(ruleId, checked)))}
                            </div>
                        </TabsContent>

                        <TabsContent value="required" className="space-y-3">
                            <p className="text-sm text-muted-foreground">Mark columns as required. Missing values will be flagged.</p>
                            {availableColumns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No columns available.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                                    {availableColumns.map((col) => (
                                        <label key={col} className="flex items-center gap-2 text-sm">
                                            <Checkbox checked={requiredColumns.has(col)} onCheckedChange={(checked) => handleToggleRequiredColumn(col, Boolean(checked))} />
                                            <span>{col}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="disable" className="space-y-3">
                            <p className="text-sm text-muted-foreground">Turn off checks for a specific column.</p>
                            <Select value={rulesDisableColumn} onValueChange={handleSelectDisableColumn}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="Select column" /></SelectTrigger>
                                <SelectContent>{availableColumns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}</SelectContent>
                            </Select>
                            {rulesDisableColumn ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {RULE_IDS.map((ruleId) => {
                                        const selected = disableRulesByColumn[rulesDisableColumn] || [];
                                        return renderRuleOption(ruleId, selected.includes(ruleId), (checked) => handleToggleDisableRule(rulesDisableColumn, ruleId, checked));
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Select a column to configure disabled rules.</p>
                            )}
                        </TabsContent>

                        <TabsContent value="override" className="space-y-3">
                            <p className="text-sm text-muted-foreground">Edit suggested checks for a specific column.</p>
                            <Select value={rulesOverrideColumn} onValueChange={handleSelectOverrideColumn}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="Select column" /></SelectTrigger>
                                <SelectContent>{availableColumns.map((col) => (<SelectItem key={col} value={col}>{col}</SelectItem>))}</SelectContent>
                            </Select>
                            {rulesOverrideColumn ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {RULE_IDS.map((ruleId) => {
                                        const selected = overrideRulesByColumn[rulesOverrideColumn] || [];
                                        return renderRuleOption(ruleId, selected.includes(ruleId), (checked) => handleToggleOverrideRule(rulesOverrideColumn, ruleId, checked));
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Select a column to edit suggested rules.</p>
                            )}
                        </TabsContent>
                    </Tabs>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={handleCloseRulesDialog}>Back</Button>
                        <Button onClick={handleConfirmRulesDialog}>Done</Button>
                    </AlertDialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Columns */}
            <AlertDialog open={confirmColumnsOpen} onOpenChange={setConfirmColumnsOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm columns</AlertDialogTitle>
                        <AlertDialogDescription>Review the columns to be processed. Click Proceed to start processing.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        {confirmAllColumns ? (
                            <p className="text-sm text-muted-foreground">All columns will be processed.</p>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground">{confirmColumns.length} column(s) selected:</p>
                                <div className="max-h-64 overflow-y-auto pr-1">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Column name</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {confirmColumns.map((col) => (<TableRow key={col}><TableCell className="text-sm">{col}</TableCell></TableRow>))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleConfirmColumnsCancel}>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmColumnsProceed}>Proceed</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation */}
            <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete file?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove {fileToDelete?.original_filename || fileToDelete?.filename}. The action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* File Details */}
            <FileDetailsDialog
                file={selectedFile}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onRemediate={handleOpenQuarantineEditor}
            />

            {/* Download Format */}
            <DownloadFormatModal
                open={showDownloadModal}
                onOpenChange={setShowDownloadModal}
                file={downloadModalFile}
                onDownload={handleFormatSelected}
                downloading={Boolean(downloadingFormat)}
            />

            {/* ERP Transformation */}
            <ERPTransformationModal
                open={showErpModal}
                onOpenChange={setShowErpModal}
                onDownload={handleDownloadWithErp}
                downloading={Boolean(downloadingFormat)}
                filename={
                    downloadModalFile?.original_filename ||
                    downloadModalFile?.filename ||
                    erpModalConfig?.file.original_filename ||
                    erpModalConfig?.file.filename ||
                    "selected file"
                }
                dqStats={{
                    cleanRows: erpModalConfig?.file.rows_out
                        ? erpModalConfig.file.rows_out - (erpModalConfig.file.rows_fixed || 0)
                        : undefined,
                    fixedRows: erpModalConfig?.file.rows_fixed,
                    quarantinedRows: erpModalConfig?.file.rows_quarantined,
                    totalRows: erpModalConfig?.file.rows_in,
                }}
            />

            {/* Push to ERP */}
            <PushToERPModal
                open={pushQBModalOpen}
                onOpenChange={setPushQBModalOpen}
                file={fileToPush}
                onSuccess={() => {
                    setPushQBModalOpen(false);
                    setFileToPush(null);
                }}
                onError={() => { }}
            />

            {/* Wizard */}
            <WizardDialog
                open={wizardOpen && !!wizardFile}
                onOpenChange={handleWizardOpenChange}
                file={wizardFile}
                authToken={idToken || ""}
                onComplete={handleWizardComplete}
            />

            {/* Column Export */}
            <ColumnExportDialog
                open={showColumnExportModal}
                onOpenChange={(open) => {
                    setShowColumnExportModal(open);
                    if (!open) { setColumnExportFile(null); setColumnExportColumns([]); }
                }}
                fileName={columnExportFile?.original_filename || columnExportFile?.filename || "file"}
                columns={columnExportColumns}
                onExport={handleColumnExport}
                exporting={downloading === columnExportFile?.upload_id || columnExportLoading}
            />

            {/* Actions Dialog */}
            <Dialog open={actionsDialogOpen} onOpenChange={setActionsDialogOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                                <CloudUpload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            Download Data
                        </DialogTitle>
                        <DialogDescription>Configure your data and select a destination.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                        <div className="rounded-lg border p-4 bg-muted/30">
                            <div className="text-sm font-medium">
                                {actionsDialogFile?.original_filename || actionsDialogFile?.filename || "Selected file"}
                            </div>
                            {actionsDialogFile && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    {actionsDialogFile.rows_clean || actionsDialogFile.rows_out || 0} clean rows ready to export
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                                ERP Transformation (Optional)
                            </Label>
                            <RadioGroup value={actionsErpMode} onValueChange={(value) => setActionsErpMode(value as "original" | "transform")} className="space-y-2">
                                <div className="flex items-center space-x-2 rounded-lg border p-3">
                                    <RadioGroupItem value="original" id="erp-original" />
                                    <Label htmlFor="erp-original" className="cursor-pointer">Original Format (CSV)</Label>
                                </div>
                                <div className="flex items-center space-x-2 rounded-lg border p-3">
                                    <RadioGroupItem value="transform" id="erp-transform" />
                                    <Label htmlFor="erp-transform" className="cursor-pointer">Transform for ERP System</Label>
                                </div>
                            </RadioGroup>
                            {actionsErpMode === "transform" && (
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium">ERP System</Label>
                                    <Select value={actionsErpTarget} onValueChange={setActionsErpTarget}>
                                        <SelectTrigger><SelectValue placeholder="Select ERP" /></SelectTrigger>
                                        <SelectContent>
                                            {["Oracle Fusion", "SAP ERP", "Microsoft Dynamics", "NetSuite", "Workday", "QuickBooks Online", "Zoho Books", "Custom ERP"].map((erp) => (
                                                <SelectItem key={erp} value={erp}>{erp}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        {columnExportLoading ? (
                            <div className="text-sm text-muted-foreground">Loading columns…</div>
                        ) : (
                            <ColumnExportContent
                                fileName={actionsDialogFile?.original_filename || actionsDialogFile?.filename || "Selected file"}
                                columns={columnExportColumns}
                                onExport={handleColumnExport}
                                primaryActionLabel="Download"
                                exporting={downloading === columnExportFile?.upload_id || columnExportLoading}
                                onCancel={() => setActionsDialogOpen(false)}
                                showTitle={false}
                                className="min-h-[360px]"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Profiling Dialog */}
            <Dialog open={!!profilingFileId} onOpenChange={(open) => !open && setProfilingFileId(null)}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>Column Profiling & DQ Analysis</DialogTitle>
                        <DialogDescription>Detailed analysis of data types, quality issues, and suggested rules.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 pt-2">
                        <ColumnProfilingPanel data={profilingData} loading={loadingProfiling} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Processing Wizard Dialog */}
            <WizardDialog
                open={wizardOpen}
                onOpenChange={setWizardOpen}
                file={wizardFile}
                authToken={idToken || ""}
                onStarted={() => { setWizardOpen(false); loadFiles(); }}
                onComplete={() => { setWizardOpen(false); loadFiles(); }}
            />

            {/* Quarantine Editor Dialog */}
            <QuarantineEditorDialog
                file={quarantineEditorFile}
                open={quarantineEditorOpen}
                onOpenChange={(open) => {
                    setQuarantineEditorOpen(open);
                    if (!open) {
                        setQuarantineEditorFile(null);
                        handleQuarantineEditorComplete();
                    }
                }}
            />

            {/* Rename on duplicate filename dialog */}
            <Dialog
                open={showRenameDialog}
                onOpenChange={(open) => { if (!open) { setShowRenameDialog(false); setRenameError(null); } }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>File already exists</DialogTitle>
                        <DialogDescription>
                            A file named <strong>{pendingUploadFile?.name}</strong> already exists.
                            You must rename it before uploading.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 space-y-1">
                        <Label htmlFor="rename-upload-input">New filename</Label>
                        <div className="flex items-center gap-1">
                            <Input
                                id="rename-upload-input"
                                value={renameValue}
                                onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter" && renameValue.trim()) void handleRenameConfirm(); }}
                                className={renameError ? "border-destructive focus-visible:ring-destructive" : ""}
                                placeholder="Enter a new name"
                            />
                            <span className="text-sm text-muted-foreground font-mono shrink-0 px-1">
                                {pendingUploadFile?.name.includes(".")
                                    ? pendingUploadFile.name.slice(pendingUploadFile.name.lastIndexOf("."))
                                    : ""}
                            </span>
                        </div>
                        {renameError && (
                            <p className="text-xs text-destructive">{renameError}</p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => { setShowRenameDialog(false); setRenameError(null); }}>Cancel</Button>
                        <Button onClick={() => void handleRenameConfirm()} disabled={!renameValue.trim()}>
                            Rename &amp; Upload
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
