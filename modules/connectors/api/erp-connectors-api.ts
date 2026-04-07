/**
 * Unified ERP Connectors API — ERP operations parameterized by provider.
 *
 * Provider-specific routes:
 *   POST /connectors/erp/{provider}/import
 *   POST /connectors/erp/{provider}/export
 *   GET  /connectors/erp/{provider}/entities
 *   GET  /connectors/erp/{provider}/fields
 *   POST /connectors/erp/{provider}/ai-automap
 *   GET  /connectors/erp/{provider}/export-status
 *
 * Generic routes:
 *   POST /connectors/erp/schema-resolve
 *   POST /connectors/erp/schema-import
 *   POST /connectors/erp/multi-export
 *   GET  /connectors/erp/multi-export/status
 *   POST /connectors/erp/mapping/preview
 *   GET  /connectors/erp/mapping/erps
 *   GET  /connectors/erp/mapping/schema
 */

import { ConnectorAPIBase } from "./base"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EntityInfo {
  entity: string
  name?: string
  label: string
  record_count: number
  has_data: boolean
  available: boolean
  reason?: string
  value?: string
}

export interface EntityField {
  name: string
  key?: string
  label?: string
  description?: string
  type?: string
  data_type?: string
  required?: boolean
}

export interface ERPImportResponse {
  upload_id?: string
  filename?: string
  records_imported?: number
  status?: string
  message?: string
  [key: string]: unknown
}

export interface ERPExportResponse {
  success?: boolean
  records_created?: number
  records_updated?: number
  records_failed?: number
  records_exported?: number
  message?: string
  status?: string
  [key: string]: unknown
}

export interface ERPExportStatusResponse {
  upload_id: string
  status: string
  progress?: number
  message?: string
  processed_count?: number
  success_count?: number
  failed_count?: number
  total_count?: number
  records_exported?: number
  error?: string
  [key: string]: unknown
}

export interface AutoMapResponse {
  mapping: Record<string, string>
  columns_mapped: number
  method?: string
}

export interface MappingPreviewResponse {
  mapping: Record<string, string>
  source?: Record<string, unknown>
  template_mapped?: Record<string, unknown>
  ai_mapped?: Record<string, unknown>
  unmapped?: string[]
  confidence?: number
  method?: string
  cdf_entity?: string
}

// ─── Service ────────────────────────────────────────────────────────────────

class ERPConnectorsAPI extends ConnectorAPIBase {
  // ── Provider-specific routes ──────────────────────────────────────────────

  /** Import data from an ERP provider into CleanFlow. */
  async importData(
    provider: string,
    entityType: string,
    filters?: Record<string, unknown>,
    orgId?: string,
  ): Promise<ERPImportResponse> {
    return await this.makeRequest<ERPImportResponse>(
      `/connectors/erp/${provider}/import`,
      {
        method: "POST",
        body: JSON.stringify({
          entity_type: entityType,
          filters,
          ...(orgId ? { org_id: orgId } : {}),
        }),
      },
    )
  }

  /** Export cleaned data to an ERP provider. */
  async exportData(
    provider: string,
    uploadId: string,
    entityType?: string,
    columnMapping?: Record<string, string>,
    orgId?: string,
  ): Promise<ERPExportResponse> {
    return await this.makeRequest<ERPExportResponse>(
      `/connectors/erp/${provider}/export`,
      {
        method: "POST",
        body: JSON.stringify({
          upload_id: uploadId,
          entity_type: entityType,
          column_mapping: columnMapping,
          ...(orgId ? { org_id: orgId } : {}),
        }),
      },
    )
  }

  /** Discover available entities for a provider. */
  async discoverEntities(
    provider: string,
    orgId?: string,
  ): Promise<{ entities: EntityInfo[] }> {
    const params = new URLSearchParams()
    if (orgId) params.set("org_id", orgId)
    const qs = params.toString()
    return await this.makeRequest<{ entities: EntityInfo[] }>(
      `/connectors/erp/${provider}/entities${qs ? `?${qs}` : ""}`,
      { method: "GET" },
    )
  }

  /** Get field definitions for an entity. */
  async getEntityFields(
    provider: string,
    entityType: string,
  ): Promise<{ entity: string; fields: EntityField[]; count: number }> {
    const params = new URLSearchParams({ entity_type: entityType })
    return await this.makeRequest(
      `/connectors/erp/${provider}/fields?${params.toString()}`,
      { method: "GET" },
    )
  }

  /** AI-powered column auto-mapping. */
  async aiAutoMap(
    provider: string,
    fileColumns: string[],
    entityType: string,
    sourceProvider?: string,
    uploadId?: string,
  ): Promise<AutoMapResponse> {
    return await this.makeRequest<AutoMapResponse>(
      `/connectors/erp/${provider}/ai-automap`,
      {
        method: "POST",
        body: JSON.stringify({
          file_columns: fileColumns,
          entity_type: entityType,
          ...(sourceProvider ? { source_provider: sourceProvider } : {}),
          ...(uploadId ? { upload_id: uploadId } : {}),
        }),
      },
    )
  }

  /** Poll export status. */
  async getExportStatus(
    provider: string,
    exportId: string,
  ): Promise<ERPExportStatusResponse> {
    const params = new URLSearchParams({ upload_id: exportId })
    return await this.makeRequest<ERPExportStatusResponse>(
      `/connectors/erp/${provider}/export-status?${params.toString()}`,
      { method: "GET" },
    )
  }

  // ── Generic ERP routes ────────────────────────────────────────────────────

  /** List all supported ERPs (from template + registered connectors). */
  async listERPs(): Promise<{ erps: string[]; connectors: string[] }> {
    return await this.makeRequest<{ erps: string[]; connectors: string[] }>(
      "/connectors/erp/mapping/erps",
      { method: "GET" },
    )
  }

  /** Cross-ERP mapping preview. */
  async mappingPreview(body: {
    source_erp: string
    target_erp: string
    entity_type: string
    source_columns: string[]
    target_fields?: Record<string, unknown>
  }): Promise<MappingPreviewResponse> {
    return await this.makeRequest<MappingPreviewResponse>(
      "/connectors/erp/mapping/preview",
      { method: "POST", body: JSON.stringify(body) },
    )
  }

  /** Get CDF schema for an entity type. */
  async getMappingSchema(
    entityType: string = "customers",
  ): Promise<{ entity_type: string; cdf_fields: unknown[] }> {
    const params = new URLSearchParams({ entity_type: entityType })
    return await this.makeRequest(
      `/connectors/erp/mapping/schema?${params.toString()}`,
      { method: "GET" },
    )
  }
}

export const erpConnectorsAPI = new ERPConnectorsAPI()
export default erpConnectorsAPI
