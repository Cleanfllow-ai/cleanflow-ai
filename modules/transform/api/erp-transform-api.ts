// Move API base URL to env
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

// Helper function to check if API is available
const isAPIAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    return response.ok
  } catch {
    return false
  }
}

export interface HealthResponse {
  status: string
  version?: string
  engine: string
}

export interface AnalyzeResponse {
  column_info: {
    column_count: number
    row_count: number
    columns: string[]
    dtypes: Record<string, string>
    null_counts: Record<string, number>
    sample_data: Record<string, any[]>
  }
  erp_entity_suggestions: Array<{
    entity: string
    erp: string
    confidence: number
    above_threshold: boolean
  }>
  available_entities: string[]
  available_erps: string[]
  processing_time_ms: number
}

export interface ValidateResponse {
  valid: boolean
  file_format: string
  column_info: {
    column_count: number
    row_count: number
    columns: string[]
    dtypes: Record<string, string>
    null_counts: Record<string, number>
  }
  message: string
}

export interface TransformResponse {
  success: boolean
  data: any[]
  detected_erp: string
  detected_entity: string
  transformation_mode: string
  confidence_score: number
  message: string
  column_mappings: Record<string, string>
  row_count: number
  processing_time_ms: number
}

export interface TemplateResponse {
  erp: string
  entity: string
  mapping: Record<string, string>
  cdf_schema: string[]
}

export interface EntitySchemaResponse {
  entity: string
  cdf_schema: string[]
  field_count: number
}

class ERPTransformAPI {
  // Health & Information endpoints
  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) throw new Error("Failed to fetch health status")
      return response.json()
    } catch (error) {
      throw new Error("API server is not available")
    }
  }

  async getEntities(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/entities`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) throw new Error("Failed to fetch entities")
      return response.json()
    } catch (error) {
      throw new Error("Failed to fetch entities")
    }
  }

  async getERPs(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/erps`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) throw new Error("Failed to fetch ERP systems")
      return response.json()
    } catch (error) {
      throw new Error("Failed to fetch ERP systems")
    }
  }

  async getFormats(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/formats`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) throw new Error("Failed to fetch supported formats")
      return response.json()
    } catch (error) {
      throw new Error("Failed to fetch supported formats")
    }
  }

  // Analysis & Validation endpoints
  async analyzeFile(file: File): Promise<AnalyzeResponse> {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to analyze file")
    }

    return response.json()
  }

  async validateFile(file: File): Promise<ValidateResponse> {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(`${API_BASE_URL}/validate`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to validate file")
    }

    return response.json()
  }

  // Core transformation endpoints (using pure CleanAI routes)
  async transformFile(
    file: File,
    options: {
      auto_select_erp?: boolean
      auto_select_entity?: boolean
      entity?: string
      erp?: string
      output_format?: string
    } = {},
  ): Promise<TransformResponse> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("auto_select_erp", String(options.auto_select_erp ?? true))
    formData.append("auto_select_entity", String(options.auto_select_entity ?? true))

    if (options.entity) formData.append("entity", options.entity)
    if (options.erp) formData.append("erp", options.erp)
    if (options.output_format) formData.append("output_format", options.output_format)

    const response = await fetch(`${API_BASE_URL}/llm_pure/transform/file`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to transform file (CleanAI)")
    }

    return response.json()
  }

  async transformFileDownload(
    file: File,
    options: {
      auto_select_erp?: boolean
      auto_select_entity?: boolean
      entity?: string
      erp?: string
      output_format?: string
    } = {},
  ): Promise<Blob> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("auto_select_erp", String(options.auto_select_erp ?? true))
    formData.append("auto_select_entity", String(options.auto_select_entity ?? true))

    if (options.entity) formData.append("entity", options.entity)
    if (options.erp) formData.append("erp", options.erp)
    if (options.output_format) formData.append("output_format", options.output_format)

    const response = await fetch(`${API_BASE_URL}/llm_pure/transform/file/download`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || "Failed to download transformed file (CleanAI)")
    }

    return response.blob()
  }

  // Transform JSON data directly (pure CleanAI)
  async transformJSON(data: {
    auto_select_erp?: boolean
    auto_select_entity?: boolean
    entity?: string
    erp?: string
    data: any[]
  }): Promise<TransformResponse> {
    const response = await fetch(`${API_BASE_URL}/llm_pure/transform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to transform data (CleanAI)")
    }

    return response.json()
  }

  // Template endpoints
  async getTemplate(erp: string, entity: string): Promise<TemplateResponse> {
    const response = await fetch(
      `${API_BASE_URL}/template/erp/${encodeURIComponent(erp)}/entity/${encodeURIComponent(entity)}`,
    )
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to fetch template")
    }
    return response.json()
  }

  async getEntitySchema(entity: string): Promise<EntitySchemaResponse> {
    const response = await fetch(`${API_BASE_URL}/template/entity/${encodeURIComponent(entity)}/schema`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to fetch entity schema")
    }
    return response.json()
  }
}

export const erpTransformAPI = new ERPTransformAPI()
