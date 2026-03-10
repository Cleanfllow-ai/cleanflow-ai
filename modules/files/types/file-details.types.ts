export type FileDetailsTab = "details" | "preview" | "dq-report" | "versions"

export interface FilePreviewData {
  headers: string[]
  sample_data: any[]
  total_rows: number
  has_dq_status?: boolean
}

export interface FileIssue {
  row: number
  column: string
  violation: string
  value: any
}

export interface MatrixTotals {
  totalResults?: number
  totalRows?: number
}

