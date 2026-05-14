/**
 * Augmentation feature types — mirror the backend contract under
 * /augmentation/*. Wire shape comes from contexts/augmentation in the AWS
 * repo; keep aligned with the Pydantic models there.
 */
export type AugmentationJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED"
export type PromptCardinality = "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY"

export interface AugmentationJob {
    job_id: string
    status: AugmentationJobStatus
    output_rows_count?: number
    cost_actual_usd?: number
    created_at: string
    error_message?: string
    template_id?: string
    input_dataset_key?: string
    output_dataset_key?: string
    sox_audit_enabled?: boolean
    dry_run?: boolean
}

export interface SubmitJobBody {
    prompt_template_id: string
    input_dataset_key: string
    output_dataset_key: string
    sox_audit_enabled?: boolean
    dry_run?: boolean
}

export interface SubmitJobResponse {
    job_id: string
    status: AugmentationJobStatus
    location?: string
}

export interface JobOutputResponse { presigned_url: string; expires_at: string }

export interface PromptTemplate {
    template_id: string
    version: number
    is_active: boolean
    prompt_text: string
    cardinality: PromptCardinality
    expected_input_schema: Record<string, unknown>
    expected_output_schema: Record<string, unknown>
    created_at?: string
}

export interface RegisterTemplateBody {
    template_id: string
    prompt_text: string
    cardinality: PromptCardinality
    expected_input_schema: Record<string, unknown>
    expected_output_schema: Record<string, unknown>
}

export interface OutputContract {
    rows: Array<Record<string, unknown>>
    total_rows: number
    sox_lineage?: { input_dataset_key: string; output_dataset_key: string; run_id: string }
}

const TERMINAL: ReadonlySet<AugmentationJobStatus> = new Set(["SUCCEEDED", "FAILED"])
export const isTerminalJobStatus = (status: string): boolean =>
    TERMINAL.has(status as AugmentationJobStatus)
