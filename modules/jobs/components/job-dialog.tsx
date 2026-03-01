"use client"

import { Loader2, ChevronDown, ChevronRight, Sparkles, Star, Plus, Upload, Settings, Edit, Download, Shield, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/shared/lib/utils"
import { getRuleLabel } from "@/shared/lib/dq-rules"
import type { Job, JobFrequency } from "@/modules/jobs/api/jobs-api"

import { useJobDialog } from "./use-job-dialog"
import { ENTITY_OPTIONS, ERP_OPTIONS, SOURCE_ERP_OPTIONS } from "./job-dialog-constants"

// ─── Props ────────────────────────────────────────────────────────────────────

interface JobDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    job?: Job | null
    onSuccess: () => void
    onCancel: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JobDialog({ open, onOpenChange, job, onSuccess, onCancel }: JobDialogProps) {
    const d = useJobDialog({ open, job, onSuccess })

    return (
    <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg">{d.isEdit ? "Edit Job" : "Create Job"}</DialogTitle>
                    <DialogDescription>
                        {d.isEdit ? "Update job configuration" : "Set up a new automated ERP sync job"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-1">
                    {/* Job Name */}
                    <div className="space-y-2">
                        <Label htmlFor="job-name" className="text-sm font-medium">Job Name</Label>
                        <Input
                            id="job-name"
                            placeholder="e.g. QB Invoice Sync"
                            value={d.name}
                            onChange={(e) => d.setName(e.target.value)}
                            className="h-10"
                        />
                    </div>

                    {/* Source & Destination */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Source ERP</Label>
                            <Select value={d.source} onValueChange={d.setSource}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {SOURCE_ERP_OPTIONS.map((erp) => (
                                        <SelectItem key={erp.value} value={erp.value}>{erp.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Destination ERP</Label>
                            <Select value={d.destination} onValueChange={d.setDestination}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ERP_OPTIONS.map((erp) => (
                                        <SelectItem key={erp.value} value={erp.value}>{erp.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Entity & Frequency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Entity</Label>
                            <Select value={d.entity} onValueChange={d.setEntity}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ENTITY_OPTIONS.map(e => (
                                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Frequency</Label>
                            <Select value={d.frequency} onValueChange={(v) => d.setFrequency(v as JobFrequency)}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15min">Every 15 min</SelectItem>
                                    <SelectItem value="1hr">Every hour</SelectItem>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="cron">Custom (Cron)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {d.frequency === "cron" && (
                        <Input
                            placeholder="e.g. 0 */2 * * *"
                            value={d.cronExpression}
                            onChange={(e) => d.setCronExpression(e.target.value)}
                            className="h-9 font-mono text-sm"
                        />
                    )}

                    {/* Assigned To */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Assigned To</Label>
                        <p className="text-xs text-muted-foreground">
                            Receives notifications for quarantined data, failures, and auto-pause events.
                        </p>
                        <Select value={d.responsibleUserId || "none"} onValueChange={(v) => d.setResponsibleUserId(v === "none" ? "" : v)}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select a team member..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    <span className="text-muted-foreground">None (no notifications)</span>
                                </SelectItem>
                                {d.orgMembers.map((m) => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                        <div className="flex items-center gap-2">
                                            <span>{m.email}</span>
                                            <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ─── Advanced (Optional) ─────────────────────────────── */}
                    <Collapsible open={d.advancedOpen} onOpenChange={d.handleAdvancedOpenChange}>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 border-t border-border/50">
                            {d.advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="text-sm font-medium text-muted-foreground">Advanced (Optional)</span>
                            {d.advancedOpen && (d.selectedColumns.length > 0 || d.selectedPresetId) && (
                                <Badge variant="outline" className="ml-auto text-[10px]">Configured</Badge>
                            )}
                        </CollapsibleTrigger>

                        <CollapsibleContent className="pt-3 space-y-4">
                            {/* Data Import Section */}
                            {!d.dataImported && d.advancedMode ? (
                                <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                                    <h3 className="text-sm font-semibold">Import Data from {SOURCE_ERP_OPTIONS.find(e => e.value === d.source)?.label}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Click below to import data from your {SOURCE_ERP_OPTIONS.find(e => e.value === d.source)?.label} account. After import, configure the five wizards.
                                    </p>
                                    <Button onClick={d.handleImportDataFromSource} disabled={d.importingData} className="w-full">
                                        {d.importingData ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                                        {d.importingData ? "Importing..." : "Import Data from Source"}
                                    </Button>
                                </div>
                            ) : null}

                            {/* Sequential Wizard (shown after data import) */}
                            {d.dataImported ? (
                                <div className="space-y-3">
                                    {/* ── 1. Select Columns ── */}
                                    <Collapsible open={d.currentAdvancedStep === "columns"} onOpenChange={(o) => { if (o) d.setCurrentAdvancedStep("columns") }}>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                                            {d.currentAdvancedStep === "columns" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <Badge className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center text-xs p-0 rounded-full">1</Badge>
                                            <span className="text-sm font-medium">Select Columns</span>
                                            {d.selectedColumns.length > 0 && (
                                                <Badge variant="outline" className="ml-auto text-[10px]">{d.selectedColumns.length} selected</Badge>
                                            )}
                                            {d.currentStepIndex > 0 && (
                                                <Badge variant="outline" className="ml-auto text-[10px] bg-green-500/20 text-green-700">✓</Badge>
                                            )}
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2 ml-2 space-y-3">
                                            {d.allColumns.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No columns available</p>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <Input placeholder="Search columns..." value={d.colSearch} onChange={(e) => d.setColSearch(e.target.value)} className="h-8 text-sm flex-1" />
                                                        <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => d.setSelectedColumns([...d.allColumns])}>All</Button>
                                                        <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => d.setSelectedColumns([])}>None</Button>
                                                    </div>
                                                    <div className="border border-border rounded-lg max-h-[30vh] overflow-y-auto">
                                                        <div className="grid grid-cols-2 gap-1 p-2">
                                                            {d.filteredCols.map(col => {
                                                                const checked = d.selectedColumns.includes(col)
                                                                return (
                                                                    <div key={col} onClick={() => d.toggleColumn(col)} className={cn(
                                                                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                                                                        checked ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                                                                    )}>
                                                                        <Checkbox checked={checked} />
                                                                        <span className="truncate">{col}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{d.selectedColumns.length} of {d.allColumns.length} columns selected</p>
                                                </>
                                            )}
                                            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                                                <Button size="sm" onClick={d.goToNextStep} disabled={d.selectedColumns.length === 0}>Next: Profiling →</Button>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* ── 2. Profiling ── */}
                                    <Collapsible open={d.currentAdvancedStep === "profiling"} onOpenChange={(o) => { if (o) d.setCurrentAdvancedStep("profiling") }}>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                                            {d.currentAdvancedStep === "profiling" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <Badge className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center text-xs p-0 rounded-full">2</Badge>
                                            <span className="text-sm font-medium">Profiling</span>
                                            {Object.keys(d.columnProfiles).length > 0 && (
                                                <Badge variant="outline" className="ml-auto text-[10px]">Analyzed</Badge>
                                            )}
                                            {d.currentStepIndex > 1 && (
                                                <Badge variant="outline" className="ml-auto text-[10px] bg-green-500/20 text-green-700">✓</Badge>
                                            )}
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2 ml-2 space-y-3">
                                            {Object.keys(d.columnProfiles).length === 0 ? (
                                                <div className="flex flex-col gap-3">
                                                    <p className="text-xs text-muted-foreground">Analyze {d.selectedColumns.length} selected columns to detect data types and quality metrics.</p>
                                                    <Button onClick={d.handleFetchProfiling} disabled={d.profilingLoading} className="w-full">
                                                        {d.profilingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                                                        {d.profilingLoading ? "Analyzing..." : "Analyze Columns"}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                                                    {Object.entries(d.columnProfiles).map(([col, profile]) => (
                                                        <div key={col} className="border border-muted rounded-lg p-3 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-sm">{col}</span>
                                                                    {profile.key_type === "primary_key" && (
                                                                        <Badge variant="default" className="text-[10px] px-1.5 py-0">PK</Badge>
                                                                    )}
                                                                    {profile.key_type === "unique" && (
                                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">UNIQUE</Badge>
                                                                    )}
                                                                </div>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {profile.type_guess || "unknown"}
                                                                    {profile.type_confidence != null && (
                                                                        <span className="ml-1 opacity-70">{Math.round(profile.type_confidence * 100)}%</span>
                                                                    )}
                                                                </Badge>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Null Rate:</span>
                                                                    <span className={cn(
                                                                        profile.null_rate != null && profile.null_rate > 0.1 ? "text-yellow-500 font-medium" : "text-green-500"
                                                                    )}>
                                                                        {profile.null_rate != null ? `${(profile.null_rate * 100).toFixed(1)}%` : "N/A"}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Unique:</span>
                                                                    <span>{profile.unique_ratio != null ? `${(profile.unique_ratio * 100).toFixed(1)}%` : "N/A"}</span>
                                                                </div>
                                                            </div>
                                                            {profile.rules && profile.rules.length > 0 && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    <span>Auto Rules: </span>
                                                                    {profile.rules
                                                                        .filter(r => r.decision === "auto")
                                                                        .map(r => getRuleLabel(r.rule_id))
                                                                        .join(", ") || "None"}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex justify-between gap-2 pt-2 border-t border-border/50">
                                                <Button variant="outline" size="sm" onClick={d.goToPreviousStep}>← Back</Button>
                                                <Button size="sm" onClick={d.goToNextStep} disabled={Object.keys(d.columnProfiles).length === 0}>Next: Settings →</Button>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* ── 3. Settings Preset ── */}
                                    <Collapsible open={d.currentAdvancedStep === "settings"} onOpenChange={(o) => { if (o) d.setCurrentAdvancedStep("settings") }}>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                                            {d.currentAdvancedStep === "settings" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <Badge className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center text-xs p-0 rounded-full">3</Badge>
                                            <span className="text-sm font-medium">Settings Preset</span>
                                            {d.selectedPresetId && (
                                                <Badge variant="outline" className="ml-auto text-[10px]">
                                                    {d.presets.find(p => p.preset_id === d.selectedPresetId)?.preset_name || "Selected"}
                                                </Badge>
                                            )}
                                            {d.currentStepIndex > 2 && (
                                                <Badge variant="outline" className="ml-auto text-[10px] bg-green-500/20 text-green-700">✓</Badge>
                                            )}
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2 ml-2 space-y-3">
                                            {d.presetsLoading ? (
                                                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />Loading presets...
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Preset selector with actions */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1">
                                                            <Select value={d.selectedPresetId || "none"} onValueChange={d.handleSelectPreset}>
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue placeholder="Select a preset..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">
                                                                        <span className="text-muted-foreground">No preset (default rules)</span>
                                                                    </SelectItem>
                                                                    {d.presets.map(p => (
                                                                        <SelectItem key={p.preset_id} value={p.preset_id}>
                                                                            <div className="flex items-center gap-2">
                                                                                {p.is_default && <Star className="w-3 h-3 text-yellow-500" />}
                                                                                {p.preset_name}
                                                                            </div>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Button variant="outline" size="sm" onClick={d.handleNewPreset}>
                                                            <Plus className="w-3 h-3 mr-1" />New
                                                        </Button>
                                                        <input ref={d.presetFileInputRef} type="file" accept=".json,.csv" className="hidden" onChange={d.handlePresetFileUpload} />
                                                        <Button variant="outline" size="sm" onClick={() => d.presetFileInputRef.current?.click()}>
                                                            <Upload className="w-3 h-3 mr-1" />Import
                                                        </Button>
                                                    </div>

                                                    {/* Settings display / editor */}
                                                    {(d.selectedPresetConfig || d.presetEditMode) && (
                                                        <div className="border border-border rounded-lg p-3 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-medium flex items-center gap-2">
                                                                    <Settings className="w-4 h-4" />
                                                                    {d.selectedPresetId ? d.presets.find(p => p.preset_id === d.selectedPresetId)?.preset_name : "Default Settings"}
                                                                </h4>
                                                                <div className="flex items-center gap-1">
                                                                    {d.presetEditMode ? (
                                                                        <>
                                                                            <Button variant="ghost" size="sm" onClick={d.handleCancelPresetEdit}>Cancel</Button>
                                                                            <Button size="sm" onClick={d.handleSavePresetEdit}>Save</Button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Button variant="ghost" size="sm" onClick={d.handleEditPreset}>
                                                                                <Edit className="w-3 h-3 mr-1" />Edit
                                                                            </Button>
                                                                            <Button variant="ghost" size="sm" onClick={d.handleExportPreset}>
                                                                                <Download className="w-3 h-3 mr-1" />Export
                                                                            </Button>
                                                                            {d.selectedPresetId && d.selectedPresetId !== "default_dq_rules" && (
                                                                                <Button variant="ghost" size="sm" className="text-destructive" onClick={d.handleDeletePreset}>
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </Button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {d.presetEditMode ? (
                                                                <Tabs value={d.activePresetTab} onValueChange={d.setActivePresetTab}>
                                                                    <TabsList className="grid grid-cols-3 w-full">
                                                                        <TabsTrigger value="policies">Policies</TabsTrigger>
                                                                        <TabsTrigger value="lookups">Lookups</TabsTrigger>
                                                                        <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
                                                                    </TabsList>

                                                                    <TabsContent value="policies" className="space-y-3 mt-3">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Strictness</Label>
                                                                            <Select value={d.editStrictness} onValueChange={d.setEditStrictness}>
                                                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="lenient">Lenient</SelectItem>
                                                                                    <SelectItem value="balanced">Balanced</SelectItem>
                                                                                    <SelectItem value="strict">Strict</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Auto-fix</Label>
                                                                            <Button type="button" variant="outline" className="w-full justify-between h-9" onClick={() => d.setEditAutoFix(!d.editAutoFix)}>
                                                                                <span className="text-sm">{d.editAutoFix ? "Enabled" : "Disabled"}</span>
                                                                                {d.editAutoFix ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                                                            </Button>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Unknown Column Behavior</Label>
                                                                            <Select value={d.editUnknownBehavior} onValueChange={d.setEditUnknownBehavior}>
                                                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="safe_cleanup_only">Safe cleanup only</SelectItem>
                                                                                    <SelectItem value="quarantine">Quarantine</SelectItem>
                                                                                    <SelectItem value="ignore">Ignore</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </TabsContent>

                                                                    <TabsContent value="lookups" className="space-y-3 mt-3">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Currencies (comma-separated)</Label>
                                                                            <Input value={d.editCurrencyValues} onChange={(e) => d.setEditCurrencyValues(e.target.value)} placeholder="USD, EUR, GBP..." className="h-9 text-sm" />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">UOM (comma-separated)</Label>
                                                                            <Input value={d.editUomValues} onChange={(e) => d.setEditUomValues(e.target.value)} placeholder="EA, PCS, KG..." className="h-9 text-sm" />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Status Enums (comma-separated)</Label>
                                                                            <Input value={d.editStatusEnums} onChange={(e) => d.setEditStatusEnums(e.target.value)} placeholder="DRAFT, APPROVED..." className="h-9 text-sm" />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Placeholders treated as missing</Label>
                                                                            <Input value={d.editPlaceholders} onChange={(e) => d.setEditPlaceholders(e.target.value)} placeholder="na, n/a, null, -, --" className="h-9 text-sm" />
                                                                        </div>
                                                                    </TabsContent>

                                                                    <TabsContent value="thresholds" className="space-y-3 mt-3">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Max text length</Label>
                                                                            <Input type="number" min={1} value={d.editMaxTextLen} onChange={(e) => d.setEditMaxTextLen(e.target.value)} className="h-9 text-sm" />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs">Date formats (comma-separated)</Label>
                                                                            <Input value={d.editDateFormats} onChange={(e) => d.setEditDateFormats(e.target.value)} placeholder="ISO, DMY, MDY" className="h-9 text-sm" />
                                                                        </div>
                                                                    </TabsContent>
                                                                </Tabs>
                                                            ) : (
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {/* Policies card */}
                                                                    <div className="border border-muted rounded-lg p-3 bg-muted/10">
                                                                        <div className="flex items-center gap-2 text-xs font-medium mb-1.5">
                                                                            <Shield className="w-3.5 h-3.5" /> Policies
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            <Badge variant="outline" className="text-[10px]">Strictness: {d.selectedPresetConfig?.policies?.strictness || "balanced"}</Badge>
                                                                            <Badge variant={d.selectedPresetConfig?.policies?.auto_fix ? "default" : "outline"} className="text-[10px]">
                                                                                {d.selectedPresetConfig?.policies?.auto_fix ? "Auto-fix On" : "Auto-fix Off"}
                                                                            </Badge>
                                                                            <Badge variant="outline" className="text-[10px]">Unknown: {d.selectedPresetConfig?.policies?.unknown || "safe_cleanup_only"}</Badge>
                                                                        </div>
                                                                    </div>
                                                                    {/* Lookups card */}
                                                                    <div className="border border-muted rounded-lg p-3 bg-muted/10">
                                                                        <div className="text-xs font-medium mb-1.5">Lookups</div>
                                                                        <div className="space-y-0.5 text-xs text-muted-foreground">
                                                                            <p><span className="font-medium text-foreground">Currencies:</span> {d.selectedPresetConfig?.currency_values?.join(", ") || "n/a"}</p>
                                                                            <p><span className="font-medium text-foreground">UOM:</span> {d.selectedPresetConfig?.uom_values?.join(", ") || "n/a"}</p>
                                                                            <p><span className="font-medium text-foreground">Status:</span> {d.selectedPresetConfig?.lookups?.status_values?.join(", ") || "n/a"}</p>
                                                                        </div>
                                                                    </div>
                                                                    {/* Data Hygiene card */}
                                                                    <div className="border border-muted rounded-lg p-3 bg-muted/10">
                                                                        <div className="text-xs font-medium mb-1.5">Data Hygiene</div>
                                                                        <div className="space-y-0.5 text-xs text-muted-foreground">
                                                                            <p><span className="font-medium text-foreground">Placeholders:</span> {d.selectedPresetConfig?.lookups?.placeholders?.join(", ") || "n/a"}</p>
                                                                            <p><span className="font-medium text-foreground">Date formats:</span> {d.selectedPresetConfig?.date_formats?.join(", ") || "n/a"}</p>
                                                                            <p><span className="font-medium text-foreground">Max text length:</span> {d.selectedPresetConfig?.hygiene?.max_text_length ?? 255}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            <div className="flex justify-between gap-2 pt-2 border-t border-border/50">
                                                <Button variant="outline" size="sm" onClick={d.goToPreviousStep}>← Back</Button>
                                                <Button size="sm" onClick={d.goToNextStep}>Next: Rules →</Button>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* ── 4. Rule Configuration ── */}
                                    <Collapsible open={d.currentAdvancedStep === "rules"} onOpenChange={(o) => { if (o) d.setCurrentAdvancedStep("rules") }}>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                                            {d.currentAdvancedStep === "rules" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <Badge className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center text-xs p-0 rounded-full">4</Badge>
                                            <span className="text-sm font-medium">Rules</span>
                                            {Object.keys(d.columnRules).length > 0 ? (
                                                <div className="ml-auto flex items-center gap-1">
                                                    <Badge variant="outline" className="text-[10px]">Auto: {d.ruleStats.totalAuto}</Badge>
                                                    {d.ruleStats.totalHuman > 0 && <Badge variant="outline" className="text-[10px]">Human: {d.ruleStats.totalHuman}</Badge>}
                                                    {d.ruleStats.totalCross > 0 && <Badge variant="outline" className="text-[10px]">Cross: {d.ruleStats.totalCrossEnabled}/{d.ruleStats.totalCross}</Badge>}
                                                    <Badge variant="default" className="text-[10px]">Selected: {d.ruleStats.totalSelected}</Badge>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="ml-auto text-[10px]">
                                                    {d.globalRules.filter(r => r.selected).length}/{d.globalRules.length} active
                                                </Badge>
                                            )}
                                            {d.currentStepIndex > 3 && (
                                                <Badge variant="outline" className="text-[10px] bg-green-500/20 text-green-700">✓</Badge>
                                            )}
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2 ml-2 space-y-2">
                                            {d.rulesLoading ? (
                                                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Deriving rules from profiling data...
                                                </div>
                                            ) : Object.keys(d.columnRules).length > 0 ? (
                                                /* ── Per-column rules (like file explorer) ── */
                                                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                                                    <p className="text-xs text-muted-foreground mb-1">Configure which rules to apply during DQ processing.</p>

                                                    {/* Cross-field rules */}
                                                    {d.crossFieldRules.length > 0 && (
                                                        <div className="border border-muted rounded-md p-3 mb-2">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="font-medium text-sm">Cross-column Rules</h4>
                                                                <Badge variant="outline" className="text-xs">{d.ruleStats.totalCrossEnabled}/{d.ruleStats.totalCross} enabled</Badge>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {d.crossFieldRules.map(rule => (
                                                                    <div key={rule.rule_id + rule.cols.join(".")} className="p-2 rounded border border-muted/60 bg-muted/20">
                                                                        <div className="flex items-start gap-2">
                                                                            <Checkbox checked={rule.enabled} onCheckedChange={() => d.toggleCrossFieldRule(rule.rule_id, rule.cols)} />
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-sm font-medium">{rule.rule_id}</span>
                                                                                    {rule.relationship && <Badge variant="secondary" className="text-[10px]">{rule.relationship}</Badge>}
                                                                                    {rule.confidence !== undefined && (
                                                                                        <Badge variant="outline" className="text-[10px]">{Math.round((rule.confidence || 0) * 100)}%</Badge>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-xs text-muted-foreground mt-1">{rule.condition || "No condition"}</p>
                                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                                    {rule.cols.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Column Rules */}
                                                    <h4 className="font-medium text-sm">Column Rules</h4>
                                                    {d.selectedColumns.map(col => {
                                                        const rules = d.columnRules[col] || []
                                                        const autoCount = rules.filter(r => r.category === "auto").length
                                                        const humanCount = rules.filter(r => r.category === "human").length
                                                        const selectedCount = rules.filter(r => r.selected).length
                                                        const isExpanded = d.expandedRuleColumns.includes(col)
                                                        const profile = d.columnProfiles[col]

                                                        return (
                                                            <Collapsible key={col} open={isExpanded} onOpenChange={() => d.toggleRuleColumnExpand(col)}>
                                                                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-md border border-muted hover:bg-muted/30">
                                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                    <span className="font-medium text-sm">{col}</span>
                                                                    <span className="text-xs text-muted-foreground ml-1">
                                                                        type | {profile?.type_guess || "string"}
                                                                    </span>
                                                                    <div className="ml-auto flex items-center gap-1">
                                                                        <Badge variant="outline" className="text-[10px]">A:{autoCount}</Badge>
                                                                        {humanCount > 0 && <Badge variant="outline" className="text-[10px]">H:{humanCount}</Badge>}
                                                                        <Badge variant="default" className="text-[10px]">S:{selectedCount}</Badge>
                                                                    </div>
                                                                </CollapsibleTrigger>
                                                                <CollapsibleContent className="mt-2 ml-6 space-y-2">
                                                                    {rules.length === 0 ? (
                                                                        <p className="text-xs text-muted-foreground">No suggested rules for this column.</p>
                                                                    ) : (
                                                                        <>
                                                                            {rules.filter(r => r.category === "auto").length > 0 && (
                                                                                <div>
                                                                                    <p className="text-xs text-muted-foreground mb-1">Auto Rules (recommended)</p>
                                                                                    <div className="space-y-1">
                                                                                        {rules.filter(r => r.category === "auto").map(rule => (
                                                                                            <div
                                                                                                key={rule.rule_id}
                                                                                                onClick={() => d.toggleColumnRule(col, rule.rule_id)}
                                                                                                className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer"
                                                                                            >
                                                                                                <Checkbox checked={rule.selected} />
                                                                                                <span className="text-sm">
                                                                                                    {rule.rule_name}
                                                                                                    {rule.source && <span className="ml-1 text-[10px] text-muted-foreground">({rule.source})</span>}
                                                                                                </span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {rules.filter(r => r.category === "human").length > 0 && (
                                                                                <div>
                                                                                    <p className="text-xs text-muted-foreground mb-1">Human Rules (optional)</p>
                                                                                    <div className="space-y-1">
                                                                                        {rules.filter(r => r.category === "human").map(rule => (
                                                                                            <div
                                                                                                key={rule.rule_id}
                                                                                                onClick={() => d.toggleColumnRule(col, rule.rule_id)}
                                                                                                className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer"
                                                                                            >
                                                                                                <Checkbox checked={rule.selected} />
                                                                                                <span className="text-sm">{rule.rule_name}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </CollapsibleContent>
                                                            </Collapsible>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                /* ── Fallback: legacy flat rules (no profiling data) ── */
                                                <div className="space-y-2 max-h-[25vh] overflow-y-auto">
                                                    <p className="text-xs text-muted-foreground mb-1">Toggle rules to apply during DQ processing</p>
                                                    {d.globalRules.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground p-3 border rounded-md">
                                                            No rules available. Run profiling first to get per-column rules.
                                                        </p>
                                                    ) : d.globalRules.map(rule => (
                                                        <div key={rule.rule_id} onClick={() => d.toggleRule(rule.rule_id)} className={cn(
                                                            "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                                                            rule.selected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30"
                                                        )}>
                                                            <Checkbox checked={rule.selected} className="mt-0.5" />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium">{rule.rule_name}</span>
                                                                {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex justify-between gap-2 pt-2 border-t border-border/50">
                                                <Button variant="outline" size="sm" onClick={d.goToPreviousStep}>← Back</Button>
                                                <Button size="sm" onClick={d.goToNextStep}>Next: Review →</Button>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* ── 5. Process / Create Job ── */}
                                    <Collapsible open={d.currentAdvancedStep === "process"} onOpenChange={(o) => { if (o) d.setCurrentAdvancedStep("process") }}>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed border-primary/50 hover:bg-primary/5 transition-colors">
                                            {d.currentAdvancedStep === "process" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <Badge className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center text-xs p-0 rounded-full">5</Badge>
                                            <span className="text-sm font-medium">Review & Create Job</span>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2 ml-2 space-y-3">
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground">Configuration Summary:</p>
                                                <div className="text-xs space-y-1 p-3 rounded border border-border/50 bg-muted/20">
                                                    <p><span className="font-medium">Columns:</span> {d.selectedColumns.length} selected</p>
                                                    <p><span className="font-medium">Preset:</span> {d.selectedPresetId ? d.presets.find(p => p.preset_id === d.selectedPresetId)?.preset_name : "Default"}</p>
                                                    <p><span className="font-medium">Rules:</span> {Object.keys(d.columnRules).length > 0 ? `${d.ruleStats.totalSelected} selected across ${Object.keys(d.columnRules).length} columns` : `${d.globalRules.filter(r => r.selected).length} active`}</p>
                                                </div>
                                                <p className="text-xs text-muted-foreground text-center mt-2">All configurations are complete. Click "Create Job" below to finalize.</p>
                                            </div>
                                            <div className="flex justify-start pt-2 border-t border-border/50">
                                                <Button variant="outline" size="sm" onClick={d.goToPreviousStep}>← Back</Button>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </div>
                            ) : null}
                        </CollapsibleContent>
                    </Collapsible>
                </div>

                <DialogFooter className="pt-2">
                    <Button variant="outline" onClick={onCancel} disabled={d.saving}>Cancel</Button>
                    <Button onClick={d.handleSubmit} disabled={d.saving || !d.name.trim()}>
                        {d.saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                        {d.isEdit ? "Update Job" : "Create Job"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* ─── New Preset Dialog ─── */}
        <Dialog open={d.showNewPresetDialog} onOpenChange={(open) => {
            d.setShowNewPresetDialog(open)
            if (!open) { d.setUploadedConfig(null); d.setNewPresetName("") }
        }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create New Preset</DialogTitle>
                    <DialogDescription>Define DQ settings to reuse across jobs and workflows.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Preset Name</Label>
                        <Input
                            placeholder="e.g., Automobile DQ Settings"
                            value={d.newPresetName}
                            onChange={(e) => d.setNewPresetName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Config (JSON/CSV)</Label>
                            <Button type="button" variant="outline" size="sm" onClick={() => d.presetFileInputRef.current?.click()} className="gap-1.5">
                                <Upload className="w-3.5 h-3.5" />Upload
                            </Button>
                        </div>
                        <Textarea
                            value={d.uploadedConfig ? JSON.stringify(d.uploadedConfig, null, 2) : ""}
                            onChange={(e) => {
                                try { d.setUploadedConfig(JSON.parse(e.target.value)) } catch { /* allow invalid JSON while typing */ }
                            }}
                            placeholder="Upload a JSON/CSV file or paste config here..."
                            className="min-h-[180px] font-mono text-xs"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { d.setShowNewPresetDialog(false); d.setUploadedConfig(null); d.setNewPresetName("") }}>
                        Cancel
                    </Button>
                    <Button onClick={d.handleCreatePreset} disabled={!d.newPresetName.trim()}>
                        Create Preset
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
    )
}
