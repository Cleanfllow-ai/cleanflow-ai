"use client"

import { useState, useCallback } from "react"
import { warehouseConnectorsAPI } from "@/modules/connectors/api/warehouse-connectors-api"
import { erpConnectorsAPI } from "@/modules/connectors/api/erp-connectors-api"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import type { WarehouseMetadataItem } from "@/modules/connectors/api/warehouse-connectors-api"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConnectorMetadata {
  warehouses: WarehouseMetadataItem[]
  databases: WarehouseMetadataItem[]
  schemas: Map<string, WarehouseMetadataItem[]>       // key: database
  tables: Map<string, WarehouseMetadataItem[]>         // key: database::schema
  erpEntities: Array<{ key: string; label: string }>
  /** Admin-chosen defaults for Snowflake (warehouse, database) */
  defaults: { warehouse?: string; database?: string }
  lastFetched: number
}

// ─── Module-level cache ─────────────────────────────────────────────────────

const _metadataCache = new Map<string, ConnectorMetadata>()
const _fetchPromises = new Map<string, Promise<void>>()

function makeKey(db: string, schema: string) {
  return `${db}::${schema}`
}

function getOrCreateEntry(provider: string): ConnectorMetadata {
  if (!_metadataCache.has(provider)) {
    _metadataCache.set(provider, {
      warehouses: [],
      databases: [],
      schemas: new Map(),
      tables: new Map(),
      erpEntities: [],
      defaults: {},
      lastFetched: 0,
    })
  }
  return _metadataCache.get(provider)!
}

// ─── Cache TTL (5 minutes) ──────────────────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000

function isFresh(entry: ConnectorMetadata): boolean {
  return Date.now() - entry.lastFetched < CACHE_TTL
}

// ─── Public cache accessors (can be used outside React) ─────────────────────

/** Get cached warehouses for a provider (returns empty array if not cached). */
export function getCachedWarehouses(provider: string): WarehouseMetadataItem[] {
  return _metadataCache.get(provider)?.warehouses || []
}

/** Get cached databases for a provider. */
export function getCachedDatabases(provider: string): WarehouseMetadataItem[] {
  return _metadataCache.get(provider)?.databases || []
}

/** Get cached schemas for a specific database. */
export function getCachedSchemas(provider: string, database: string): WarehouseMetadataItem[] {
  return _metadataCache.get(provider)?.schemas.get(database) || []
}

/** Get cached tables for a specific database + schema. */
export function getCachedTables(provider: string, database: string, schema: string): WarehouseMetadataItem[] {
  return _metadataCache.get(provider)?.tables.get(makeKey(database, schema)) || []
}

/** Get cached ERP entities for a provider. */
export function getCachedERPEntities(provider: string): Array<{ key: string; label: string }> {
  return _metadataCache.get(provider)?.erpEntities || []
}

/** Get admin-chosen defaults (warehouse, database) for a provider. */
export function getCachedDefaults(provider: string): { warehouse?: string; database?: string } {
  return _metadataCache.get(provider)?.defaults || {}
}

/** Set admin-chosen defaults. */
export function setCachedDefaults(provider: string, defaults: { warehouse?: string; database?: string }) {
  const entry = getOrCreateEntry(provider)
  entry.defaults = { ...entry.defaults, ...defaults }
}

/** Invalidate all cached metadata for a provider. */
export function invalidateMetadataCache(provider?: string) {
  if (provider) {
    _metadataCache.delete(provider)
    _fetchPromises.delete(provider)
  } else {
    _metadataCache.clear()
    _fetchPromises.clear()
  }
}

// ─── Prefetch functions ─────────────────────────────────────────────────────

/** Prefetch top-level warehouse metadata (warehouses + databases). Deduplicates concurrent calls. */
export async function prefetchWarehouseMetadata(provider: string): Promise<void> {
  const existing = _metadataCache.get(provider)
  if (existing && isFresh(existing) && existing.databases.length > 0) return

  if (_fetchPromises.has(provider)) {
    return _fetchPromises.get(provider)!
  }

  const promise = (async () => {
    const entry = getOrCreateEntry(provider)
    try {
      const [wh, dbs] = await Promise.all([
        warehouseConnectorsAPI.listWarehouses(provider).catch(() => []),
        warehouseConnectorsAPI.listDatabases(provider).catch(() => []),
      ])
      entry.warehouses = wh
      entry.databases = dbs
      entry.lastFetched = Date.now()

      // Also read defaults from connection status
      try {
        const status = await connectorsAPI.getConnectionStatus(provider)
        const conn = status.connection || {}
        if (conn.warehouse) entry.defaults.warehouse = String(conn.warehouse)
        if (conn.database) entry.defaults.database = String(conn.database)
      } catch { /* ignore */ }
    } catch (err) {
      console.error(`[metadata-cache] Failed to prefetch for ${provider}:`, err)
    } finally {
      _fetchPromises.delete(provider)
    }
  })()

  _fetchPromises.set(provider, promise)
  return promise
}

