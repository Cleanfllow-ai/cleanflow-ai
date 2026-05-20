/**
 * Unstructured Import — domain types shared by the FE module.
 *
 * Backend contract (Phase 1):
 *   - Source: google_drive | local_upload
 *   - Filter: manual (glob + date range) | agentic (natural-language prompt)
 *   - Schema: invoice_standard | contract_v1 | receipt_v1
 *   - Augmentation: optional English rule (LLM-compiled server-side)
 */

export type UnstructuredConnector = "google_drive" | "local_upload"

export type UnstructuredFilterMode = "manual" | "agentic"

export type UnstructuredSchemaId =
  | "invoice_standard"
  | "contract_v1"
  | "receipt_v1"

export interface UnstructuredJobSource {
  connector: UnstructuredConnector
  connection_id: string
  folder_id: string | null
}

export interface UnstructuredJobFilter {
  mode: UnstructuredFilterMode
  glob: string
  modified_after: string | null
  modified_before: string | null
  agentic_prompt: string | null
}

export interface UnstructuredJobSpec {
  source: UnstructuredJobSource
  filter: UnstructuredJobFilter
  schema_id: UnstructuredSchemaId
  augmentation_rule: string | null
}

export type UnstructuredJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "partial"
  | "cancelled"

export interface UnstructuredJobCreateResponse {
  job_id: string
  status: UnstructuredJobStatus
  sfn_execution_arn?: string
}

export interface UnstructuredJobCounts {
  total: number
  parsed: number
  extracted: number
  review_required: number
  failed: number
  skipped: number
}

export interface UnstructuredJob {
  job_id: string
  status: UnstructuredJobStatus
  started_at: string
  finished_at?: string | null
  counts: UnstructuredJobCounts
  schema_id: UnstructuredSchemaId
  source_connector: UnstructuredConnector
  cost_usd?: number | null
  augmentation_rule?: string | null
  sfn_execution_arn?: string | null
  error_message?: string | null
}

export type UnstructuredFileStatus =
  | "queued"
  | "parsing"
  | "extracting"
  | "augmenting"
  | "done"
  | "review_required"
  | "failed"
  | "skipped"

export interface UnstructuredFileRecord {
  file_id: string
  file_name: string
  status: UnstructuredFileStatus
  confidence?: number | null
  error?: string | null
  parsed_at?: string | null
  extracted_at?: string | null
  bytes?: number | null
}

export interface UnstructuredFileListResponse {
  files: UnstructuredFileRecord[]
  next_page_token?: string | null
}

export interface UnstructuredJobListResponse {
  jobs: UnstructuredJob[]
  next_page_token?: string | null
}

export interface UnstructuredJobResultResponse {
  job_id: string
  presigned_url: string
  format: "parquet" | "csv"
  size_bytes?: number | null
  expires_at?: string | null
}

/** SSE event payload — every line of the live log. */
export type UnstructuredLogEventKind =
  | "state_transition"
  | "file_event"
  | "warning"
  | "error"
  | "info"
  | "done"

export interface UnstructuredLogEvent {
  ts: string
  kind: UnstructuredLogEventKind
  /** human-readable line for the log pane */
  message: string
  /** optional per-file context */
  file_id?: string
  file_name?: string
  file_status?: UnstructuredFileStatus
  /** optional state-machine context */
  stage?: string
  /** raw payload from BE (forward-compat) */
  meta?: Record<string, unknown>
}

export interface UnstructuredSchemaInfo {
  id: UnstructuredSchemaId
  label: string
  description: string
}

export const UNSTRUCTURED_SCHEMAS: readonly UnstructuredSchemaInfo[] = [
  {
    id: "invoice_standard",
    label: "Invoice (standard)",
    description:
      "Extracts vendor, invoice number, line items, totals, tax, due date.",
  },
  {
    id: "contract_v1",
    label: "Contract",
    description:
      "Extracts parties, effective date, termination date, key obligations.",
  },
  {
    id: "receipt_v1",
    label: "Receipt",
    description:
      "Extracts merchant, purchase date, items, total, payment method.",
  },
] as const
