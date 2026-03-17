// ─── Jobs types ───────────────────────────────────────────────────────────────

export type JobStatus = 'ACTIVE' | 'PAUSED' | 'FAILED' | 'AUTO_PAUSED'
export type JobFrequency = '15min' | '1hr' | 'daily' | 'cron' | 'batch'
export type ERPType = 'quickbooks' | 'zoho_books' | 'snowflake'
export type DQMode = 'default' | 'custom'

export interface SnowflakeEntityConfig {
    warehouse?: string
    database?: string
    schema?: string
    table?: string
}

export interface MappingConfig {
    column_mapping?: Record<string, string>
    auto_mapped?: boolean
    mapping_method?: string
}

export interface DQConfig {
    mode: DQMode
    columns?: string[] | null
    preset_id?: string | null
    rules?: any[] | null
    primary_key_field?: string | null
}

export interface Job {
    job_id: string
    name: string
    source: ERPType
    destination: ERPType
    entities?: string[]
    source_entity?: string
    target_entity?: string
    // Backend stores these two fields (not a single 'frequency')
    frequency_type?: string   // 'rate' | 'cron' | 'batch'
    frequency_value?: string  // e.g. '15 minutes', '1 hour', '1 day', 'once', or cron expr
    // Convenience field (computed by frontend)
    frequency?: JobFrequency
    cron_expression?: string
    dq_config: DQConfig
    mapping_config?: MappingConfig
    source_snowflake_config?: SnowflakeEntityConfig
    dest_snowflake_config?: SnowflakeEntityConfig
    status: JobStatus
    max_records?: number
    created_at?: string
    updated_at?: string
    last_run_at?: string
    last_run_status?: string
    total_runs?: number
    consecutive_failures?: number
    responsible_user_id?: string
}

export interface EntityResult {
    status: string
    records_imported: number
    records_exported: number
    dq_score?: number
    upload_id?: string
    duration_seconds?: number
    error?: string
    sync_from?: string
    sync_to?: string
    new_records_count?: number
    skipped_duplicates_count?: number
    // DQ breakdown
    rows_in?: number
    rows_out?: number
    rows_clean?: number
    rows_fixed?: number
    rows_quarantined?: number
}

export interface ProcessingMetadata {
    avg_dq_score?: number | null
    entities_processed: number
    entities_failed: number
    entities_no_changes: number
    total_new_records: number
    total_skipped_duplicates: number
}

export interface JobRun {
    run_id: string
    job_id: string
    user_id: string
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'NO_CHANGES' | 'SKIPPED' | 'RUNNING'
    started_at: string
    completed_at?: string
    duration_seconds: number
    source_erp?: string
    destination_erp?: string
    entities?: string[]
    entity_results?: Record<string, EntityResult>
    total_records_imported: number
    total_records_exported: number
    trigger_source?: string
    error?: string
    processing_metadata?: ProcessingMetadata | null
    // Legacy fields for backwards compat with existing JobRunsPanel
    records_fetched?: number
    records_written?: number
}

export interface CreateJobPayload {
    name: string
    source: ERPType
    destination: ERPType
    entities?: string[]
    source_entity?: string
    target_entity?: string
    frequency_type: string
    frequency_value: string
    dq_config?: Partial<DQConfig>
    mapping_config?: MappingConfig
    source_snowflake_config?: SnowflakeEntityConfig
    dest_snowflake_config?: SnowflakeEntityConfig
    max_records?: number
    responsible_user_id?: string
}

export interface UpdateJobPayload {
    name?: string
    source?: ERPType
    destination?: ERPType
    entities?: string[]
    source_entity?: string
    target_entity?: string
    frequency_type?: string
    frequency_value?: string
    dq_config?: Partial<DQConfig>
    mapping_config?: MappingConfig
    source_snowflake_config?: SnowflakeEntityConfig
    dest_snowflake_config?: SnowflakeEntityConfig
    max_records?: number
    responsible_user_id?: string
}

// ─── Advanced Options types ──────────────────────────────────────────────────

export interface ImportPreviewResult {
    columns: string[]
    sample_rows: number
    upload_id: string
    records_imported: number
}

export interface ColumnProfile {
    type_guess?: string
    type_confidence?: number
    null_rate?: number
    unique_ratio?: number
    key_type?: 'none' | 'primary_key' | 'unique'
    nullable_suggested?: boolean
    rules?: Array<{
        rule_id: string
        rule_name?: string
        confidence?: number
        decision?: 'auto' | 'human'
        reasoning?: string
    }>
    numeric_parse_rate?: number
    date_parse_rate?: number
    len_min?: number
    len_max?: number
    len_mean?: number
    profile_time_sec?: number
    llm_time_sec?: number
    llm_reasoning?: string
    column_name?: string
}

export interface ProfilingResult {
    summary?: {
        total_columns: number
        total_rules: number
        processed_at: string
        engine_version: string
        backend_version?: string
    }
    profiles: Record<string, ColumnProfile>
    cross_field_rules?: Array<{
        rule_id: string
        cols: string[]
        relationship?: string
        condition?: string
        confidence?: number
        reasoning?: string
    }>
}

export interface Preset {
    preset_id: string
    preset_name: string
    is_default: boolean
    is_system?: boolean
    config: Record<string, any>
    created_at?: string
    updated_at?: string
}

export interface DQRule {
    rule_id: string
    rule_name: string
    description: string
    severity: string
    default_selected: boolean
    selected?: boolean
}