/** Prefetch schemas for a database (uses cache if fresh). */
export async function prefetchSchemas(provider: string, database: string): Promise<WarehouseMetadataItem[]> {
  const entry = getOrCreateEntry(provider)
  const cached = entry.schemas.get(database)
  if (cached && isFresh(entry)) return cached

  try {
    const schemas = await warehouseConnectorsAPI.listSchemas(provider, database)
    entry.schemas.set(database, schemas)
    entry.lastFetched = Date.now()
    return schemas
  } catch {
    return []
  }
}

/** Prefetch tables for a database + schema (uses cache if fresh). */
export async function prefetchTables(provider: string, database: string, schema: string): Promise<WarehouseMetadataItem[]> {
  const entry = getOrCreateEntry(provider)
  const key = makeKey(database, schema)
  const cached = entry.tables.get(key)
  if (cached && isFresh(entry)) return cached

  try {
    const tables = await warehouseConnectorsAPI.listTables(provider, database, schema)
    entry.tables.set(key, tables)
    entry.lastFetched = Date.now()
    return tables
  } catch {
    return []
  }
}

/** Prefetch ERP entities for a provider. */
export async function prefetchERPEntities(provider: string): Promise<Array<{ key: string; label: string }>> {
  const entry = getOrCreateEntry(provider)
  if (entry.erpEntities.length > 0 && isFresh(entry)) return entry.erpEntities

  try {
    const res = await erpConnectorsAPI.discoverEntities(provider)
    const entities = (res.entities || []).map((e: any) => ({
      key: e.entity || e.key || e.name || "",
      label: e.label || e.entity || e.key || "",
    })).filter((e: { key: string }) => e.key)
    entry.erpEntities = entities
    entry.lastFetched = Date.now()
    return entities
  } catch {
    return []
  }
}

// ─── Connector config helpers (for consumer UIs) ────────────────────────────

/** Deduplication for ensureConnectorConfig calls */
const _configPromises = new Map<string, Promise<{ warehouse?: string; database?: string }>>()

/**
 * Ensure admin-configured warehouse/database defaults are loaded for a provider.
 * Returns the defaults from cache if fresh, otherwise fetches from backend connection status.
 * Consumer UIs (import/export/jobs) should call this instead of fetching warehouse/database lists.
 */
export async function ensureConnectorConfig(provider: string): Promise<{ warehouse?: string; database?: string }> {
  const entry = _metadataCache.get(provider)
  if (entry && isFresh(entry) && (entry.defaults.warehouse || entry.defaults.database)) {
    return entry.defaults
  }

  // Deduplicate concurrent calls
  if (_configPromises.has(provider)) {
    return _configPromises.get(provider)!
  }

  const promise = (async () => {
    const cacheEntry = getOrCreateEntry(provider)
    try {
      const status = await connectorsAPI.getConnectionStatus(provider)
      const conn = (status as any).connection || status || {}
      if (conn.warehouse) cacheEntry.defaults.warehouse = String(conn.warehouse)
      if (conn.database) cacheEntry.defaults.database = String(conn.database)
      cacheEntry.lastFetched = Date.now()
    } catch {
      // ignore — defaults stay empty
    } finally {
      _configPromises.delete(provider)
    }
    return cacheEntry.defaults
  })()

  _configPromises.set(provider, promise)
  return promise
}

/** Prefetch all schemas + tables for a database (deep prefetch). */
export async function prefetchDatabaseDeep(provider: string, database: string): Promise<void> {
  const schemas = await prefetchSchemas(provider, database)
  // Fetch tables for all schemas in parallel
  await Promise.all(
    schemas.map((s) => prefetchTables(provider, database, s.name).catch(() => []))
  )
}

// ─── React Hook ─────────────────────────────────────────────────────────────

/**
 * Hook that provides cached connector metadata with loading states.
 * Uses module-level cache so data persists across component mounts.
 */
export function useConnectorMetadataCache(provider: string, category: string) {
  const [loading, setLoading] = useState(false)

  const prefetch = useCallback(async () => {
    if (!provider) return
    setLoading(true)
    try {
      if (category === "warehouse") {
        await prefetchWarehouseMetadata(provider)
      } else if (category === "erp") {
        await prefetchERPEntities(provider)
      }
    } finally {
      setLoading(false)
    }
  }, [provider, category])

  const getWarehouses = useCallback(() => getCachedWarehouses(provider), [provider])
  const getDatabases = useCallback(() => getCachedDatabases(provider), [provider])
  const getDefaults = useCallback(() => getCachedDefaults(provider), [provider])

  const fetchSchemas = useCallback(async (database: string) => {
    setLoading(true)
    try {
      return await prefetchSchemas(provider, database)
    } finally {
      setLoading(false)
    }
  }, [provider])

  const fetchTables = useCallback(async (database: string, schema: string) => {
    setLoading(true)
    try {
      return await prefetchTables(provider, database, schema)
    } finally {
      setLoading(false)
    }
  }, [provider])

  const invalidate = useCallback(() => {
    invalidateMetadataCache(provider)
  }, [provider])

  return {
    loading,
    prefetch,
    getWarehouses,
    getDatabases,
    getDefaults,
    fetchSchemas,
    fetchTables,
    invalidate,
  }
}
