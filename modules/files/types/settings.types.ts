// ─── Settings types ───────────────────────────────────────────────────────────
// Extracted from lib/api/file-management-api.ts

export interface SettingsPreset {
    preset_id: string
    preset_name: string
    config: {
        currency_values?: string[]
        uom_values?: string[]
        date_formats?: string[]
        target_date_format?: string
        custom_patterns?: Record<string, string>
        required_columns?: string[]
        ruleset_version?: string
        // RightRev S3 seed files store these at the top level; FE wizard's
        // DEFAULT_PRESET nests them under `policies`. The BE
        // _preset_allow_autofix decoder tolerates both forms — accept both
        // here so TypeScript doesn't reject either preset shape.
        allow_autofix?: boolean
        strictness?: string
        policies?: {
            allow_autofix?: boolean
            strictness?: string
            unknown_column_behavior?: string
        }
        rules_enabled?: Record<string, boolean>
        // Top-level shape (seed) or nested under required_fields (FE).
        placeholders_treated_as_missing?: string[]
        required_fields?: {
            placeholders_treated_as_missing?: string[]
        }
        enum_sets?: Record<string, string[]>
        thresholds?: {
            text?: {
                max_len_default?: number
            }
            dates?: {
                date_formats?: string[]
                target_format?: string
            }
        }
        reference_data?: {
            accounting_periods?: Array<{ name?: string; start: string; end: string }>
            fx_rates?: Record<string, number>
            gl_accounts?: string[]
            legal_entities?: string[]
            revenue_policies?: string[]
            ssp_policies?: string[]
        }
        // Pass-through fields used by other BE consumers
        column_rules_override?: Record<string, string[]>
        global_disabled_rules?: string[]
        disable_rules?: Record<string, string[]>
    }
    is_default?: boolean
    created_at?: string
    updated_at?: string
}
