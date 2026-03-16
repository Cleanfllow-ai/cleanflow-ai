"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { CustomRuleDefinition, ColumnProfile } from "@/modules/files"
import { deriveRulesV2 } from "@/shared/lib/type-catalog"

// Wizard step type
export type WizardStep = "source" | "columns" | "profiling" | "settings" | "rules" | "process"

// Settings preset
export interface SettingsPreset {
    preset_id: string
    preset_name: string
    config: {
        currency_values?: string[]
        uom_values?: string[]
        date_formats?: string[]
        custom_patterns?: Record<string, string>
        required_columns?: string[]
        ruleset_version?: string
        policies?: {
            allow_autofix?: boolean
            strictness?: string
            unknown_column_behavior?: string
        }
        rules_enabled?: Record<string, boolean>
        required_fields?: {
            placeholders_treated_as_missing?: string[]
        }
        enum_sets?: Record<string, string[]>
        thresholds?: {
            text?: {
                max_len_default?: number
            }
        }
    }
    is_default?: boolean
}

// Rule with selection state
export interface RuleWithState {
    rule_id: string
    rule_name: string
    description?: string
    category: "auto" | "human" | "custom"
    selected: boolean
    column?: string
    severity?: "critical" | "warning" | "info"
    code?: string // For LLM-generated code rules
    source?: string
}

export interface CrossFieldRuleWithState {
    rule_id: string
    cols: string[]
    relationship?: string
    condition?: string
    predicate?: string
    tolerance?: number
    confidence?: number
    reasoning?: string
    coverage?: number
    pass_rate?: number
    failed_rows?: number[]
    enabled: boolean
}

// Wizard state
export interface WizardState {
    // Current step
    step: WizardStep
    mode: "new" | "existing"

    // File context
    uploadId: string
    fileName: string
    authToken: string // Add auth token to state

    // Step 1: Column Selection
    allColumns: string[]
    selectedColumns: string[]

    // Step 2: Profiling
    columnProfiles: Record<string, ColumnProfile>
    requiredColumns: string[]
    columnCoreTypes: Record<string, string>
    columnTypeAliases: Record<string, string | null>
    columnKeyTypes: Record<string, "none" | "primary_key" | "unique">
    columnNullable: Record<string, boolean>
    backendVersion?: string
    crossFieldRules: CrossFieldRuleWithState[]

    // Step 3: Settings
    selectedPreset: SettingsPreset | null
    presetOverrides: Record<string, any>

    // Step 4: Rules
    globalRules: RuleWithState[]
    columnRules: Record<string, RuleWithState[]>
    customRules: CustomRuleDefinition[]
    disabledRules: string[]

    // Step 5: Processing
    isProcessing: boolean
    processingError: string | null
}

// Session storage persistence
const STORAGE_PREFIX = "cleanflow_wizard_"
const EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

interface SavedWizardState {
    state: Omit<WizardState, "authToken" | "isProcessing" | "processingError">
    savedAt: number
}

function getStorageKey(uploadId: string) {
    return `${STORAGE_PREFIX}${uploadId}`
}

function saveWizardState(state: WizardState) {
    if (!state.uploadId || state.step === "columns") return
    try {
        const { authToken, isProcessing, processingError, ...persistable } = state
        const saved: SavedWizardState = { state: persistable, savedAt: Date.now() }
        sessionStorage.setItem(getStorageKey(state.uploadId), JSON.stringify(saved))
    } catch { /* sessionStorage full or unavailable */ }
}

function loadSavedWizardState(uploadId: string): SavedWizardState | null {
    try {
        const raw = sessionStorage.getItem(getStorageKey(uploadId))
        if (!raw) return null
        const saved: SavedWizardState = JSON.parse(raw)
        if (Date.now() - saved.savedAt > EXPIRY_MS) {
            sessionStorage.removeItem(getStorageKey(uploadId))
            return null
        }
        return saved
    } catch {
        return null
    }
}

function clearSavedWizardState(uploadId: string) {
    try {
        sessionStorage.removeItem(getStorageKey(uploadId))
    } catch { /* ignore */ }
}

// Wizard actions
interface WizardActions {
    setStep: (step: WizardStep) => void
    nextStep: () => void
    prevStep: () => void

    // Column selection
    setSelectedColumns: (columns: string[] | ((prev: string[]) => string[])) => void
    toggleColumn: (column: string) => void

