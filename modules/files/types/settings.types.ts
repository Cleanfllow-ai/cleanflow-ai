// ─── Settings types ───────────────────────────────────────────────────────────
// Extracted from lib/api/file-management-api.ts

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
    created_at?: string
    updated_at?: string
}
