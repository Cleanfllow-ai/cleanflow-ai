/**
 * use-quarantine-config.ts
 *
 * Configuration hook for quarantine editor
 * Provides configurable constants for pagination, rendering, and performance
 */

import type { QuarantineEditorConfig } from '@/modules/files/types'

/**
 * Get quarantine editor configuration
 * All configurable constants in one place for easy tuning
 *
 * @returns Configuration object
 */
export function useQuarantineConfig(): QuarantineEditorConfig {
  return {
    // Pagination
    pageSize: 200, // Rows to fetch per page
    maxRowsInMemory: 10000, // Maximum rows to keep in memory (older rows are trimmed)
    maxEditsPerBatch: 1000, // Maximum edits to send in single API call

    // Autosave
    autosaveDebounceMs: 800, // Debounce time before autosaving edits

    // Virtual scrolling
    rowHeight: 32, // Height of each row in pixels
    headerHeight: 34, // Height of header row in pixels
    overscan: 20, // Number of rows to render outside viewport for smooth scrolling
  }
}
