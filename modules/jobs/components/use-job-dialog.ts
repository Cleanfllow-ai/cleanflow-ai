'use client'

import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import { fileManagementAPI } from '@/modules/files'
import {
    jobsAPI, type Job, type JobFrequency, type CreateJobPayload, type UpdateJobPayload,
    frequencyToBackend, frequencyFromBackend
} from '@/modules/jobs/api/jobs-api'
import {
    type AdvancedStep,
    type RuleState,
    type SettingsPreset,
    type ColumnProfile,
    type ColumnRuleState,
    type CrossFieldRuleState,
    ADVANCED_STEPS,
    DEFAULT_GLOBAL_RULES,
    ENTITY_COLUMNS,
    SOURCE_ERP_OPTIONS,
    normalizeErpForUi,
    normalizeErpForApi,
} from './job-dialog-constants'
import { deriveRulesV2, CORE_TYPES, TYPE_ALIASES } from '@/shared/lib/type-catalog'
import { getRuleLabel } from '@/shared/lib/dq-rules'
import { orgAPI, type OrgMembership } from '@/modules/auth/api/org-api'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UseJobDialogProps {
    open: boolean
    job?: Job | null
    onSuccess: () => void
}

const DEFAULT_SETTINGS_PRESET: SettingsPreset = {
    preset_id: "default_dq_rules",
    preset_name: "Default Data Quality Rules",
    is_default: true,
    config: {
        ruleset_version: "dq34_v1",
        policies: {
            strictness: "balanced",
            auto_fix: true,
            unknown: "safe_cleanup_only",
        },
        rules_enabled: {
            R1: true, R2: true, R3: true, R4: true, R5: true, R6: true, R7: true, R8: true, R9: true,
            R10: true, R11: true, R12: true, R13: true, R14: true, R15: true, R16: true, R17: true,
            R18: true, R19: true, R20: false, R21: true, R22: true, R23: true, R24: true, R25: true,
            R26: true, R27: true, R28: true, R29: true, R30: true, R31: true, R32: true, R33: true, R34: true,
        },
        required_columns: [],
        lookups: {
            placeholders: ["", "na", "n/a", "null", "none", "-", "--", "?", "NA", "N/A", "NULL", "NONE"],
            status_values: [
                "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PENDING", "PAID", "CANCELLED",
                "CLOSED", "OPEN", "POSTED", "REVERSED", "ACTIVE", "INACTIVE", "COMPLETED",
                "YES", "NO", "Y", "N", "TRUE", "FALSE", "1", "0",
            ],
        },
        currency_values: [
            "USD", "INR", "EUR", "GBP", "SGD", "AED", "AUD", "CAD",
            "CHF", "CNY", "JPY", "KWD", "SAR", "QAR", "BHD", "OMR",
        ],
        uom_values: [
            "EA", "PCS", "PC", "KG", "G", "LTR", "ML", "M", "CM", "MM",
            "FT", "IN", "YD", "SQM", "SQFT", "CBM", "CFT", "HR", "MIN", "SEC",
            "DAY", "WK", "MON", "YR", "BOX", "CTN", "PAL", "SET", "KIT", "PR",
            "DOZ", "GR", "UNIT", "TON", "MT",
        ],
        date_formats: ["ISO", "DMY", "MDY"],
        hygiene: {
            max_text_length: 255,
        },
    },
}

const parseCsvRows = (content: string): Record<string, string>[] => {
    const lines = content.trim().split('\n').filter(Boolean)
    if (lines.length < 2) {
        throw new Error("CSV must have header row and at least one data row")
    }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((header, idx) => {
            row[header] = values[idx] || ''
        })
        return row
    })
}

