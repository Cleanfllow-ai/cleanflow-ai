// ─── DQ Report types ──────────────────────────────────────────────────────────
// Extracted from lib/api/file-management-api.ts

export interface DqReportResponse {
    rules_version?: string
    script_version?: string
    timestamp_utc?: string
    input_timestamp_utc?: string
    output_timestamp_utc?: string
    processing_time_seconds?: number
    user_id?: string
    upload_id?: string
    rows_in?: number
    rows_out?: number
    rows_clean?: number
    rows_fixed?: number
    rows_quarantined?: number
    dq_score?: number
    artifact?: string
    mode?: string
    detected_erp?: string | null
    detected_entity?: string
    ai_actions?: number
    hybrid_summary?: HybridSummary
    violation_counts?: Record<string, number>
    top_violations?: TopIssue[]
    processing_time?: string | number
}

export interface HybridSummary {
    total_rows?: number
    clean_rows?: number
    fixed_rows?: number
    quarantined_rows?: number
    ai_actions?: number
    ai_planner?: string
    outstanding_issues?: OutstandingIssue[]
    outstanding_issues_total?: number
    outstanding_issues_has_more?: boolean
    outstanding_issues_sample_size?: number
    status?: string
}

export interface OutstandingIssue {
    row: number
    column: string
    violation: string
    value: any
}

export interface IssuesResponse {
    issues: OutstandingIssue[]
    total: number
    next_offset?: number | null
    available_violations?: Record<string, number>
    applied_filters?: string[]
}

export interface TopIssue {
    violation: string
    count: number
}

export interface MonthlyDqStats {
    files_processed: number
    files_deleted: number
    total_processing_time_seconds: number
    rows_in: number
    rows_out: number
    rows_fixed: number
    rows_quarantined: number
    violation_counts?: Record<string, number>
    top_issues?: TopIssue[]
}

// Overall DQ Report (per-user aggregated)
export interface OverallDqReportResponse {
    user_id: string
    generated_at_utc: string
    months: Record<string, MonthlyDqStats>
}
