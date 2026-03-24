// ─── Jobs types (provider-agnostic) ──────────────────────────────────────────

export type JobStatus = 'ACTIVE' | 'PAUSED' | 'FAILED' | 'AUTO_PAUSED'
export type JobFrequency = '15min' | '1hr' | 'daily' | 'cron' | 'batch'
export type DQMode = 'default' | 'custom'

export type DQPolicy = 'block_and_notify' | 'export_all'

export interface DQConfig {
    mode: DQMode
    policy?: DQPolicy
    columns?: string[] | null
    preset_id?: string | null
    rules?: any[] | null
    rules_enabled?: Record<string, boolean> | null
    primary_key_field?: string | null
    policies?: {
        allow_autofix?: boolean
        strictness?: string
    }
}

export interface Job {
    job_id: string
    name: string

    // Provider-agnostic: any category + any provider
    source_provider: string
    source_category: string          // "erp" | "warehouse" | "storage"
    source_config: Record<string, any>
    destination_provider: string
    destination_category: string
    destination_config: Record<string, any>

    entities: string[]
    column_mapping: Record<string, string>

    frequency_type: string           // "rate" | "cron" | "batch"
    frequency_value: string

    // Convenience (computed by frontend)
    frequency?: JobFrequency

    dq_config: DQConfig
    export_config: Record<string, any>

    status: JobStatus
    created_at?: string
    updated_at?: string
    last_run_at?: string
    last_run_status?: string
    total_runs?: number
    consecutive_failures?: number
    responsible_user_id?: string
}

export interface PipelineLog {
    timestamp: string
    entity: string
    phase: string            // "import" | "dq" | "export" | "error" | "retry" | "skip"
    message: string
    details?: Record<string, any>
}

export interface EntityResult {
    status: string
    imported?: number
    exported?: number
    quarantined?: number
    dq_score?: number | null
    error?: string
    retryable?: boolean
    export_details?: {
        created?: number
        updated?: number
        failed?: number
    }
}

export interface JobRun {
    run_id: string
    job_id?: string
    user_id?: string
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'NO_CHANGES' | 'SKIPPED' | 'RUNNING' | 'AWAITING_REVIEW'
    trigger_source?: string
    started_at: string
    completed_at?: string
    duration_ms: number
    total_imported: number
    total_exported: number
    total_quarantined: number
    entity_results: Record<string, EntityResult>
    pipeline_logs: PipelineLog[]
    processing_metadata?: {
        avg_dq_score?: number | null
    }
    correlation_id?: string
}

export interface CreateJobPayload {
    name: string
    source_provider: string
    source_category: string
    destination_provider: string
    destination_category: string
    entities: string[]
    frequency_type: string
    frequency_value: string
    source_config?: Record<string, any>
    destination_config?: Record<string, any>
    column_mapping?: Record<string, string>
    dq_config?: Partial<DQConfig>
    export_config?: Record<string, any>
    responsible_user_id?: string
}

export interface UpdateJobPayload {
    name?: string
    entities?: string[]
    frequency_type?: string
    frequency_value?: string
    source_config?: Record<string, any>
    destination_config?: Record<string, any>
    column_mapping?: Record<string, string>
    dq_config?: Partial<DQConfig>
    export_config?: Record<string, any>
    responsible_user_id?: string
}
