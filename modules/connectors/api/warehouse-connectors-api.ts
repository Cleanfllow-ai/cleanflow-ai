/**
 * Unified Warehouse Connectors API — warehouse operations parameterized by provider.
 *
 * Uses the backend's existing provider-specific routes:
 *   GET  /{provider}/databases       (e.g. /snowflake/databases)
 *   GET  /{provider}/schemas
 *   GET  /{provider}/tables
 *   GET  /{provider}/table-columns
 *   GET  /{provider}/warehouses
 *   POST /{provider}/import
 *   POST /{provider}/export
 *   POST /{provider}/create-database
 *   POST /{provider}/create-schema
 *   POST /{provider}/ai-automap
 */

import { ConnectorAPIBase } from "./base"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WarehouseMetadataItem {
  name: string
  [key: string]: unknown
}

export interface WarehouseColumn {
  name: string
  type?: string
}

export interface WarehouseImportRequest {
  database?: string
  schema?: string
  table: string
  limit?: number
  warehouse?: string
  filters?: Record<string, unknown>
}

export interface WarehouseImportResponse {
  upload_id?: string
  filename?: string
  records_imported?: number
  status?: string
  message?: string
  [key: string]: unknown
}

export interface WarehouseExportRequest {
  upload_id: string
  target_table: string
  database?: string
  schema?: string
  warehouse?: string
  write_mode?: "insert" | "truncate_insert" | "merge" | "upsert" | "replace"
  merge_key?: string
  column_mapping?: Record<string, string>
}

export interface WarehouseExportResponse {
  status?: string
  rows_affected?: number
  message?: string
  [key: string]: unknown
}

export interface AutoMapResponse {
  mapping: Record<string, string>
  columns_mapped: number
  method?: string
}

// ─── Service ────────────────────────────────────────────────────────────────

class WarehouseConnectorsAPI extends ConnectorAPIBase {
  // ── Metadata browsing ─────────────────────────────────────────────────────

  /** List available databases. */
  async listDatabases(provider: string): Promise<WarehouseMetadataItem[]> {
    const resp = await this.makeRequest<{ items?: WarehouseMetadataItem[]; databases?: WarehouseMetadataItem[] }>(
      `/${provider}/databases`,
      { method: "GET" },
    )
    return resp.items || resp.databases || []
  }

  /** List schemas in a database. */
  async listSchemas(
    provider: string,
    database: string,
  ): Promise<WarehouseMetadataItem[]> {
    const params = new URLSearchParams({ database })
    const resp = await this.makeRequest<{ items?: WarehouseMetadataItem[]; schemas?: WarehouseMetadataItem[] }>(
      `/${provider}/schemas?${params.toString()}`,
      { method: "GET" },
    )
    return resp.items || resp.schemas || []
  }

  /** List tables in a schema. */
  async listTables(
    provider: string,
    database: string,
    schema: string,
  ): Promise<WarehouseMetadataItem[]> {
    const params = new URLSearchParams({ database, schema })
    const resp = await this.makeRequest<{ items?: WarehouseMetadataItem[]; tables?: WarehouseMetadataItem[] }>(
      `/${provider}/tables?${params.toString()}`,
      { method: "GET" },
    )
    return resp.items || resp.tables || []
  }

  /** Describe columns of a table. */
  async getTableColumns(
    provider: string,
    database: string,
    schema: string,
    table: string,
  ): Promise<WarehouseColumn[]> {
    const params = new URLSearchParams({ database, schema, table })
    const resp = await this.makeRequest<{ columns: WarehouseColumn[] }>(
      `/${provider}/table-columns?${params.toString()}`,
      { method: "GET" },
    )
    return resp.columns || []
  }

  /** List available warehouses (Snowflake-specific). */
  async listWarehouses(provider: string): Promise<WarehouseMetadataItem[]> {
    const resp = await this.makeRequest<{ items: WarehouseMetadataItem[] }>(
      `/${provider}/warehouses`,
      { method: "GET" },
    )
    return resp.items || []
  }

  // ── Provisioning (Snowflake-specific) ─────────────────────────────────────

  /** Create a new database. */
  async createDatabase(
    provider: string,
    databaseName: string,
  ): Promise<{ database: string; status: string }> {
    return await this.makeRequest(
      `/${provider}/create-database`,
      {
        method: "POST",
        body: JSON.stringify({ database_name: databaseName }),
      },
    )
  }

  /** Create a new schema in a database. */
  async createSchema(
    provider: string,
    database: string,
    schemaName: string,
  ): Promise<{ schema: string; status: string }> {
    return await this.makeRequest(
      `/${provider}/create-schema`,
      {
        method: "POST",
        body: JSON.stringify({ database, schema_name: schemaName }),
      },
    )
  }

  // ── AI Mapping ────────────────────────────────────────────────────────────

  /** AI-powered column auto-mapping for warehouse export. */
  async aiAutoMap(
    provider: string,
    fileColumns: string[],
    targetColumns: string[],
  ): Promise<AutoMapResponse> {
    return await this.makeRequest<AutoMapResponse>(
      `/${provider}/ai-automap`,
      {
        method: "POST",
        body: JSON.stringify({
          file_columns: fileColumns,
          target_columns: targetColumns,
        }),
      },
    )
  }

  // ── Import / Export ───────────────────────────────────────────────────────

  /** Import a table from a warehouse into CleanFlow. */
  async importData(
    provider: string,
    request: WarehouseImportRequest,
  ): Promise<WarehouseImportResponse> {
    return await this.makeRequest<WarehouseImportResponse>(
      `/${provider}/import`,
      { method: "POST", body: JSON.stringify(request) },
    )
  }

  /** Export a CleanFlow file to a warehouse table. */
  async exportData(
    provider: string,
    request: WarehouseExportRequest,
  ): Promise<WarehouseExportResponse> {
    return await this.makeRequest<WarehouseExportResponse>(
      `/${provider}/export`,
      { method: "POST", body: JSON.stringify(request) },
    )
  }
}

export const warehouseConnectorsAPI = new WarehouseConnectorsAPI()
export default warehouseConnectorsAPI
