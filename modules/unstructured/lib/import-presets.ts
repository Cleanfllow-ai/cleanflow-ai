/**
 * import-presets.ts
 *
 * localStorage-backed preset store for the Unstructured Import wizard.
 *
 * Stores up to MAX_PRESETS snapshots of the full JobSpec form so a power
 * user re-running the same daily import doesn't have to re-type the Drive
 * folder ID, glob pattern, schema, and augmentation rule every time.
 *
 * Pure FE today. Follow-up work to mirror these into a DDB table is
 * intentionally out of scope for this PR.
 */

import type {
  UnstructuredJobFilter,
  UnstructuredJobSource,
  UnstructuredSchemaId,
} from '../types/unstructured.types'

const STORAGE_KEY = 'cleanflowai.unstructured.presets'
const MAX_PRESETS = 20

export interface UnstructuredImportPreset {
  /** Stable id (millisecond-precision createdAt suffices — entries are tiny). */
  id: string
  /** User-supplied label shown in the dropdown. */
  name: string
  source: UnstructuredJobSource
  filter: UnstructuredJobFilter
  schemaId: UnstructuredSchemaId
  augmentationRule: string | null
  /** ISO timestamp — used for ordering (newest first) + LRU eviction. */
  createdAt: string
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function safeParse(raw: string | null): UnstructuredImportPreset[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Drop entries that don't match the expected shape — defensive against
    // older payloads or hand-edits.
    return parsed.filter(
      (p): p is UnstructuredImportPreset =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as UnstructuredImportPreset).id === 'string' &&
        typeof (p as UnstructuredImportPreset).name === 'string' &&
        typeof (p as UnstructuredImportPreset).createdAt === 'string' &&
        typeof (p as UnstructuredImportPreset).source === 'object' &&
        typeof (p as UnstructuredImportPreset).filter === 'object',
    )
  } catch {
    return []
  }
}

export function listPresets(): UnstructuredImportPreset[] {
  if (!isBrowser()) return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const list = safeParse(raw)
  // Newest first for the dropdown.
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function writeAll(list: UnstructuredImportPreset[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* localStorage full or disabled — swallow; presets are a convenience. */
  }
}

export interface SavePresetInput {
  name: string
  source: UnstructuredJobSource
  filter: UnstructuredJobFilter
  schemaId: UnstructuredSchemaId
  augmentationRule: string | null
}

export function savePreset(input: SavePresetInput): UnstructuredImportPreset {
  const now = new Date().toISOString()
  const entry: UnstructuredImportPreset = {
    id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || 'Untitled preset',
    source: input.source,
    filter: input.filter,
    schemaId: input.schemaId,
    augmentationRule: input.augmentationRule,
    createdAt: now,
  }
  const existing = listPresets()
  // Insert newest at the head, then LRU-evict so we keep the cap.
  const next = [entry, ...existing].slice(0, MAX_PRESETS)
  writeAll(next)
  return entry
}

export function deletePreset(id: string): void {
  const remaining = listPresets().filter((p) => p.id !== id)
  writeAll(remaining)
}

export function getPreset(id: string): UnstructuredImportPreset | null {
  return listPresets().find((p) => p.id === id) ?? null
}

export const PRESET_CAP = MAX_PRESETS
export const PRESET_STORAGE_KEY = STORAGE_KEY
