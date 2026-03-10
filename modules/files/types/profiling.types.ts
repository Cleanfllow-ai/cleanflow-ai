// ─── Profiling types ──────────────────────────────────────────────────────────
// Extracted from lib/api/file-management-api.ts

export interface ColumnProfileRule {
    rule_id: string
    rule_name?: string
    confidence: number
    decision: 'auto' | 'human'
    reasoning?: string
    source?: string
}

export interface CustomRuleDefinition {
    rule_id?: string
    column: string
    template: string
    code?: string  // LLM-generated Python code (when template="code")
    params?: Record<string, any>
    rule_name?: string
    explanation?: string
    severity?: "critical" | "warning" | "info"
}

export interface CustomRuleSuggestionResponse {
    suggestion?: CustomRuleDefinition & { confidence?: number }
    executable?: boolean
    error?: string
    raw_response?: unknown
}

export interface ColumnProfile {
    type_guess: string
    type_confidence: number
    null_rate: number
    unique_ratio: number
    numeric_parse_rate?: number
    int_like_rate?: number
    date_parse_rate?: number
    datetime_has_time_rate?: number
    email_valid_rate?: number
    phone_valid_rate?: number
    iso4217_rate?: number
    uom_code_rate?: number
    fiscal_period_rate?: number
    len_min?: number
    len_max?: number
    len_mean?: number
    key_type?: 'none' | 'primary_key' | 'unique'
    nullable_suggested?: boolean
    llm_reasoning?: string
    rules: ColumnProfileRule[]
    profile_time_sec?: number
    llm_time_sec?: number
}

export interface CrossFieldRule {
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
}

export interface ColumnTypeOverride {
    core_type: string
    type_alias: string | null
    key_type: 'none' | 'primary_key' | 'unique'
    nullable: boolean
}

export interface ProfilingResponse {
    summary: {
        total_columns: number
        total_rules: number
        processed_at: string
        engine_version: string
        backend_version?: string
    }
    profiles: Record<string, ColumnProfile>
    cross_field_rules?: CrossFieldRule[]
}