const normalizePresetConfig = (rawConfig: Record<string, any> | null | undefined): Record<string, any> => {
    const config = rawConfig || {}

    // Support both legacy explorer format (policy/enums/rules) and current settings format.
    const isLegacyRulesFormat = Boolean(config.enums || config.rules || config.policy)
    if (isLegacyRulesFormat) {
        return {
            policies: {
                strictness: config.policies?.strictness || "balanced",
                auto_fix: config.policies?.auto_fix ?? true,
                unknown: config.policies?.unknown || "safe_cleanup_only",
            },
            lookups: {
                placeholders: config.required_fields?.placeholders_treated_as_missing || [],
                status_values: config.enums?.status?.allowed || [],
            },
            currency_values: config.enums?.currency?.allowed || [],
            uom_values: config.uom_values || [],
            date_formats: config.policy?.date_formats || config.date_formats || [],
            hygiene: {
                max_text_length: Number(config.policy?.max_free_text_length || 255),
            },
        }
    }

    return {
        policies: {
            strictness: config.policies?.strictness || "balanced",
            auto_fix: config.policies?.auto_fix ?? true,
            unknown: config.policies?.unknown || "safe_cleanup_only",
        },
        lookups: {
            placeholders: config.lookups?.placeholders || [],
            status_values: config.lookups?.status_values || [],
        },
        currency_values: config.currency_values || [],
        uom_values: config.uom_values || [],
        date_formats: config.date_formats || [],
        hygiene: {
            max_text_length: Number(config.hygiene?.max_text_length || 255),
        },
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJobDialog({ open, job, onSuccess }: UseJobDialogProps) {
    const isEdit = !!job
    const { toast } = useToast()

    // Core fields
    const [name, setName] = useState("")
    const [source, setSource] = useState<string>("quickbooks")
    const [destination, setDestination] = useState<string>("quickbooks")
    const [frequency, setFrequency] = useState<JobFrequency>("1hr")
    const [cronExpression, setCronExpression] = useState("")
    const [entity, setEntity] = useState("invoices")

    // Advanced — Columns
    const [fetchingCols, setFetchingCols] = useState(false)
    const [allColumns, setAllColumns] = useState<string[]>([])
    const [selectedColumns, setSelectedColumns] = useState<string[]>([])
    const [colSearch, setColSearch] = useState("")

    // Advanced — Preset
    const [presets, setPresets] = useState<SettingsPreset[]>([])
    const [presetsLoading, setPresetsLoading] = useState(false)
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const [selectedPresetConfig, setSelectedPresetConfig] = useState<Record<string, any> | null>(null)
    const [pendingPresetName, setPendingPresetName] = useState("")

    // Advanced — Custom Rules (legacy flat list)
    const [globalRules, setGlobalRules] = useState<RuleState[]>(DEFAULT_GLOBAL_RULES.map(r => ({ ...r })))
    const [rulesLoading, setRulesLoading] = useState(false)
    const [rulesLoadedFromApi, setRulesLoadedFromApi] = useState(false)

    // Advanced — Per-column Rules (derived from profiling)
    const [columnRules, setColumnRules] = useState<Record<string, ColumnRuleState[]>>({})
    const [crossFieldRules, setCrossFieldRules] = useState<CrossFieldRuleState[]>([])
    const [expandedRuleColumns, setExpandedRuleColumns] = useState<string[]>([])
    const [columnRulesSeeded, setColumnRulesSeeded] = useState(false)

    // Advanced Wizard Mode
    const [currentAdvancedStep, setCurrentAdvancedStep] = useState<AdvancedStep>("import")
    const [advancedMode, setAdvancedMode] = useState(false)
    const [dataImported, setDataImported] = useState(false)
    const [importingData, setImportingData] = useState(false)

    // Advanced — Profiling
    const [profilingLoading, setProfilingLoading] = useState(false)
    const [columnProfiles, setColumnProfiles] = useState<Record<string, ColumnProfile>>({})

    // Responsible user
    const [responsibleUserId, setResponsibleUserId] = useState("")
    const [orgMembers, setOrgMembers] = useState<OrgMembership[]>([])
    const [membersLoading, setMembersLoading] = useState(false)

    // UI state
    const [saving, setSaving] = useState(false)
    const [advancedOpen, setAdvancedOpen] = useState(false)

    // Helper: current step index
    const currentStepIndex = ADVANCED_STEPS.indexOf(currentAdvancedStep)

    // ─── Filtered columns (for search) ────────────────────────────────────────
    const filteredCols = allColumns.filter(c => c.toLowerCase().includes(colSearch.toLowerCase()))

    // ─── Populate / Reset ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!open) return

        // Fetch org members for responsible user selector
        setMembersLoading(true)
        orgAPI.listMembers().then(res => {
            setOrgMembers(res.members || [])
        }).catch(() => {}).finally(() => setMembersLoading(false))

        if (job) {
            setName(job.name)
            setSource(normalizeErpForUi(job.source))
            setDestination(normalizeErpForUi(job.destination))
            const freq = frequencyFromBackend(job.frequency_type, job.frequency_value)
            setFrequency(freq.frequency)
            setCronExpression(freq.cronExpression || job.cron_expression || "")
            setEntity(job.entities?.[0] || "invoices")
            setSelectedColumns(job.dq_config?.columns || [])
            setSelectedPresetId(job.dq_config?.preset_id || null)
            setGlobalRules(job.dq_config?.rules?.length
                ? job.dq_config.rules
                : DEFAULT_GLOBAL_RULES.map(r => ({ ...r }))
            )
            setAdvancedOpen(job.dq_config?.mode === "custom")
            setResponsibleUserId(job.responsible_user_id || "")
        } else {
            setName("")
            setSource("quickbooks")
            setDestination("quickbooks")
            setFrequency("1hr")
            setCronExpression("")
            setEntity("invoices")
            setSelectedColumns([])
            setAllColumns([])
            setSelectedPresetId(null)
            setSelectedPresetConfig(normalizePresetConfig(DEFAULT_SETTINGS_PRESET.config))
            setPendingPresetName("")
            setGlobalRules(DEFAULT_GLOBAL_RULES.map(r => ({ ...r })))
            setRulesLoadedFromApi(false)
            setAdvancedOpen(false)
            setAdvancedMode(false)
            setDataImported(false)
            setCurrentAdvancedStep("import")
            setColumnProfiles({})
            setPreviewUploadId("")
            setColumnRules({})
            setCrossFieldRules([])
            setExpandedRuleColumns([])
            setColumnRulesSeeded(false)
            setResponsibleUserId("")
        }
    }, [job, open])

    // ─── Fetch Columns ────────────────────────────────────────────────────────

    const handleFetchColumns = async () => {
        setFetchingCols(true)
        try {
            const cols = ENTITY_COLUMNS[entity] || ["Column1", "Column2", "Column3"]
            setAllColumns(cols)
            setSelectedColumns(cols)
            toast({ title: "Columns Loaded", description: `${cols.length} columns available for ${entity}` })
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to fetch columns", variant: "destructive" })
        } finally {
            setFetchingCols(false)
        }
    }

    // ─── Import Data from Source (Advanced Mode) ──────────────────────────────

    // Track the upload_id from import preview for profiling
    const [previewUploadId, setPreviewUploadId] = useState("")

    const handleImportDataFromSource = async () => {
        setImportingData(true)
        try {
            const apiSource = normalizeErpForApi(source)
            const result = await jobsAPI.importPreview(apiSource, entity)
            const cols = result.columns?.length > 0
                ? result.columns
                : (ENTITY_COLUMNS[entity] || ["Column1", "Column2", "Column3"])
            setAllColumns(cols)
            setSelectedColumns(cols)
            setPreviewUploadId(result.upload_id || "")
            setDataImported(true)
            setCurrentAdvancedStep("columns")
            toast({
                title: "Data Imported",
                description: `Imported ${result.records_imported || 0} sample records from ${SOURCE_ERP_OPTIONS.find(e => e.value === source)?.label}. ${cols.length} columns discovered.`
            })
        } catch (err: any) {
            // Fallback to static columns if API not available
            const cols = ENTITY_COLUMNS[entity] || ["Column1", "Column2", "Column3"]
            setAllColumns(cols)
            setSelectedColumns(cols)
            setDataImported(true)
            setCurrentAdvancedStep("columns")
            toast({
                title: "Data Imported (Fallback)",
                description: `Using default columns for ${entity}. ${err?.message || ""}`,
            })
        } finally {
            setImportingData(false)
        }
    }

    // ─── Fetch Profiling Data ─────────────────────────────────────────────────

    const handleFetchProfiling = async () => {
        if (selectedColumns.length === 0) {
            toast({ title: "Select columns first", description: "Please select at least one column", variant: "destructive" })
            return
        }
        if (!previewUploadId) {
            toast({
                title: "No import data",
                description: "Please import data from source first (step 1)",
                variant: "destructive"
            })
            return
        }
        setProfilingLoading(true)
        try {
            console.log('[Profiling] Calling API with upload_id:', previewUploadId, 'columns:', selectedColumns.length)
            const result = await jobsAPI.fetchProfiling(previewUploadId, selectedColumns)
            console.log('[Profiling] API response:', result)

            // Check for backend error response
            const apiError =
                (result as unknown as { error?: string; message?: string })?.error ||
                (result as unknown as { error?: string; message?: string })?.message
            if (apiError) {
                console.error('[Profiling] Backend returned error:', apiError)
                toast({
                    title: "Profiling Failed",
                    description: apiError,
                    variant: "destructive"
                })
                return
            }

            const rawProfiles = (result.profiles || {}) as Record<string, Partial<ColumnProfile>>
            const profiles: Record<string, ColumnProfile> = Object.fromEntries(
                Object.entries(rawProfiles).map(([col, profile]) => [
                    col,
                    { column_name: col, ...(profile || {}) } as ColumnProfile,
                ])
            )

            if (Object.keys(profiles).length === 0) {
                console.warn('[Profiling] No profiles returned')
                toast({
                    title: "No profiling data",
                    description: "Profiling returned no results. Check CloudWatch logs for details.",
                    variant: "destructive"
                })
            } else {
                console.log('[Profiling] Success:', Object.keys(profiles).length, 'column profiles')
                setColumnProfiles(profiles)
                // Seed cross-field rules if returned
                if ((result as any).cross_field_rules?.length) {
                    seedCrossFieldRules((result as any).cross_field_rules)
                }
                // Reset column rules seeded flag so they get re-derived with new profiling data
                setColumnRulesSeeded(false)
                // Don't auto-advance - let users review the profiling results
                toast({
                    title: "Profiling Complete",
                    description: `Analyzed ${Object.keys(profiles).length} columns. Review results below.`
                })
            }
        } catch (err: any) {
            console.error('[Profiling] Exception:', err)
            toast({
                title: "Profiling Failed",
                description: err?.message || "Failed to profile columns. Check CloudWatch logs.",
                variant: "destructive"
            })
        } finally {
            setProfilingLoading(false)
        }
    }

    // ─── Step Navigation ──────────────────────────────────────────────────────

    const goToNextStep = () => {
        const nextIndex = currentStepIndex + 1
        if (nextIndex < ADVANCED_STEPS.length) {
            const nextStep = ADVANCED_STEPS[nextIndex]

            if (currentAdvancedStep === "columns" && selectedColumns.length === 0) {
                toast({ title: "Select columns", description: "Please select at least one column", variant: "destructive" })
                return
            }
            if (currentAdvancedStep === "profiling" && Object.keys(columnProfiles).length === 0) {
                toast({ title: "Run profiling first", description: "Click the Profiling section to analyze columns", variant: "destructive" })
                return
            }

            setCurrentAdvancedStep(nextStep)
        }
    }

    const goToPreviousStep = () => {
        const prevIndex = currentStepIndex - 1
        if (prevIndex >= 0) {
            setCurrentAdvancedStep(ADVANCED_STEPS[prevIndex])
        }
    }

    const toggleColumn = (col: string) => {
        setSelectedColumns(prev =>
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
        )
    }

    // ─── Load Presets ─────────────────────────────────────────────────────────

    const applyPresetConfigToEditor = (config: Record<string, any>) => {
        const normalized = normalizePresetConfig(config)
        setSelectedPresetConfig(normalized)
        setEditCurrencyValues((normalized.currency_values || []).join(", "))
        setEditUomValues((normalized.uom_values || []).join(", "))
        setEditDateFormats((normalized.date_formats || []).join(", "))
        setEditStrictness(normalized.policies?.strictness || "balanced")
        setEditAutoFix(normalized.policies?.auto_fix ?? true)
        setEditUnknownBehavior(normalized.policies?.unknown || "safe_cleanup_only")
        setEditPlaceholders((normalized.lookups?.placeholders || []).join(", "))
        setEditStatusEnums((normalized.lookups?.status_values || []).join(", "))
        setEditMaxTextLen(normalized.hygiene?.max_text_length ?? 255)
    }

    useEffect(() => {
        if (currentAdvancedStep !== "settings" || !dataImported) return
        let cancelled = false

        const loadPresets = async () => {
            setPresetsLoading(true)
            try {
                const res = await fileManagementAPI.getSettingsPresets()
                const serverPresets = (res?.presets || []) as SettingsPreset[]
                const hasDefault = serverPresets.some(p => p.is_default)
                const finalPresets = serverPresets.length === 0
                    ? [DEFAULT_SETTINGS_PRESET]
                    : hasDefault
                        ? serverPresets
                        : [...serverPresets, DEFAULT_SETTINGS_PRESET]

                if (cancelled) return
                setPresets(finalPresets)

                if (selectedPresetId) {
                    await handleSelectPreset(selectedPresetId, finalPresets)
                } else {
                    applyPresetConfigToEditor(DEFAULT_SETTINGS_PRESET.config || {})
                }
            } catch (err) {
                console.error('Failed to load presets:', err)
                if (cancelled) return
                setPresets([DEFAULT_SETTINGS_PRESET])
                if (!selectedPresetId) {
                    applyPresetConfigToEditor(DEFAULT_SETTINGS_PRESET.config || {})
                }
            } finally {
                if (!cancelled) setPresetsLoading(false)
            }
        }

        loadPresets()
        return () => { cancelled = true }
    }, [currentAdvancedStep, dataImported])

    const handleSelectPreset = async (presetId: string, presetList?: SettingsPreset[]) => {
        if (presetId === "none") {
            setSelectedPresetId(null)
            applyPresetConfigToEditor(DEFAULT_SETTINGS_PRESET.config || {})
            return
        }
        setSelectedPresetId(presetId)
        setPendingPresetName("")

        const list = presetList || presets
        const localPreset = list.find(p => p.preset_id === presetId)
        if (localPreset?.config) {
            applyPresetConfigToEditor(localPreset.config)
            if (presetId === DEFAULT_SETTINGS_PRESET.preset_id) return
        }

        // Fetch full preset details using fileManagementAPI
        try {
            const preset = await fileManagementAPI.getSettingsPreset(presetId)
            if (preset?.config) applyPresetConfigToEditor(preset.config)
        } catch (err) {
            console.error('Failed to load preset details:', err)
            // Keep local fallback already applied above.
        }
    }

    // ─── Preset Editing ───────────────────────────────────────────────────────
    const [presetEditMode, setPresetEditMode] = useState(false)
    const [editCurrencyValues, setEditCurrencyValues] = useState("")
    const [editUomValues, setEditUomValues] = useState("")
    const [editDateFormats, setEditDateFormats] = useState("")
    const [editStrictness, setEditStrictness] = useState("balanced")
    const [editAutoFix, setEditAutoFix] = useState(true)
    const [editUnknownBehavior, setEditUnknownBehavior] = useState("safe_cleanup_only")
    const [editPlaceholders, setEditPlaceholders] = useState("")
    const [editStatusEnums, setEditStatusEnums] = useState("")
    const [editMaxTextLen, setEditMaxTextLen] = useState<number | string>(255)
    const [activePresetTab, setActivePresetTab] = useState("policies")
    const presetFileInputRef = useRef<HTMLInputElement>(null)

    // ─── New Preset Dialog ───────────────────────────────────────────────────
    const [showNewPresetDialog, setShowNewPresetDialog] = useState(false)
    const [newPresetName, setNewPresetName] = useState("")
    const [uploadedConfig, setUploadedConfig] = useState<any>(null)

    const handleEditPreset = () => {
        setPresetEditMode(true)
        setActivePresetTab("policies")
        if (selectedPresetConfig) {
            setEditCurrencyValues((selectedPresetConfig.currency_values || []).join(", "))
            setEditUomValues((selectedPresetConfig.uom_values || []).join(", "))
            setEditDateFormats((selectedPresetConfig.date_formats || []).join(", "))
            setEditStrictness(selectedPresetConfig.policies?.strictness || "balanced")
            setEditAutoFix(selectedPresetConfig.policies?.auto_fix ?? true)
            setEditUnknownBehavior(selectedPresetConfig.policies?.unknown || "safe_cleanup_only")
            setEditPlaceholders((selectedPresetConfig.lookups?.placeholders || []).join(", "))
            setEditStatusEnums((selectedPresetConfig.lookups?.status_values || []).join(", "))
            setEditMaxTextLen(selectedPresetConfig.hygiene?.max_text_length ?? 255)
        }
    }

    const handleCancelPresetEdit = () => {
        setPresetEditMode(false)
    }

    const buildConfigFromState = (): Record<string, any> => ({
        policies: {
            strictness: editStrictness,
            auto_fix: editAutoFix,
            unknown: editUnknownBehavior,
        },
        lookups: {
            placeholders: editPlaceholders.split(",").map(s => s.trim()).filter(Boolean),
            status_values: editStatusEnums.split(",").map(s => s.trim()).filter(Boolean),
        },
        currency_values: editCurrencyValues.split(",").map(s => s.trim()).filter(Boolean),
        uom_values: editUomValues.split(",").map(s => s.trim()).filter(Boolean),
        date_formats: editDateFormats.split(",").map(s => s.trim()).filter(Boolean),
        hygiene: {
            max_text_length: Number(editMaxTextLen) || 255,
        },
    })

    const handleSavePresetEdit = async () => {
        const newConfig = buildConfigFromState()
        try {
            if (selectedPresetId && selectedPresetId !== DEFAULT_SETTINGS_PRESET.preset_id) {
                const presetName = presets.find(p => p.preset_id === selectedPresetId)?.preset_name || "Updated Preset"
                await fileManagementAPI.updateSettingsPreset(selectedPresetId, {
                    preset_name: presetName,
                    config: newConfig,
                })
                toast({ title: "Preset updated", description: `${presetName} saved successfully.` })
            }

            const res = await fileManagementAPI.getSettingsPresets()
            const list = (res?.presets || []) as SettingsPreset[]
            const hasDefault = list.some(p => p.is_default)
            const finalList = list.length === 0
                ? [DEFAULT_SETTINGS_PRESET]
                : hasDefault
                    ? list
                    : [...list, DEFAULT_SETTINGS_PRESET]
            setPresets(finalList)

            if (selectedPresetId) {
                await handleSelectPreset(selectedPresetId, finalList)
            } else {
                applyPresetConfigToEditor(newConfig)
            }
            setPresetEditMode(false)
        } catch (err: any) {
            toast({ title: "Save failed", description: err?.message || "Could not save preset.", variant: "destructive" })
        }
    }

    const handleNewPreset = () => {
        setNewPresetName("")
        setUploadedConfig(null)
        setShowNewPresetDialog(true)
    }

    const handleCreatePreset = async () => {
        if (!newPresetName.trim()) {
            toast({ title: "Name required", description: "Please enter a preset name.", variant: "destructive" })
            return
        }
        try {
            const config = uploadedConfig || buildConfigFromState()
            const created = await fileManagementAPI.createSettingsPreset({
                preset_name: newPresetName.trim(),
                config,
                is_default: false,
            })
            const res = await fileManagementAPI.getSettingsPresets()
            const list = (res?.presets || []) as SettingsPreset[]
            const hasDefault = list.some(p => p.is_default)
            const finalList = list.length === 0
                ? [DEFAULT_SETTINGS_PRESET]
                : hasDefault
                    ? list
                    : [...list, DEFAULT_SETTINGS_PRESET]
            setPresets(finalList)
            if (created?.preset_id) {
                await handleSelectPreset(created.preset_id, finalList)
            }
            setShowNewPresetDialog(false)
            setNewPresetName("")
            setUploadedConfig(null)
            toast({ title: "Preset created", description: `${newPresetName.trim()} created successfully.` })
        } catch (err: any) {
            toast({ title: "Create failed", description: err?.message || "Could not create preset.", variant: "destructive" })
        }
    }

    const handleDeletePreset = async () => {
        if (!selectedPresetId || selectedPresetId === DEFAULT_SETTINGS_PRESET.preset_id) return
        try {
            await fileManagementAPI.deleteSettingsPreset(selectedPresetId)
            const res = await fileManagementAPI.getSettingsPresets()
            const list = (res?.presets || []) as SettingsPreset[]
            const hasDefault = list.some(p => p.is_default)
            const finalList = list.length === 0
                ? [DEFAULT_SETTINGS_PRESET]
                : hasDefault
                    ? list
                    : [...list, DEFAULT_SETTINGS_PRESET]
            setPresets(finalList)
            setSelectedPresetId(null)
            applyPresetConfigToEditor(DEFAULT_SETTINGS_PRESET.config || {})
            toast({ title: "Preset deleted" })
        } catch (err: any) {
            toast({ title: "Delete failed", description: err?.message || "Could not delete preset.", variant: "destructive" })
        }
    }

    const handleExportPreset = () => {
        if (!selectedPresetConfig) return
        const preset = presets.find(p => p.preset_id === selectedPresetId)
        const exportData = {
            preset_name: preset?.preset_name || "Custom Preset",
            config: selectedPresetConfig,
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${preset?.preset_name || "preset"}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: "Preset exported", description: `Downloaded ${preset?.preset_name}.json` })
    }

    const handlePresetFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string
                let rawConfig: Record<string, any> = {}

                if (file.name.toLowerCase().endsWith(".json")) {
                    const parsed = JSON.parse(content)
                    rawConfig = parsed?.config || parsed
                } else if (file.name.endsWith(".csv")) {
                    const rows = parseCsvRows(content)
                    rawConfig = { imported_data: rows, source: "csv_upload", headers: Object.keys(rows[0] || {}) }
                } else {
                    throw new Error("Please upload a .json or .csv file")
                }

                setUploadedConfig(rawConfig)
                const defaultName = file.name.replace(/\.(json|csv)$/i, "")
                setNewPresetName(defaultName)
                setShowNewPresetDialog(true)
            } catch (err: any) {
                toast({ title: "Import failed", description: err?.message || "Invalid file format", variant: "destructive" })
            }
        }
        reader.readAsText(file)
        event.target.value = ""
    }

    // ─── Seed Column Rules from Profiling (like file explorer RulesStep) ────

    useEffect(() => {
        if (currentAdvancedStep !== "rules" || !dataImported || columnRulesSeeded) return
        if (selectedColumns.length === 0 || Object.keys(columnProfiles).length === 0) return

        setRulesLoading(true)

        // Derive per-column rules using the type catalog (same as file explorer)
        const derived: Record<string, ColumnRuleState[]> = {}
        selectedColumns.forEach(col => {
            const profile = columnProfiles[col]
            if (!profile) return

            const coreType = profile.type_guess || "string"
            const rawType = (CORE_TYPES as any)[coreType] || (TYPE_ALIASES as any)[coreType] ? coreType : "string"
            const keyType = (profile.key_type as "none" | "primary_key" | "unique") || "none"
            const nullable = profile.nullable_suggested !== undefined ? !!profile.nullable_suggested : true

            const result = deriveRulesV2(rawType, keyType, nullable)
            derived[col] = result.rules.map(id => ({
                rule_id: id,
                rule_name: getRuleLabel(id),
                category: "auto" as const,
                selected: true,
                column: col,
                source: result.ruleSources[id],
            }))

            // Also merge any rules that came from the profiling API (human-decision rules)
            if (profile.rules?.length) {
                profile.rules.forEach(r => {
                    if (!derived[col].some(dr => dr.rule_id === r.rule_id)) {
                        derived[col].push({
                            rule_id: r.rule_id,
                            rule_name: getRuleLabel(r.rule_id),
                            category: (r.decision === "human" ? "human" : "auto") as "auto" | "human",
                            selected: true,
                            column: col,
                            source: r.decision || "profiling",
                        })
                    }
                })
            }
        })

        setColumnRules(derived)
        setGlobalRules([]) // Clear legacy flat rules — column rules replace them
        setColumnRulesSeeded(true)
        setRulesLoading(false)
    }, [currentAdvancedStep, dataImported, columnRulesSeeded, selectedColumns, columnProfiles])

    // ─── Seed cross-field rules from profiling result ────────────────────────

    const seedCrossFieldRules = (crossRules: Array<{
        rule_id: string; cols: string[]; relationship?: string;
        condition?: string; confidence?: number; reasoning?: string;
    }>) => {
        setCrossFieldRules(crossRules.map(r => ({ ...r, enabled: true })))
    }

    // ─── Toggle Rules ─────────────────────────────────────────────────────────

    const toggleRule = (ruleId: string) => {
        setGlobalRules(prev =>
            prev.map(r => r.rule_id === ruleId ? { ...r, selected: !r.selected } : r)
        )
    }

    const toggleColumnRule = (column: string, ruleId: string) => {
        setColumnRules(prev => ({
            ...prev,
            [column]: (prev[column] || []).map(r =>
                r.rule_id === ruleId ? { ...r, selected: !r.selected } : r
            ),
        }))
    }

    const toggleRuleColumnExpand = (col: string) => {
        setExpandedRuleColumns(prev =>
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
        )
    }

    const toggleCrossFieldRule = (ruleId: string, cols: string[]) => {
        setCrossFieldRules(prev =>
            prev.map(r =>
                r.rule_id === ruleId && r.cols.join(".") === cols.join(".")
                    ? { ...r, enabled: !r.enabled }
                    : r
            )
        )
    }

    // ─── Rule Statistics ─────────────────────────────────────────────────────

    const allColumnRulesFlat = Object.values(columnRules).flat()
    const ruleStats = {
        totalAuto: allColumnRulesFlat.filter(r => r.category === "auto").length,
        totalHuman: allColumnRulesFlat.filter(r => r.category === "human").length,
        totalCustom: allColumnRulesFlat.filter(r => r.category === "custom").length,
        totalSelected: allColumnRulesFlat.filter(r => r.selected).length,
        totalCross: crossFieldRules.length,
        totalCrossEnabled: crossFieldRules.filter(r => r.enabled).length,
    }

    // ─── Submit ───────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast({ title: "Name required", description: "Please enter a job name", variant: "destructive" })
            return
        }
        if (frequency === "cron" && !cronExpression.trim()) {
            toast({ title: "Cron expression required", variant: "destructive" })
            return
        }

        setSaving(true)
        try {
            const hasCustomConfig = advancedOpen && (
                selectedColumns.length > 0 ||
                selectedPresetId ||
                globalRules.some(r => !r.selected)
            )

            const dq_config = hasCustomConfig
                ? {
                    mode: "custom" as const,
                    ...(selectedColumns.length > 0 && { columns: selectedColumns }),
                    ...(selectedPresetId && { preset_id: selectedPresetId }),
                    rules: globalRules,
                }
                : { mode: "default" as const }

            const freqBackend = frequencyToBackend(frequency, cronExpression.trim())

            const normalizedSource = normalizeErpForApi(source)
            const base = {
                name: name.trim(),
                source: normalizedSource,
                destination: normalizeErpForApi(destination),
                entities: [entity],
                ...freqBackend,
                dq_config,
                ...(responsibleUserId && { responsible_user_id: responsibleUserId }),
            }

            if (isEdit && job) {
                await jobsAPI.updateJob(job.job_id, base as UpdateJobPayload)
                toast({ title: "Job Updated", description: `${name} has been updated` })
            } else {
                await jobsAPI.createJob(base as CreateJobPayload)
                toast({ title: "Job Created", description: `${name} has been created and scheduled` })
            }
            onSuccess()
        } catch (err: any) {
            toast({
                title: isEdit ? "Update failed" : "Creation failed",
                description: err?.message || "Something went wrong",
                variant: "destructive"
            })
        } finally {
            setSaving(false)
        }
    }

    // ─── Advanced open handler ────────────────────────────────────────────────

    const handleAdvancedOpenChange = (nextOpen: boolean) => {
        if (nextOpen && !advancedMode) {
            setAdvancedMode(true)
        }
        setAdvancedOpen(nextOpen)
    }

    return {
        isEdit,
        // Core fields
        name, setName,
        source, setSource,
        destination, setDestination,
        frequency, setFrequency,
        cronExpression, setCronExpression,
        entity, setEntity,
        // Columns
        fetchingCols,
        allColumns,
        selectedColumns, setSelectedColumns,
        colSearch, setColSearch,
        filteredCols,
        toggleColumn,
        handleFetchColumns,
        // Presets
        presets,
        presetsLoading,
        selectedPresetId,
        selectedPresetConfig,
        handleSelectPreset,
        // Preset editing
        presetEditMode,
        editCurrencyValues, setEditCurrencyValues,
        editUomValues, setEditUomValues,
        editDateFormats, setEditDateFormats,
        editStrictness, setEditStrictness,
        editAutoFix, setEditAutoFix,
        editUnknownBehavior, setEditUnknownBehavior,
        editPlaceholders, setEditPlaceholders,
        editStatusEnums, setEditStatusEnums,
        editMaxTextLen, setEditMaxTextLen,
        activePresetTab, setActivePresetTab,
        presetFileInputRef,
        handleEditPreset,
        handleCancelPresetEdit,
        handleSavePresetEdit,
        handleNewPreset,
        handleCreatePreset,
        handleDeletePreset,
        handleExportPreset,
        handlePresetFileUpload,
        // New Preset Dialog
        showNewPresetDialog, setShowNewPresetDialog,
        newPresetName, setNewPresetName,
        uploadedConfig, setUploadedConfig,
        // Rules (legacy)
        globalRules,
        rulesLoading,
        toggleRule,
        // Per-column Rules
        columnRules,
        crossFieldRules,
        expandedRuleColumns,
        toggleColumnRule,
        toggleRuleColumnExpand,
        toggleCrossFieldRule,
        ruleStats,
        // Advanced wizard
        advancedOpen, handleAdvancedOpenChange,
        advancedMode,
        dataImported,
        importingData,
        handleImportDataFromSource,
        currentAdvancedStep, setCurrentAdvancedStep,
        currentStepIndex,
        goToNextStep,
        goToPreviousStep,
        // Profiling
        profilingLoading,
        columnProfiles,
        handleFetchProfiling,
        // Responsible user
        responsibleUserId, setResponsibleUserId,
        orgMembers, membersLoading,
        // Submit / UI
        saving,
        handleSubmit,
    }
}
