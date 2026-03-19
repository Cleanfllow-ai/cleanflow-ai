'use client'

import { useState, useCallback, useRef } from 'react'
import erpConnectorAPI, {
  type ColumnResolution,
  type MultiExportEntityResult,
  type MultiExportProgress,
} from '@/modules/files/api/erp-connector-api'

export type ExportState =
  | 'idle'
  | 'detecting'
  | 'detected'
  | 'exporting'
  | 'done'
  | 'error'

export interface EntitySummary {
  entity: string
  status: 'pending' | 'running' | 'done' | 'failed'
  success: number
  failed: number
}

export interface MultiEntityExportState {
  exportState: ExportState
  entities: string[]          // ordered entity names from schema-resolve
  resolutions: ColumnResolution[]
  mappedCount: number
  unmappedColumns: string[]
  entityProgress: EntitySummary[]
  finalResults: MultiExportEntityResult[]
  error: string | null
}

export interface UseMultiEntityExportProps {
  uploadId: string | null
  columns: string[]           // column names from the user's file
  provider: string            // "quickbooks" | "zoho-books" | etc.
  orgId?: string
}

export function useMultiEntityExport({
  uploadId,
  columns,
  provider,
  orgId,
}: UseMultiEntityExportProps) {
  const [state, setState] = useState<MultiEntityExportState>({
    exportState: 'idle',
    entities: [],
    resolutions: [],
    mappedCount: 0,
    unmappedColumns: [],
    entityProgress: [],
    finalResults: [],
    error: null,
  })

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  /**
   * Call /erp/schema-resolve to detect entities in the file's columns.
   * Transitions: idle → detecting → detected (or error).
   */
  const detectEntities = useCallback(async () => {
    if (!uploadId || !columns.length) return

    setState(s => ({ ...s, exportState: 'detecting', error: null }))

    try {
      const resp = await erpConnectorAPI.schemaResolve(provider, columns)
      setState(s => ({
        ...s,
        exportState: 'detected',
        entities: resp.entities_needed,
        resolutions: resp.resolutions,
        mappedCount: resp.mapped,
        unmappedColumns: resp.unmapped,
        entityProgress: resp.entities_needed.map(e => ({
          entity: e,
          status: 'pending',
          success: 0,
          failed: 0,
        })),
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        exportState: 'error',
        error: (err as Error).message || 'Failed to detect entities',
      }))
    }
  }, [uploadId, columns, provider])

  /**
   * Call /erp/multi-export and poll /erp/multi-export/status until done.
   * Transitions: detected → exporting → done/error.
   */
  const startExport = useCallback(async () => {
    if (!uploadId || !state.resolutions.length) return

    setState(s => ({ ...s, exportState: 'exporting', error: null }))
    stopPolling()

    // Pass the raw provider string — backend normalise_provider() handles all variants
    // (e.g. "zoho-books" → "zohobooks", "quickbooks_online" → "quickbooks")
    pollRef.current = setInterval(async () => {
      try {
        const progress: MultiExportProgress = await erpConnectorAPI.multiExportStatus(
          provider,
          uploadId
        )
        if (progress?.entities?.length) {
          setState(s => ({
            ...s,
            entityProgress: progress.entities.map(e => ({
              entity: e.entity,
              status: e.status,
              success: e.success,
              failed: e.failed,
            })),
          }))
        }
        // Polling drives state to completion (async path)
        if (progress?.status === 'done') {
          stopPolling()
          const entities = progress.entities ?? []
          const totalExported = entities.reduce((sum, e) => sum + (e.success ?? 0), 0)
          setState(s => ({
            ...s,
            exportState: 'done',
            finalResults: entities.map(e => ({
              entity: e.entity,
              success_count: e.success ?? 0,
              failed_count: e.failed ?? 0,
              errors: [],
            })),
            entityProgress: entities.map(e => ({
              entity: e.entity,
              status: (e.failed ?? 0) > 0 ? 'failed' as const : 'done' as const,
              success: e.success ?? 0,
              failed: e.failed ?? 0,
            })),
          }))
        } else if (progress?.status === 'failed') {
          stopPolling()
          const entities = progress.entities ?? []
          const failedEntity = entities.find(e => e.status === 'failed')
          setState(s => ({
            ...s,
            exportState: 'error',
            error: failedEntity
              ? `${failedEntity.entity} failed — ${failedEntity.failed ?? 0} records rejected`
              : 'Export failed',
            finalResults: entities.map(e => ({
              entity: e.entity,
              success_count: e.success ?? 0,
              failed_count: e.failed ?? 0,
              errors: [],
            })),
            entityProgress: entities.map(e => ({
              entity: e.entity,
              status: (e.failed ?? 0) > 0 ? 'failed' as const : e.status === 'done' ? 'done' as const : 'pending' as const,
              success: e.success ?? 0,
              failed: e.failed ?? 0,
            })),
          }))
        }
      } catch {
        // polling failures are non-fatal
      }
    }, 2000)

    try {
      const result = await erpConnectorAPI.multiExport(
        provider,
        uploadId,
        state.resolutions,
        orgId
      )

      // Async path: backend returns {"status": "processing"} — let polling handle it
      if (result.status === 'processing') {
        return
      }

      // Sync path (backward compat): backend returned final result directly
      stopPolling()
      const results = result.results ?? []

      if (result.status === 'done') {
        setState(s => ({
          ...s,
          exportState: 'done',
          finalResults: results,
          entityProgress: results.map(r => ({
            entity: r.entity,
            status: r.failed_count > 0 ? 'failed' as const : 'done' as const,
            success: r.success_count,
            failed: r.failed_count,
          })),
        }))
      } else {
        const failedEntity = results.find(r => r.failed_count > 0)
        setState(s => ({
          ...s,
          exportState: 'error',
          finalResults: results,
          error: failedEntity
            ? `${failedEntity.entity} failed — ${failedEntity.failed_count} records rejected`
            : 'Export failed',
          entityProgress: results.map(r => ({
            entity: r.entity,
            status: r.failed_count > 0 ? 'failed' as const : 'done' as const,
            success: r.success_count,
            failed: r.failed_count,
          })),
        }))
      }
    } catch (err) {
      // Don't kill the export if polling is still active (async path)
      if (pollRef.current) return
      stopPolling()
      setState(s => ({
        ...s,
        exportState: 'error',
        error: (err as Error).message || 'Export failed',
      }))
    }
  }, [uploadId, state.resolutions, provider, orgId, stopPolling])

  const reset = useCallback(() => {
    stopPolling()
    setState({
      exportState: 'idle',
      entities: [],
      resolutions: [],
      mappedCount: 0,
      unmappedColumns: [],
      entityProgress: [],
      finalResults: [],
      error: null,
    })
  }, [stopPolling])

  return {
    ...state,
    detectEntities,
    startExport,
    reset,
  }
}