    // Profiling
    setColumnProfiles: (profiles: Record<string, ColumnProfile> | ((prev: Record<string, ColumnProfile>) => Record<string, ColumnProfile>)) => void
    setRequiredColumns: (columns: string[]) => void
    setColumnCoreType: (column: string, core: string) => void
    setColumnTypeAlias: (column: string, alias: string | null) => void
    setColumnKeyType: (column: string, key: "none" | "primary_key" | "unique") => void
    setColumnNullable: (column: string, nullable: boolean) => void
    setBackendVersion: (version: string | undefined) => void
    setCrossFieldRules: (rules: CrossFieldRuleWithState[]) => void
    toggleCrossFieldRule: (ruleId: string) => void

    // Settings
    setSelectedPreset: (preset: SettingsPreset | null) => void
    setPresetOverrides: (overrides: Record<string, any>) => void

    // Rules
    setGlobalRules: (rules: RuleWithState[]) => void
    setColumnRules: (rules: Record<string, RuleWithState[]>) => void
    toggleRule: (ruleId: string, column?: string) => void
    addCustomRule: (rule: CustomRuleDefinition) => void
    removeCustomRule: (ruleId: string) => void

    // Processing
    setProcessing: (processing: boolean) => void
    startProcessing: () => void
    setProcessingError: (error: string | null) => void

    // Reset
    reset: () => void
    initializeWithFile: (uploadId: string, fileName: string, columns: string[], authToken: string) => void
    initializeNew: (authToken: string) => void

    // Persistence
    hasSavedState: (uploadId: string) => boolean
    restoreSavedState: (uploadId: string, authToken: string) => boolean
    clearSavedState: () => void
}

type WizardContextType = WizardState & WizardActions

const STEP_ORDER: WizardStep[] = ["columns", "profiling", "settings", "rules", "process"]
export const STEP_ORDER_EXISTING = ["columns", "profiling", "settings", "rules", "process"] as const
export const STEP_ORDER_NEW = ["source", "columns", "profiling", "settings", "rules", "process"] as const

const initialState: WizardState = {
    step: "columns",
    mode: "existing",
    uploadId: "",
    fileName: "",
    authToken: "",
    allColumns: [],
    selectedColumns: [],
    columnProfiles: {},
    requiredColumns: [],
    columnCoreTypes: {},
    columnTypeAliases: {},
    columnKeyTypes: {},
    columnNullable: {},
    backendVersion: undefined,
    crossFieldRules: [],
    selectedPreset: null,
    presetOverrides: {},
    globalRules: [],
    columnRules: {},
    customRules: [],
    disabledRules: [],
    isProcessing: false,
    processingError: null,
}

const WizardContext = createContext<WizardContextType | undefined>(undefined)

