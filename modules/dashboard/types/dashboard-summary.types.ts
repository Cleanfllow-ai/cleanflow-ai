/**
 * AA4 Phase 1 — dashboard summary envelope returned by GET /dashboard/summary.
 * Matches contexts/files/application/dto/files_dto.py
 *   GetDashboardSummaryResponse.
 */

export interface DashboardLastFile {
    upload_id?: string
    original_filename?: string
    filename?: string
    status?: string
    dq_score?: number
    total_size?: number
    created_at?: string
    updated_at?: string
}

export interface DashboardTopbar {
    rows_processed_mtd: number
    files_completed_mtd: number
    last_file: DashboardLastFile | null
}

export interface DashboardRecentFile {
    upload_id?: string
    original_filename?: string
    filename?: string
    total_size?: number
    status?: string
    dq_score?: number
    created_at?: string
    updated_at?: string
    partial_completion?: boolean
}

export interface DashboardTrendPoint {
    date: string // YYYY-MM-DD UTC
    avg_dq_score: number
    file_count: number
}

export interface DashboardAugmentationJob {
    job_id?: string
    status?: string
    prompt_template_id?: string
    created_at?: string
    cost_estimate_usd?: number
    cost_actual_usd?: number | null
    output_dataset_key?: string
}

/**
 * Server-bucketed Validated / Fixed / Quarantined trend point.
 *
 * Returned by GET /dashboard/summary (commit 4eb29171). Replaces the FE's
 * previous `buildSyntheticTrendData` Math.sin filler in
 * `professional-charts-carousel.tsx` — the BE now fans the same
 * list_by_org result set into day/week/month buckets so the chart only ever
 * renders real DQ_FIXED rows.
 *
 * `period` matches the legacy `period` key the recharts ComposedChart consumes,
 * so the existing dataKey wiring keeps working unchanged.
 */
export interface ProcessingTrendBucket {
    key: string
    period: string
    clean: number
    fixed: number
    quarantined: number
}

export interface ProcessingTrend {
    day: ProcessingTrendBucket[]
    week: ProcessingTrendBucket[]
    month: ProcessingTrendBucket[]
}

export interface DashboardSummaryResponse {
    topbar: DashboardTopbar
    recent_files: DashboardRecentFile[]
    dq_score_trend: DashboardTrendPoint[]
    recent_augmentations: DashboardAugmentationJob[]
    /**
     * Optional for backwards compat with the pre-deploy BE response.
     * Once the files-context stack is deployed, every response includes it.
     * The FE chart falls back to an empty-state when missing.
     */
    processing_trend?: ProcessingTrend
}