export function ProcessingWizardProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<WizardState>(initialState)

    const actions: WizardActions = {
        setStep: (step) => setState((s) => ({ ...s, step })),

        nextStep: () => {
            const order = state.mode === "new" ? STEP_ORDER_NEW : STEP_ORDER_EXISTING
            setState((s) => {
                const currentIndex = order.indexOf(s.step as any)
                if (currentIndex < order.length - 1) {
                    return { ...s, step: order[currentIndex + 1] as WizardStep }
                }
                return s
            })
        },

        prevStep: () => {
            const order = state.mode === "new" ? STEP_ORDER_NEW : STEP_ORDER_EXISTING
            setState((s) => {
                const currentIndex = order.indexOf(s.step as any)
                if (currentIndex > 0) {
                    return { ...s, step: order[currentIndex - 1] as WizardStep }
                }
                return s
            })
        },

        setSelectedColumns: (columns: string[] | ((prev: string[]) => string[])) => {
            setState((s) => ({
                ...s,
                selectedColumns: typeof columns === 'function' ? columns(s.selectedColumns) : columns
            }))
        },

        toggleColumn: (column) => {
            setState((s) => {
                const isSelected = s.selectedColumns.includes(column)
                return {
                    ...s,
                    selectedColumns: isSelected
                        ? s.selectedColumns.filter((c) => c !== column)
                        : [...s.selectedColumns, column],
                }
            })
        },

        setColumnProfiles: (profiles) => setState((s) => ({
            ...s,
            columnProfiles: typeof profiles === 'function' ? profiles(s.columnProfiles) : profiles,
        })),

        setRequiredColumns: (columns) => setState((s) => ({ ...s, requiredColumns: columns })),

        setColumnCoreType: (column, core) => setState((s) => ({
            ...s,
            columnCoreTypes: { ...s.columnCoreTypes, [column]: core },
            columnTypeAliases: { ...s.columnTypeAliases, [column]: null }, // reset alias on core change
        })),

        setColumnTypeAlias: (column, alias) => setState((s) => ({
            ...s,
            columnTypeAliases: { ...s.columnTypeAliases, [column]: alias },
        })),

        setColumnKeyType: (column, key) => setState((s) => ({
            ...s,
            columnKeyTypes: { ...s.columnKeyTypes, [column]: key },
            columnNullable: key === "primary_key"
                ? { ...s.columnNullable, [column]: false }
                : s.columnNullable,
        })),

        setColumnNullable: (column, nullable) => setState((s) => ({
            ...s,
            columnNullable: { ...s.columnNullable, [column]: nullable },
        })),

        setBackendVersion: (version) => setState((s) => ({ ...s, backendVersion: version })),

        setCrossFieldRules: (rules) => setState((s) => ({ ...s, crossFieldRules: rules })),

        toggleCrossFieldRule: (ruleId) => setState((s) => ({
            ...s,
            crossFieldRules: s.crossFieldRules.map((r) =>
                r.rule_id === ruleId ? { ...r, enabled: !r.enabled } : r
            ),
        })),

        setSelectedPreset: (preset) => setState((s) => ({ ...s, selectedPreset: preset })),

        setPresetOverrides: (overrides) => setState((s) => ({ ...s, presetOverrides: overrides })),

        setGlobalRules: (rules) => setState((s) => ({ ...s, globalRules: rules })),

        setColumnRules: (rules) => setState((s) => ({ ...s, columnRules: rules })),

        toggleRule: (ruleId, column) => {
            setState((s) => {
                if (column) {
                    // Toggle column-specific rule
                    const columnRules = { ...s.columnRules }
                    if (columnRules[column]) {
                        columnRules[column] = columnRules[column].map((r) =>
                            r.rule_id === ruleId ? { ...r, selected: !r.selected } : r
                        )
                    }
                    return { ...s, columnRules }
                } else {
                    // Toggle global rule
                    return {
                        ...s,
                        globalRules: s.globalRules.map((r) =>
                            r.rule_id === ruleId ? { ...r, selected: !r.selected } : r
                        ),
                    }
                }
            })
        },

        addCustomRule: (rule) => {
            setState((s) => ({ ...s, customRules: [...s.customRules, rule] }))
        },

        removeCustomRule: (ruleId) => {
            setState((s) => ({
                ...s,
                customRules: s.customRules.filter((r) => r.rule_id !== ruleId),
            }))
        },

        setProcessing: (processing) => setState((s) => ({ ...s, isProcessing: processing })),

        startProcessing: () => setState((s) => ({ ...s, isProcessing: true, processingError: null })),

        setProcessingError: (error) => setState((s) => ({ ...s, isProcessing: false, processingError: error })),

        reset: () => {
            clearSavedWizardState(state.uploadId)
            setState(initialState)
        },

        initializeWithFile: (uploadId, fileName, columns, authToken) => {
            setState({
                ...initialState,
                mode: "existing",
                uploadId,
                fileName,
                authToken,
                allColumns: columns,
                selectedColumns: columns, // Select all by default
                columnCoreTypes: Object.fromEntries(columns.map((c) => [c, "string"])),
                columnTypeAliases: Object.fromEntries(columns.map((c) => [c, null])),
                columnKeyTypes: Object.fromEntries(columns.map((c) => [c, "none"] as const)),
                columnNullable: Object.fromEntries(columns.map((c) => [c, true])),
                crossFieldRules: [],
            })
        },

        initializeNew: (authToken) => {
            setState({ ...initialState, mode: "new", step: "source", authToken })
        },

        // Persistence
        hasSavedState: (uploadId) => loadSavedWizardState(uploadId) !== null,

        restoreSavedState: (uploadId, authToken) => {
            const saved = loadSavedWizardState(uploadId)
            if (!saved) return false
            setState({ ...saved.state, authToken, isProcessing: false, processingError: null })
            return true
        },

        clearSavedState: () => clearSavedWizardState(state.uploadId),
    }

    // Auto-save wizard state on step changes (after first step)
    useEffect(() => {
        if (state.uploadId && state.step !== "columns") {
            saveWizardState(state)
        }
    }, [state.step, state.uploadId, state.selectedColumns, state.columnCoreTypes, state.columnRules, state.customRules])

    return (
        <WizardContext.Provider value={{ ...state, ...actions }}>
            {children}
        </WizardContext.Provider>
    )
}

export function useProcessingWizard() {
    const context = useContext(WizardContext)
    if (!context) {
        throw new Error("useProcessingWizard must be used within ProcessingWizardProvider")
    }
    return context
}

export { STEP_ORDER }
