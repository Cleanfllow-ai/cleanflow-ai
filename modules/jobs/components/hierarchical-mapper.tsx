'use client'

/**
 * HierarchicalMapper
 * ──────────────────
 * A single-canvas, three-level hierarchy mapper modeled on Boomi DataMapper /
 * Workato / Talend. Replaces the per-pair accordion UX with one screen that
 * surfaces every (sourceSystem → sourceEntity → field) → (destField ←
 * destEntity ← destSystem) relationship at once. Both click-to-connect AND
 * drag-to-connect are supported. M:N pipelines are tractable in a single view.
 *
 * Levels (top-down):
 *   1) System block       — collapsible group keyed by provider+side.
 *   2) Entity block       — collapsible group keyed by entity+system+side.
 *   3) Field row          — only rendered while its entity is expanded.
 *
 * Layout:
 *   [ source systems column ]   [ wide gap w/ SVG overlay ]   [ dest systems column ]
 *
 * Lines (SVG, absolute positioned):
 *   - Field-to-field   emerald-500, w=1.5, opacity 0.85   (both sides expanded)
 *   - Entity-to-entity slate-400 dashed 4 3, w=3, op 0.6  (either side collapsed
 *                                                          with ≥1 mapping)
 *   - Ghost drag       slate-400 dashed → indigo-500 solid when over a target
 *
 * Drag interactions:
 *   - Field drag: pointer-down on a SOURCE field row → drag to a DEST field row.
 *     5 px threshold to start drag; ESC cancels. Drop on the matching pair's
 *     pipelineStep adds {srcKey: dstKey} to its column_mapping.
 *   - Entity drag: pointer-down on a SOURCE entity HEADER → drop on DEST entity
 *     HEADER → bulk auto-pair fields by case-insensitive name match (only
 *     fills empties; doesn't overwrite).
 *   - Priority drag: GripVertical handle on LEFT entity headers → reorders
 *     entities within the same system block. Calls setEntityPriority with the
 *     flattened global ordering.
 *   - Click-to-connect fallback: pointer-up on the same source field
 *     (no drag) → "selecting" mode, then click a dest field to commit.
 *
 * Schema fetch:
 *   Per (provider, entity, side) leaf, fetched lazily on first expansion of
 *   the entity. Cached in a Record<string, FieldDef[]>. Routing mirrors
 *   `mapping-panel.tsx`:
 *     erp        → erpConnectorsAPI.getEntityFields
 *     warehouse  → warehouseConnectorsAPI.getTableColumns
 *     storage    → connectorsAPI.getEntityFields
 *
 * Out of scope (V1):
 *   - No nested entity-inside-entity tree
 *   - No "merge mappings" UX for fan-in/fan-out
 *   - No template apply/save (lives in MappingPanel)
 *   - No virtualisation
 */

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    GripVertical,
    Loader2,
    Search,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/shared/hooks/use-toast'
import { cn } from '@/shared/lib/utils'
import { ConnectorLogo } from '@/modules/connectors/components/connector-logo'
import {
    connectorsAPI,
    erpConnectorsAPI,
    warehouseConnectorsAPI,
} from '@/modules/connectors'
import type { ProviderCategory } from './use-job-dialog'
import type { PipelineStep, MappingData } from './use-pipeline-builder'
import { getProviderDisplayName } from './job-dialog-constants'
import type { FieldDef } from './column-mapping-editor'

// Re-export so consumers can import FieldDef from this file too.
export type { FieldDef } from './column-mapping-editor'

// ─── Public props ─────────────────────────────────────────────────────────────

export interface HierarchicalMapperProps {
    pipelineSteps: PipelineStep[]
    /** Mapping data keyed by step.step_id. */
    mappingsByPair: Record<string, MappingData>
    setMappingForStep: (stepId: string, mapping: MappingData) => void
    /** Flat ordered list of source entity keys representing global execution order. */
    entityPriority: string[]
    setEntityPriority: (next: string[]) => void
}

// ─── Internal types ───────────────────────────────────────────────────────────

type Side = 'source' | 'dest'

interface SystemNode {
    side: Side
    provider: string
    category: ProviderCategory
    entities: EntityNode[]
}

interface EntityNode {
    side: Side
    provider: string
    category: ProviderCategory
    entity: string
    /** Full pipelineStep records this entity participates in (one per pair). */
    steps: PipelineStep[]
    /** Snapshot of source/dest config — used for the schema fetch routing. */
    config: Record<string, any>
}

interface FieldDrag {
    side: 'source'
    provider: string
    entity: string
    fieldKey: string
    startX: number
    startY: number
    currentX: number
    currentY: number
    active: boolean
    hoveredField: { provider: string; entity: string; fieldKey: string } | null
}

interface EntityDrag {
    fromProvider: string
    fromEntity: string
    startX: number
    startY: number
    currentX: number
    currentY: number
    active: boolean
    hoveredEntity: { provider: string; entity: string } | null
}

interface PriorityDrag {
    provider: string
    entity: string
    startY: number
    /** Y-offset within the row at pickup (so the ghost feels stable). */
    grabOffsetY: number
    currentY: number
    active: boolean
    hoveredIndex: number | null
}

const DRAG_THRESHOLD = 5

// Stable map keys
const sysKey = (side: Side, provider: string) => `${side}:${provider}`
const entKey = (side: Side, provider: string, entity: string) =>
    `${side}:${provider}:${entity}`
const fieldKey = (side: Side, provider: string, entity: string, key: string) =>
    `${side}:${provider}:${entity}:${key}`

// ─── Component ────────────────────────────────────────────────────────────────

export function HierarchicalMapper({
    pipelineSteps,
    mappingsByPair,
    setMappingForStep,
    entityPriority,
    setEntityPriority,
}: HierarchicalMapperProps) {
    const { toast } = useToast()

    // ── Build the system → entity tree from pipelineSteps ────────────────────
    const { sourceSystems, destSystems } = useMemo(
        () => buildSystemTrees(pipelineSteps, entityPriority),
        [pipelineSteps, entityPriority],
    )

    // ── Tree expansion state ─────────────────────────────────────────────────
    // System: ALL providers expanded on mount so users see something immediately.
    const [expandedSystems, setExpandedSystems] = useState<Set<string>>(() => {
        const s = new Set<string>()
        for (const sys of sourceSystems) s.add(sysKey('source', sys.provider))
        for (const sys of destSystems) s.add(sysKey('dest', sys.provider))
        return s
    })
    // Entity: collapsed by default — too noisy with many fields × many entities.
    const [expandedEntities, setExpandedEntities] = useState<Set<string>>(
        new Set<string>(),
    )

    // When pipelineSteps shifts (new providers joined), keep new providers expanded.
    useEffect(() => {
        setExpandedSystems(prev => {
            const next = new Set(prev)
            let changed = false
            for (const sys of sourceSystems) {
                const k = sysKey('source', sys.provider)
                if (!next.has(k)) {
                    next.add(k)
                    changed = true
                }
            }
            for (const sys of destSystems) {
                const k = sysKey('dest', sys.provider)
                if (!next.has(k)) {
                    next.add(k)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [sourceSystems, destSystems])

    const toggleSystem = useCallback((side: Side, provider: string) => {
        setExpandedSystems(prev => {
            const next = new Set(prev)
            const k = sysKey(side, provider)
            if (next.has(k)) next.delete(k)
            else next.add(k)
            return next
        })
    }, [])

    const toggleEntity = useCallback(
        (side: Side, provider: string, entity: string) => {
            setExpandedEntities(prev => {
                const next = new Set(prev)
                const k = entKey(side, provider, entity)
                if (next.has(k)) next.delete(k)
                else next.add(k)
                return next
            })
        },
        [],
    )

    const expandEntity = useCallback(
        (side: Side, provider: string, entity: string) => {
            setExpandedEntities(prev => {
                const k = entKey(side, provider, entity)
                if (prev.has(k)) return prev
                const next = new Set(prev)
                next.add(k)
                return next
            })
        },
        [],
    )

    // ── Schema cache (lazy fetch on first entity expansion) ──────────────────
    const [fieldsCache, setFieldsCache] = useState<Record<string, FieldDef[]>>({})
    const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set())

    // Find the canonical EntityNode for a given (side, provider, entity).
    // Used by both the field fetcher and the entity bulk-pair handler.
    const findEntityNode = useCallback(
        (side: Side, provider: string, entity: string): EntityNode | null => {
            const list = side === 'source' ? sourceSystems : destSystems
            for (const sys of list) {
                if (sys.provider !== provider) continue
                for (const ent of sys.entities) {
                    if (ent.entity === entity) return ent
                }
            }
            return null
        },
        [sourceSystems, destSystems],
    )

    const fetchEntityFields = useCallback(
        async (side: Side, provider: string, entity: string) => {
            const k = entKey(side, provider, entity)
            // Already cached or fetch in flight — bail.
            if (fieldsCache[k] !== undefined) return
            if (loadingFields.has(k)) return

            const node = findEntityNode(side, provider, entity)
            if (!node) return

            setLoadingFields(prev => {
                const next = new Set(prev)
                next.add(k)
                return next
            })

            try {
                const fields = await fetchFieldsForNode(node)
                setFieldsCache(prev => ({ ...prev, [k]: fields }))
            } catch {
                // Best-effort — record an empty array so we don't infinite-retry.
                setFieldsCache(prev => ({ ...prev, [k]: [] }))
            } finally {
                setLoadingFields(prev => {
                    const next = new Set(prev)
                    next.delete(k)
                    return next
                })
            }
        },
        [fieldsCache, loadingFields, findEntityNode],
    )

    // Trigger fetch whenever a new entity is expanded.
    useEffect(() => {
        for (const k of expandedEntities) {
            const [side, provider, entity] = k.split(':') as [Side, string, string]
            if (fieldsCache[k] === undefined && !loadingFields.has(k)) {
                void fetchEntityFields(side, provider, entity)
            }
        }
    }, [expandedEntities, fieldsCache, loadingFields, fetchEntityFields])

    // ── Toolbar state ────────────────────────────────────────────────────────
    const [search, setSearch] = useState('')
    const [filterMode, setFilterMode] = useState<'all' | 'mapped' | 'unmapped'>('all')

    // ── Mapping helpers ──────────────────────────────────────────────────────
    /** Find the pipelineStep that connects (srcProvider,srcEntity)→(dstProvider,dstEntity). */
    const findStep = useCallback(
        (
            sp: string, se: string, dp: string, de: string,
        ): PipelineStep | null => {
            return (
                pipelineSteps.find(
                    s =>
                        s.source_provider === sp
                        && s.source_entity === se
                        && s.dest_provider === dp
                        && s.dest_entity === de,
                ) || null
            )
        },
        [pipelineSteps],
    )

    /** Add a (srcKey → dstKey) mapping for the matching pipelineStep. */
    const addMapping = useCallback(
        (
            sp: string, se: string, dp: string, de: string,
            srcKey: string, dstKey: string,
        ) => {
            const step = findStep(sp, se, dp, de)
            if (!step) {
                // V1: bail with a console warn + toast if the (src,dst) pair
                // isn't a configured pipelineStep. Auto-creating steps from
                // the canvas is a v2 feature.
                // eslint-disable-next-line no-console
                console.warn(
                    '[HierarchicalMapper] No pipelineStep for pair',
                    { sp, se, dp, de, srcKey, dstKey },
                )
                toast({
                    title: 'Cross-system pair not configured',
                    description: `${sp}.${se} → ${dp}.${de} isn't part of the pipeline. Add it on the previous step.`,
                    variant: 'destructive',
                })
                return false
            }
            const prev = mappingsByPair[step.step_id] || { column_mapping: {} }
            const nextCol = { ...(prev.column_mapping || {}), [srcKey]: dstKey }
            setMappingForStep(step.step_id, {
                ...prev,
                column_mapping: nextCol,
                modified: prev.template_id ? true : prev.modified,
            })
            return true
        },
        [findStep, mappingsByPair, setMappingForStep, toast],
    )

    /** Remove an existing (srcKey → dstKey) mapping. */
    const removeMapping = useCallback(
        (
            sp: string, se: string, dp: string, de: string, srcKey: string,
        ) => {
            const step = findStep(sp, se, dp, de)
            if (!step) return
            const prev = mappingsByPair[step.step_id]
            if (!prev) return
            const nextCol = { ...(prev.column_mapping || {}) }
            delete nextCol[srcKey]
            setMappingForStep(step.step_id, {
                ...prev,
                column_mapping: nextCol,
                modified: prev.template_id ? true : prev.modified,
            })
        },
        [findStep, mappingsByPair, setMappingForStep],
    )

    // ── Refs (for SVG line geometry) ─────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null)
    /** DOM nodes for source field rows, keyed by `source:{provider}:{entity}:{key}`. */
    const fieldNodes = useRef<Record<string, HTMLDivElement | null>>({})
    /** Entity header rows, keyed by `{side}:{provider}:{entity}`. */
    const entityHeaderNodes = useRef<Record<string, HTMLDivElement | null>>({})

    // ── Selection (click-to-connect fallback) ────────────────────────────────
    const [selectedSourceField, setSelectedSourceField] = useState<{
        provider: string
        entity: string
        fieldKey: string
    } | null>(null)

    // ── Drag state ───────────────────────────────────────────────────────────
    const [fieldDrag, setFieldDrag] = useState<FieldDrag | null>(null)
    const [entityDrag, setEntityDrag] = useState<EntityDrag | null>(null)
    const [priorityDrag, setPriorityDrag] = useState<PriorityDrag | null>(null)

    // ── Compute lines ────────────────────────────────────────────────────────
    interface Line {
        kind: 'field' | 'entity'
        d: string
        key: string
    }
    const [lines, setLines] = useState<Line[]>([])

    const recomputeLines = useCallback(() => {
        const c = containerRef.current
        if (!c) {
            setLines([])
            return
        }
        const cb = c.getBoundingClientRect()
        const next: Line[] = []

        // Track which (sourceEntity → destEntity) pairs already have at least
        // one field-line drawn. We avoid drawing the entity-summary line over
        // those pairs when both sides are expanded.
        const drewFieldLine = new Set<string>()

        for (const step of pipelineSteps) {
            const mapping = mappingsByPair[step.step_id]?.column_mapping || {}
            if (Object.keys(mapping).length === 0) continue

            const srcExpanded = expandedEntities.has(
                entKey('source', step.source_provider, step.source_entity),
            )
            const dstExpanded = expandedEntities.has(
                entKey('dest', step.dest_provider, step.dest_entity),
            )
            const srcSysOpen = expandedSystems.has(
                sysKey('source', step.source_provider),
            )
            const dstSysOpen = expandedSystems.has(
                sysKey('dest', step.dest_provider),
            )

            const pairKey =
                `${step.source_provider}::${step.source_entity}::${step.dest_provider}::${step.dest_entity}`

            if (srcExpanded && dstExpanded && srcSysOpen && dstSysOpen) {
                // Field-level lines.
                for (const [srcKey, dstKey] of Object.entries(mapping)) {
                    if (!dstKey) continue
                    const sNode = fieldNodes.current[
                        fieldKey('source', step.source_provider, step.source_entity, srcKey)
                    ]
                    const dNode = fieldNodes.current[
                        fieldKey('dest', step.dest_provider, step.dest_entity, dstKey)
                    ]
                    if (!sNode || !dNode) continue
                    const sb = sNode.getBoundingClientRect()
                    const db = dNode.getBoundingClientRect()
                    const x1 = sb.right - cb.left
                    const y1 = sb.top + sb.height / 2 - cb.top
                    const x2 = db.left - cb.left
                    const y2 = db.top + db.height / 2 - cb.top
                    const dx = Math.max(40, (x2 - x1) * 0.45)
                    next.push({
                        kind: 'field',
                        key: `f:${step.step_id}:${srcKey}->${dstKey}`,
                        d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
                    })
                    drewFieldLine.add(pairKey)
                }
            } else {
                // At least one side is collapsed (system or entity) — draw the
                // entity-to-entity summary line. Anchor at the entity header
                // (or the system header if the system is collapsed entirely).
                let sNode: HTMLDivElement | null = null
                if (!srcSysOpen) {
                    sNode = entityHeaderNodes.current[
                        sysKey('source', step.source_provider)
                    ]
                }
                if (!sNode) {
                    sNode = entityHeaderNodes.current[
                        entKey('source', step.source_provider, step.source_entity)
                    ]
                }
                let dNode: HTMLDivElement | null = null
                if (!dstSysOpen) {
                    dNode = entityHeaderNodes.current[
                        sysKey('dest', step.dest_provider)
                    ]
                }
                if (!dNode) {
                    dNode = entityHeaderNodes.current[
                        entKey('dest', step.dest_provider, step.dest_entity)
                    ]
                }
                if (!sNode || !dNode) continue
                const sb = sNode.getBoundingClientRect()
                const db = dNode.getBoundingClientRect()
                const x1 = sb.right - cb.left
                const y1 = sb.top + sb.height / 2 - cb.top
                const x2 = db.left - cb.left
                const y2 = db.top + db.height / 2 - cb.top
                const dx = Math.max(40, (x2 - x1) * 0.45)
                next.push({
                    kind: 'entity',
                    key: `e:${step.step_id}`,
                    d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
                })
            }
        }

        setLines(next)
    }, [pipelineSteps, mappingsByPair, expandedSystems, expandedEntities])

    // Recompute on relevant changes.
    useLayoutEffect(() => {
        recomputeLines()
    }, [recomputeLines, fieldsCache])

    useEffect(() => {
        const handler = () => recomputeLines()
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [recomputeLines])

    // ResizeObserver for container scroll/size changes (e.g. expanding many entities).
    useEffect(() => {
        const c = containerRef.current
        if (!c) return
        const ro = new ResizeObserver(() => recomputeLines())
        ro.observe(c)
        return () => ro.disconnect()
    }, [recomputeLines])

    // Internal scroll listener — recompute when the canvas itself scrolls.
    const onCanvasScroll = useCallback(() => {
        recomputeLines()
    }, [recomputeLines])

    // ── Field drag: pointer event handlers ───────────────────────────────────
    const handleFieldPointerDown = useCallback(
        (
            provider: string,
            entity: string,
            fkey: string,
            e: React.PointerEvent,
        ) => {
            const c = containerRef.current
            if (!c) return
            const cb = c.getBoundingClientRect()
            setFieldDrag({
                side: 'source',
                provider,
                entity,
                fieldKey: fkey,
                startX: e.clientX - cb.left,
                startY: e.clientY - cb.top,
                currentX: e.clientX - cb.left,
                currentY: e.clientY - cb.top,
                active: false,
                hoveredField: null,
            })
        },
        [],
    )

    useEffect(() => {
        if (!fieldDrag) return
        const onMove = (e: PointerEvent) => {
            const c = containerRef.current
            if (!c) return
            const cb = c.getBoundingClientRect()
            const x = e.clientX - cb.left
            const y = e.clientY - cb.top
            const dist = Math.hypot(x - fieldDrag.startX, y - fieldDrag.startY)
            const active = fieldDrag.active || dist > DRAG_THRESHOLD

            // Hit-test against destination FIELD nodes.
            let hovered: FieldDrag['hoveredField'] = null
            if (active) {
                for (const [k, el] of Object.entries(fieldNodes.current)) {
                    if (!el) continue
                    if (!k.startsWith('dest:')) continue
                    const rb = el.getBoundingClientRect()
                    if (
                        e.clientX >= rb.left
                        && e.clientX <= rb.right
                        && e.clientY >= rb.top
                        && e.clientY <= rb.bottom
                    ) {
                        // k = "dest:provider:entity:fieldKey" — splitting on ':' is
                        // unsafe if any value contains a colon, but our composite
                        // keys (provider IDs, entity names, field keys) shouldn't.
                        const [, p, ent, ...rest] = k.split(':')
                        hovered = {
                            provider: p,
                            entity: ent,
                            fieldKey: rest.join(':'),
                        }
                        break
                    }
                }
            }
            setFieldDrag(prev =>
                prev
                    ? { ...prev, currentX: x, currentY: y, active, hoveredField: hovered }
                    : prev,
            )
        }
        const onUp = () => {
            if (fieldDrag.active && fieldDrag.hoveredField) {
                addMapping(
                    fieldDrag.provider,
                    fieldDrag.entity,
                    fieldDrag.hoveredField.provider,
                    fieldDrag.hoveredField.entity,
                    fieldDrag.fieldKey,
                    fieldDrag.hoveredField.fieldKey,
                )
            } else if (!fieldDrag.active) {
                // Treat as click-to-select.
                setSelectedSourceField(prev => {
                    if (
                        prev
                        && prev.provider === fieldDrag.provider
                        && prev.entity === fieldDrag.entity
                        && prev.fieldKey === fieldDrag.fieldKey
                    ) {
                        return null
                    }
                    return {
                        provider: fieldDrag.provider,
                        entity: fieldDrag.entity,
                        fieldKey: fieldDrag.fieldKey,
                    }
                })
            }
            setFieldDrag(null)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setFieldDrag(null)
                setSelectedSourceField(null)
            }
        }
        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('keydown', onKey)
        }
    }, [fieldDrag, addMapping])

    // Click-to-connect fallback: when a source field is selected, clicking a
    // dest field commits the mapping.
    const handleDestFieldClick = useCallback(
        (provider: string, entity: string, fkey: string) => {
            if (!selectedSourceField) return
            addMapping(
                selectedSourceField.provider,
                selectedSourceField.entity,
                provider,
                entity,
                selectedSourceField.fieldKey,
                fkey,
            )
            setSelectedSourceField(null)
        },
        [selectedSourceField, addMapping],
    )

    // ── Entity drag: bulk auto-pair by name ──────────────────────────────────
    const handleEntityHeaderPointerDown = useCallback(
        (
            side: Side,
            provider: string,
            entity: string,
            e: React.PointerEvent,
        ) => {
            // Only source entities initiate the bulk-pair drag.
            if (side !== 'source') return
            // If the user clicked the chevron or the priority grip, those have
            // their own handlers — skip drag init in those cases.
            const target = e.target as HTMLElement
            if (target.closest('[data-stop-entity-drag="1"]')) return
            const c = containerRef.current
            if (!c) return
            const cb = c.getBoundingClientRect()
            setEntityDrag({
                fromProvider: provider,
                fromEntity: entity,
                startX: e.clientX - cb.left,
                startY: e.clientY - cb.top,
                currentX: e.clientX - cb.left,
                currentY: e.clientY - cb.top,
                active: false,
                hoveredEntity: null,
            })
        },
        [],
    )

    useEffect(() => {
        if (!entityDrag) return
        const onMove = (e: PointerEvent) => {
            const c = containerRef.current
            if (!c) return
            const cb = c.getBoundingClientRect()
            const x = e.clientX - cb.left
            const y = e.clientY - cb.top
            const dist = Math.hypot(x - entityDrag.startX, y - entityDrag.startY)
            const active = entityDrag.active || dist > DRAG_THRESHOLD
            let hovered: EntityDrag['hoveredEntity'] = null
            if (active) {
                for (const [k, el] of Object.entries(entityHeaderNodes.current)) {
                    if (!el) continue
                    if (!k.startsWith('dest:')) continue
                    // Skip system-level header keys (only have 2 segments).
                    const parts = k.split(':')
                    if (parts.length !== 3) continue
                    const rb = el.getBoundingClientRect()
                    if (
                        e.clientX >= rb.left
                        && e.clientX <= rb.right
                        && e.clientY >= rb.top
                        && e.clientY <= rb.bottom
                    ) {
                        hovered = { provider: parts[1], entity: parts[2] }
                        break
                    }
                }
            }
            setEntityDrag(prev =>
                prev
                    ? { ...prev, currentX: x, currentY: y, active, hoveredEntity: hovered }
                    : prev,
            )
        }
        const onUp = async () => {
            if (entityDrag.active && entityDrag.hoveredEntity) {
                await bulkAutoPair(
                    entityDrag.fromProvider,
                    entityDrag.fromEntity,
                    entityDrag.hoveredEntity.provider,
                    entityDrag.hoveredEntity.entity,
                )
            }
            setEntityDrag(null)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setEntityDrag(null)
        }
        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('keydown', onKey)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityDrag])

    /** Bulk auto-pair fields by case-insensitive name. Only fills empties. */
    const bulkAutoPair = useCallback(
        async (sp: string, se: string, dp: string, de: string) => {
            const step = findStep(sp, se, dp, de)
            if (!step) {
                toast({
                    title: 'Cross-system pair not configured',
                    description: `${sp}.${se} → ${dp}.${de} isn't part of the pipeline.`,
                    variant: 'destructive',
                })
                return
            }
            // Make sure both sides are fetched. Force-expand them so the user
            // sees the field rows after pairing completes.
            expandEntity('source', sp, se)
            expandEntity('dest', dp, de)

            const sNode = findEntityNode('source', sp, se)
            const dNode = findEntityNode('dest', dp, de)
            if (!sNode || !dNode) return

            const sKey = entKey('source', sp, se)
            const dKey = entKey('dest', dp, de)

            const ensureFields = async (k: string, node: EntityNode) => {
                if (fieldsCache[k] !== undefined) return fieldsCache[k]
                try {
                    const f = await fetchFieldsForNode(node)
                    setFieldsCache(prev => ({ ...prev, [k]: f }))
                    return f
                } catch {
                    setFieldsCache(prev => ({ ...prev, [k]: [] }))
                    return [] as FieldDef[]
                }
            }

            const [srcFields, dstFields] = await Promise.all([
                ensureFields(sKey, sNode),
                ensureFields(dKey, dNode),
            ])

            const dstByLower = new Map<string, string>()
            for (const f of dstFields) {
                dstByLower.set((f.label || f.key).toLowerCase(), f.key)
                dstByLower.set(f.key.toLowerCase(), f.key)
            }

            const existing = mappingsByPair[step.step_id]?.column_mapping || {}
            const usedDestKeys = new Set(Object.values(existing).filter(Boolean))
            const next = { ...existing }
            let added = 0
            for (const f of srcFields) {
                if (next[f.key]) continue // skip already-mapped
                const candidates = [
                    (f.label || '').toLowerCase(),
                    f.key.toLowerCase(),
                ].filter(Boolean)
                let matched: string | null = null
                for (const c of candidates) {
                    const m = dstByLower.get(c)
                    if (m && !usedDestKeys.has(m)) {
                        matched = m
                        break
                    }
                }
                if (matched) {
                    next[f.key] = matched
                    usedDestKeys.add(matched)
                    added++
                }
            }
            const prev = mappingsByPair[step.step_id] || { column_mapping: {} }
            setMappingForStep(step.step_id, {
                ...prev,
                column_mapping: next,
                modified: prev.template_id ? true : prev.modified,
            })
            toast({
                title: added > 0 ? `Auto-mapped ${added} fields` : 'No new matches',
                description:
                    added > 0
                        ? `Matched by name between ${sp}.${se} and ${dp}.${de}.`
                        : 'No unmapped source fields had a name match on the destination side.',
            })
        },
        [
            findStep, findEntityNode, fieldsCache, mappingsByPair,
            setMappingForStep, expandEntity, toast,
        ],
    )

    // ── Priority drag ────────────────────────────────────────────────────────
    /** Collect the source-side entity ordering (within each system) for the priority list. */
    const buildGlobalPriority = useCallback((): string[] => {
        const out: string[] = []
        for (const sys of sourceSystems) {
            for (const ent of sys.entities) out.push(ent.entity)
        }
        return out
    }, [sourceSystems])

    const handlePriorityPointerDown = useCallback(
        (provider: string, entity: string, e: React.PointerEvent) => {
            e.stopPropagation()
            const target = e.currentTarget as HTMLElement
            const rb = target.getBoundingClientRect()
            setPriorityDrag({
                provider,
                entity,
                startY: e.clientY,
                grabOffsetY: e.clientY - rb.top,
                currentY: e.clientY,
                active: false,
                hoveredIndex: null,
            })
        },
        [],
    )

    useEffect(() => {
        if (!priorityDrag) return
        const onMove = (e: PointerEvent) => {
            const dist = Math.abs(e.clientY - priorityDrag.startY)
            const active = priorityDrag.active || dist > DRAG_THRESHOLD

            // Find the system block the dragged entity belongs to (LEFT side).
            const sys = sourceSystems.find(s => s.provider === priorityDrag.provider)
            if (!sys) return

            // Find which entity row the cursor is closest to (within this system only).
            let hoveredIndex: number | null = null
            if (active) {
                let bestIdx = -1
                let bestDist = Infinity
                for (let i = 0; i < sys.entities.length; i++) {
                    const ent = sys.entities[i]
                    const node = entityHeaderNodes.current[
                        entKey('source', sys.provider, ent.entity)
                    ]
                    if (!node) continue
                    const rb = node.getBoundingClientRect()
                    const mid = rb.top + rb.height / 2
                    const d = Math.abs(e.clientY - mid)
                    if (d < bestDist) {
                        bestDist = d
                        bestIdx = i
                    }
                }
                hoveredIndex = bestIdx >= 0 ? bestIdx : null
            }
            setPriorityDrag(prev =>
                prev
                    ? { ...prev, currentY: e.clientY, active, hoveredIndex }
                    : prev,
            )
        }
        const onUp = () => {
            if (
                priorityDrag.active
                && priorityDrag.hoveredIndex !== null
            ) {
                const sys = sourceSystems.find(
                    s => s.provider === priorityDrag.provider,
                )
                if (sys) {
                    const fromIdx = sys.entities.findIndex(
                        e => e.entity === priorityDrag.entity,
                    )
                    const toIdx = priorityDrag.hoveredIndex
                    if (fromIdx >= 0 && fromIdx !== toIdx) {
                        // Compute the new global priority list by reordering
                        // the entities of this one system block.
                        const reorderedSys = [...sys.entities.map(e => e.entity)]
                        const [moved] = reorderedSys.splice(fromIdx, 1)
                        reorderedSys.splice(toIdx, 0, moved)

                        const next: string[] = []
                        for (const s of sourceSystems) {
                            if (s.provider === priorityDrag.provider) {
                                for (const ename of reorderedSys) next.push(ename)
                            } else {
                                for (const e of s.entities) next.push(e.entity)
                            }
                        }
                        setEntityPriority(next)
                    }
                }
            }
            setPriorityDrag(null)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPriorityDrag(null)
        }
        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('keydown', onKey)
        }
    }, [priorityDrag, sourceSystems, setEntityPriority])

    // ── Stats / filter helpers ──────────────────────────────────────────────
    const stats = useMemo(() => {
        let totalMapped = 0
        let totalFields = 0
        for (const step of pipelineSteps) {
            const mapping = mappingsByPair[step.step_id]?.column_mapping || {}
            const mappedKeys = Object.values(mapping).filter(Boolean).length
            totalMapped += mappedKeys
            const sKey = entKey('source', step.source_provider, step.source_entity)
            const sFields = fieldsCache[sKey]
            // We use the source-side field count as the denominator — only
            // count entities whose schema has been fetched. Otherwise fall back
            // to mapping size as a min estimate.
            totalFields += sFields ? sFields.length : Math.max(mappedKeys, 0)
        }
        return { totalMapped, totalFields, pairs: pipelineSteps.length }
    }, [pipelineSteps, mappingsByPair, fieldsCache])

    const matchesSearch = useCallback(
        (f: FieldDef) => {
            if (!search) return true
            const q = search.toLowerCase()
            return (
                (f.key || '').toLowerCase().includes(q)
                || (f.label || '').toLowerCase().includes(q)
            )
        },
        [search],
    )

    /** Whether a given source field row is "mapped" in any pipelineStep. */
    const isSourceFieldMapped = useCallback(
        (provider: string, entity: string, key: string) => {
            for (const step of pipelineSteps) {
                if (
                    step.source_provider === provider
                    && step.source_entity === entity
                ) {
                    const mapping = mappingsByPair[step.step_id]?.column_mapping
                    if (mapping?.[key]) return true
                }
            }
            return false
        },
        [pipelineSteps, mappingsByPair],
    )

    /** Whether a given dest field row is "mapped" — i.e. some source connects to it. */
    const isDestFieldMapped = useCallback(
        (provider: string, entity: string, key: string) => {
            for (const step of pipelineSteps) {
                if (
                    step.dest_provider === provider
                    && step.dest_entity === entity
                ) {
                    const mapping = mappingsByPair[step.step_id]?.column_mapping
                    if (mapping && Object.values(mapping).includes(key)) return true
                }
            }
            return false
        },
        [pipelineSteps, mappingsByPair],
    )

    /** Number of mapped fields for a source entity (across all its dest pairs). */
    const entityMappedCount = useCallback(
        (side: Side, provider: string, entity: string) => {
            let count = 0
            for (const step of pipelineSteps) {
                const mapping = mappingsByPair[step.step_id]?.column_mapping || {}
                if (
                    side === 'source'
                    && step.source_provider === provider
                    && step.source_entity === entity
                ) {
                    count += Object.values(mapping).filter(Boolean).length
                } else if (
                    side === 'dest'
                    && step.dest_provider === provider
                    && step.dest_entity === entity
                ) {
                    count += Object.values(mapping).filter(Boolean).length
                }
            }
            return count
        },
        [pipelineSteps, mappingsByPair],
    )

    // ── Empty state ──────────────────────────────────────────────────────────
    if (pipelineSteps.length === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    No source-destination pairs configured yet. Go back and add at least one.
                </AlertDescription>
            </Alert>
        )
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="rounded-lg border bg-card p-4 space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search fields by name…"
                        className="pl-8 h-9 text-xs"
                    />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                    {(['all', 'mapped', 'unmapped'] as const).map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setFilterMode(opt)}
                            className={cn(
                                'px-2 py-0.5 rounded-full border transition-colors capitalize',
                                filterMode === opt
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted/70',
                            )}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
                <div className="ml-auto text-[11px] text-muted-foreground">
                    {stats.pairs} pair{stats.pairs === 1 ? '' : 's'} ·{' '}
                    <span className="font-medium text-foreground">
                        {stats.totalMapped}
                    </span>
                    /{stats.totalFields} fields mapped
                </div>
            </div>

            {/* Status hint when in click-to-connect or drag mode */}
            <div className="text-[11px] text-muted-foreground min-h-4">
                {fieldDrag?.active && (
                    <span>
                        Drag to a destination field… release to connect, ESC to cancel.
                    </span>
                )}
                {!fieldDrag?.active && entityDrag?.active && (
                    <span>
                        Drop on a destination entity to bulk-pair fields by name. ESC to cancel.
                    </span>
                )}
                {!fieldDrag?.active && !entityDrag?.active && selectedSourceField && (
                    <span>
                        Click a destination field to connect{' '}
                        <code className="bg-muted px-1 rounded">
                            {selectedSourceField.fieldKey}
                        </code>
                        . ESC cancels.
                    </span>
                )}
            </div>

            {/* Canvas */}
            <div
                ref={containerRef}
                onScroll={onCanvasScroll}
                className="relative grid grid-cols-2 gap-x-20 lg:gap-x-32 max-h-[640px] overflow-y-auto py-1"
            >
                {/* SOURCE column */}
                <div className="space-y-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 sticky top-0 bg-card z-10 py-1">
                        Source
                    </div>
                    {sourceSystems.length === 0 && (
                        <div className="text-xs text-muted-foreground italic px-2 py-1">
                            No source systems configured.
                        </div>
                    )}
                    {sourceSystems.map(sys => (
                        <SystemBlock
                            key={`src-${sys.provider}`}
                            side="source"
                            system={sys}
                            expanded={expandedSystems.has(sysKey('source', sys.provider))}
                            expandedEntities={expandedEntities}
                            onToggleSystem={() => toggleSystem('source', sys.provider)}
                            onToggleEntity={(entity: string) =>
                                toggleEntity('source', sys.provider, entity)
                            }
                            entityMappedCount={(entity: string) =>
                                entityMappedCount('source', sys.provider, entity)
                            }
                            fieldsCache={fieldsCache}
                            loadingFields={loadingFields}
                            search={search}
                            filterMode={filterMode}
                            matchesSearch={matchesSearch}
                            isFieldMapped={(p, ent, key) =>
                                isSourceFieldMapped(p, ent, key)
                            }
                            selectedSourceField={selectedSourceField}
                            fieldNodesRef={fieldNodes}
                            entityHeaderNodesRef={entityHeaderNodes}
                            onFieldPointerDown={handleFieldPointerDown}
                            onEntityHeaderPointerDown={handleEntityHeaderPointerDown}
                            // priority drag is source-only
                            onPriorityPointerDown={handlePriorityPointerDown}
                            priorityDragging={priorityDrag}
                            entityDrag={entityDrag}
                        />
                    ))}
                </div>

                {/* DEST column */}
                <div className="space-y-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 sticky top-0 bg-card z-10 py-1">
                        Destination
                    </div>
                    {destSystems.length === 0 && (
                        <div className="text-xs text-muted-foreground italic px-2 py-1">
                            No destination systems configured.
                        </div>
                    )}
                    {destSystems.map(sys => (
                        <SystemBlock
                            key={`dst-${sys.provider}`}
                            side="dest"
                            system={sys}
                            expanded={expandedSystems.has(sysKey('dest', sys.provider))}
                            expandedEntities={expandedEntities}
                            onToggleSystem={() => toggleSystem('dest', sys.provider)}
                            onToggleEntity={(entity: string) =>
                                toggleEntity('dest', sys.provider, entity)
                            }
                            entityMappedCount={(entity: string) =>
                                entityMappedCount('dest', sys.provider, entity)
                            }
                            fieldsCache={fieldsCache}
                            loadingFields={loadingFields}
                            search={search}
                            filterMode={filterMode}
                            matchesSearch={matchesSearch}
                            isFieldMapped={(p, ent, key) =>
                                isDestFieldMapped(p, ent, key)
                            }
                            selectedSourceField={selectedSourceField}
                            fieldNodesRef={fieldNodes}
                            entityHeaderNodesRef={entityHeaderNodes}
                            onDestFieldClick={handleDestFieldClick}
                            entityDrag={entityDrag}
                        />
                    ))}
                </div>

                {/* SVG overlay */}
                <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: '100%', height: '100%' }}
                >
                    {lines.map(l =>
                        l.kind === 'field' ? (
                            <path
                                key={l.key}
                                d={l.d}
                                fill="none"
                                stroke="rgb(16 185 129)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                opacity="0.85"
                            />
                        ) : (
                            // entity-summary line: clickable so the user can
                            // expand both sides at once.
                            <g key={l.key} className="pointer-events-auto cursor-pointer">
                                <path
                                    d={l.d}
                                    fill="none"
                                    stroke="rgb(148 163 184)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray="4 3"
                                    opacity="0.6"
                                    onClick={() => {
                                        // Expand both sides so the user can see
                                        // the field-level lines.
                                        const stepId = l.key.slice(2) // strip "e:" prefix
                                        const step = pipelineSteps.find(s => s.step_id === stepId)
                                        if (!step) return
                                        if (
                                            !expandedSystems.has(
                                                sysKey('source', step.source_provider),
                                            )
                                        ) {
                                            setExpandedSystems(prev => {
                                                const next = new Set(prev)
                                                next.add(sysKey('source', step.source_provider))
                                                next.add(sysKey('dest', step.dest_provider))
                                                return next
                                            })
                                        }
                                        expandEntity(
                                            'source',
                                            step.source_provider,
                                            step.source_entity,
                                        )
                                        expandEntity(
                                            'dest',
                                            step.dest_provider,
                                            step.dest_entity,
                                        )
                                    }}
                                />
                            </g>
                        ),
                    )}
                    {/* Field-drag ghost line */}
                    {fieldDrag?.active && (() => {
                        const c = containerRef.current
                        if (!c) return null
                        const cb = c.getBoundingClientRect()
                        const sNode = fieldNodes.current[
                            fieldKey('source', fieldDrag.provider, fieldDrag.entity, fieldDrag.fieldKey)
                        ]
                        if (!sNode) return null
                        const sb = sNode.getBoundingClientRect()
                        const x1 = sb.right - cb.left
                        const y1 = sb.top + sb.height / 2 - cb.top

                        let x2 = fieldDrag.currentX
                        let y2 = fieldDrag.currentY
                        if (fieldDrag.hoveredField) {
                            const dNode = fieldNodes.current[
                                fieldKey(
                                    'dest',
                                    fieldDrag.hoveredField.provider,
                                    fieldDrag.hoveredField.entity,
                                    fieldDrag.hoveredField.fieldKey,
                                )
                            ]
                            if (dNode) {
                                const db = dNode.getBoundingClientRect()
                                x2 = db.left - cb.left
                                y2 = db.top + db.height / 2 - cb.top
                            }
                        }
                        const dx = Math.max(40, (x2 - x1) * 0.45)
                        return (
                            <path
                                d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                                fill="none"
                                stroke={
                                    fieldDrag.hoveredField
                                        ? 'rgb(99 102 241)'
                                        : 'rgb(148 163 184)'
                                }
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeDasharray={fieldDrag.hoveredField ? '0' : '4 3'}
                                opacity={fieldDrag.hoveredField ? '0.95' : '0.7'}
                            />
                        )
                    })()}
                    {/* Entity-drag ghost line */}
                    {entityDrag?.active && (() => {
                        const c = containerRef.current
                        if (!c) return null
                        const cb = c.getBoundingClientRect()
                        const sNode = entityHeaderNodes.current[
                            entKey('source', entityDrag.fromProvider, entityDrag.fromEntity)
                        ]
                        if (!sNode) return null
                        const sb = sNode.getBoundingClientRect()
                        const x1 = sb.right - cb.left
                        const y1 = sb.top + sb.height / 2 - cb.top
                        let x2 = entityDrag.currentX
                        let y2 = entityDrag.currentY
                        if (entityDrag.hoveredEntity) {
                            const dNode = entityHeaderNodes.current[
                                entKey(
                                    'dest',
                                    entityDrag.hoveredEntity.provider,
                                    entityDrag.hoveredEntity.entity,
                                )
                            ]
                            if (dNode) {
                                const db = dNode.getBoundingClientRect()
                                x2 = db.left - cb.left
                                y2 = db.top + db.height / 2 - cb.top
                            }
                        }
                        const dx = Math.max(40, (x2 - x1) * 0.45)
                        return (
                            <path
                                d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                                fill="none"
                                stroke={
                                    entityDrag.hoveredEntity
                                        ? 'rgb(99 102 241)'
                                        : 'rgb(148 163 184)'
                                }
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={entityDrag.hoveredEntity ? '0' : '6 4'}
                                opacity={entityDrag.hoveredEntity ? '0.9' : '0.65'}
                            />
                        )
                    })()}
                </svg>
            </div>
        </div>
    )
}

// ─── SystemBlock ──────────────────────────────────────────────────────────────

interface SystemBlockProps {
    side: Side
    system: SystemNode
    expanded: boolean
    expandedEntities: Set<string>
    onToggleSystem: () => void
    onToggleEntity: (entity: string) => void
    entityMappedCount: (entity: string) => number
    fieldsCache: Record<string, FieldDef[]>
    loadingFields: Set<string>
    search: string
    filterMode: 'all' | 'mapped' | 'unmapped'
    matchesSearch: (f: FieldDef) => boolean
    isFieldMapped: (provider: string, entity: string, key: string) => boolean
    selectedSourceField: { provider: string; entity: string; fieldKey: string } | null
    fieldNodesRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    entityHeaderNodesRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    onFieldPointerDown?: (provider: string, entity: string, fkey: string, e: React.PointerEvent) => void
    onEntityHeaderPointerDown?: (
        side: Side, provider: string, entity: string, e: React.PointerEvent,
    ) => void
    onDestFieldClick?: (provider: string, entity: string, fkey: string) => void
    onPriorityPointerDown?: (provider: string, entity: string, e: React.PointerEvent) => void
    priorityDragging?: PriorityDrag | null
    entityDrag: EntityDrag | null
}

function SystemBlock(props: SystemBlockProps) {
    const {
        side, system, expanded, expandedEntities,
        onToggleSystem, onToggleEntity, entityMappedCount,
        fieldsCache, loadingFields, search, filterMode, matchesSearch,
        isFieldMapped, selectedSourceField,
        fieldNodesRef, entityHeaderNodesRef,
        onFieldPointerDown, onEntityHeaderPointerDown, onDestFieldClick,
        onPriorityPointerDown, priorityDragging, entityDrag,
    } = props

    const totalEntities = system.entities.length

    return (
        <div className="rounded-md border border-border/60 bg-muted/10">
            {/* System header */}
            <div
                ref={el => {
                    entityHeaderNodesRef.current[sysKey(side, system.provider)] = el
                }}
                onClick={onToggleSystem}
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded-md select-none"
            >
                {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <ConnectorLogo
                    provider={system.provider}
                    size="xs"
                />
                <span className="text-xs font-semibold truncate">
                    {getProviderDisplayName(system.provider)}
                </span>
                <Badge variant="outline" className="text-[10px] ml-auto">
                    {totalEntities} entit{totalEntities === 1 ? 'y' : 'ies'}
                </Badge>
            </div>

            {/* Entities */}
            {expanded && (
                <div className="px-1.5 pb-1.5 space-y-1">
                    {system.entities.map(ent => (
                        <EntityBlock
                            key={`${side}:${system.provider}:${ent.entity}`}
                            side={side}
                            entity={ent}
                            expanded={expandedEntities.has(
                                entKey(side, system.provider, ent.entity),
                            )}
                            mappedCount={entityMappedCount(ent.entity)}
                            cachedFields={fieldsCache[
                                entKey(side, system.provider, ent.entity)
                            ]}
                            loading={loadingFields.has(
                                entKey(side, system.provider, ent.entity),
                            )}
                            onToggle={() => onToggleEntity(ent.entity)}
                            search={search}
                            filterMode={filterMode}
                            matchesSearch={matchesSearch}
                            isFieldMapped={isFieldMapped}
                            selectedSourceField={selectedSourceField}
                            fieldNodesRef={fieldNodesRef}
                            entityHeaderNodesRef={entityHeaderNodesRef}
                            onFieldPointerDown={onFieldPointerDown}
                            onEntityHeaderPointerDown={onEntityHeaderPointerDown}
                            onDestFieldClick={onDestFieldClick}
                            onPriorityPointerDown={onPriorityPointerDown}
                            priorityDragging={priorityDragging}
                            entityDrag={entityDrag}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── EntityBlock ──────────────────────────────────────────────────────────────

interface EntityBlockProps {
    side: Side
    entity: EntityNode
    expanded: boolean
    mappedCount: number
    cachedFields: FieldDef[] | undefined
    loading: boolean
    onToggle: () => void
    search: string
    filterMode: 'all' | 'mapped' | 'unmapped'
    matchesSearch: (f: FieldDef) => boolean
    isFieldMapped: (provider: string, entity: string, key: string) => boolean
    selectedSourceField: { provider: string; entity: string; fieldKey: string } | null
    fieldNodesRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    entityHeaderNodesRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    onFieldPointerDown?: (provider: string, entity: string, fkey: string, e: React.PointerEvent) => void
    onEntityHeaderPointerDown?: (
        side: Side, provider: string, entity: string, e: React.PointerEvent,
    ) => void
    onDestFieldClick?: (provider: string, entity: string, fkey: string) => void
    onPriorityPointerDown?: (provider: string, entity: string, e: React.PointerEvent) => void
    priorityDragging?: PriorityDrag | null
    entityDrag: EntityDrag | null
}

function EntityBlock(props: EntityBlockProps) {
    const {
        side, entity, expanded, mappedCount, cachedFields, loading, onToggle,
        filterMode, matchesSearch, isFieldMapped, selectedSourceField,
        fieldNodesRef, entityHeaderNodesRef,
        onFieldPointerDown, onEntityHeaderPointerDown, onDestFieldClick,
        onPriorityPointerDown, priorityDragging, entityDrag,
    } = props

    const fields = cachedFields || []
    const total = fields.length
    const hKey = entKey(side, entity.provider, entity.entity)

    const isPriorityDragging =
        side === 'source'
        && priorityDragging?.active
        && priorityDragging.entity === entity.entity
        && priorityDragging.provider === entity.provider

    const isHoveredAsDestEntity =
        side === 'dest'
        && entityDrag?.active
        && entityDrag.hoveredEntity?.provider === entity.provider
        && entityDrag.hoveredEntity?.entity === entity.entity

    // Filter the field rows according to toolbar state.
    const visibleFields = fields.filter(f => {
        if (!matchesSearch(f)) return false
        const mapped = isFieldMapped(entity.provider, entity.entity, f.key)
        if (filterMode === 'mapped' && !mapped) return false
        if (filterMode === 'unmapped' && mapped) return false
        return true
    })

    return (
        <div
            className={cn(
                'rounded border bg-card transition-colors',
                isHoveredAsDestEntity
                    ? 'border-indigo-400 ring-2 ring-indigo-200'
                    : 'border-border/60',
                isPriorityDragging && 'opacity-60',
            )}
        >
            {/* Entity header */}
            <div
                ref={el => {
                    entityHeaderNodesRef.current[hKey] = el
                }}
                onPointerDown={
                    onEntityHeaderPointerDown
                        ? e => onEntityHeaderPointerDown(side, entity.provider, entity.entity, e)
                        : undefined
                }
                onClick={onToggle}
                style={{ touchAction: 'none' }}
                className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded select-none',
                    side === 'source' && 'cursor-grab active:cursor-grabbing',
                )}
            >
                {/* Priority drag handle (LEFT side only) */}
                {side === 'source' && onPriorityPointerDown && (
                    <span
                        data-stop-entity-drag="1"
                        onPointerDown={e =>
                            onPriorityPointerDown(entity.provider, entity.entity, e)
                        }
                        title="Drag to reorder execution priority"
                        className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </span>
                )}

                <span data-stop-entity-drag="1" onClick={(e) => { e.stopPropagation(); onToggle() }}>
                    {expanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                </span>
                <span className="text-xs font-medium truncate">{entity.entity}</span>
                <Badge variant="outline" className="text-[10px] ml-auto">
                    {mappedCount}/{total || '?'} mapped
                </Badge>
            </div>

            {/* Fields */}
            {expanded && (
                <div className="px-1.5 pb-1.5">
                    {loading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading fields…
                        </div>
                    )}
                    {!loading && fields.length === 0 && (
                        <div className="text-[11px] text-muted-foreground italic px-2 py-1">
                            No fields available.
                        </div>
                    )}
                    {!loading && visibleFields.length === 0 && fields.length > 0 && (
                        <div className="text-[11px] text-muted-foreground italic px-2 py-1">
                            No fields match the current filter.
                        </div>
                    )}
                    <div className="space-y-1">
                        {visibleFields.map(f => {
                            const mapped = isFieldMapped(entity.provider, entity.entity, f.key)
                            const isSelected =
                                side === 'source'
                                && selectedSourceField?.provider === entity.provider
                                && selectedSourceField?.entity === entity.entity
                                && selectedSourceField?.fieldKey === f.key
                            const fnKey = fieldKey(side, entity.provider, entity.entity, f.key)
                            return (
                                <div
                                    key={f.key}
                                    ref={el => {
                                        fieldNodesRef.current[fnKey] = el
                                    }}
                                    onPointerDown={
                                        side === 'source' && onFieldPointerDown
                                            ? e => onFieldPointerDown(
                                                entity.provider, entity.entity, f.key, e,
                                            )
                                            : undefined
                                    }
                                    onClick={
                                        side === 'dest' && onDestFieldClick
                                            ? () => onDestFieldClick(
                                                entity.provider, entity.entity, f.key,
                                            )
                                            : undefined
                                    }
                                    style={{ touchAction: 'none' }}
                                    className={cn(
                                        'flex items-center px-2 py-1 rounded border text-[11px] transition-colors select-none',
                                        side === 'source' && 'cursor-grab active:cursor-grabbing',
                                        side === 'dest' && selectedSourceField && 'cursor-pointer hover:border-primary/60',
                                        isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
                                        !isSelected && mapped && 'border-emerald-300 bg-emerald-50/40',
                                        !isSelected && !mapped && 'border-border/50 bg-card hover:border-primary/40',
                                    )}
                                >
                                    {side === 'dest' && (
                                        <span
                                            className={cn(
                                                'h-2 w-2 rounded-full mr-2 flex-shrink-0',
                                                mapped ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                                            )}
                                        />
                                    )}
                                    <span className="truncate" title={f.key}>
                                        {f.label || f.key}
                                        {f.required && (
                                            <span className="text-red-500 ml-1">*</span>
                                        )}
                                    </span>
                                    {side === 'source' && (
                                        <span
                                            className={cn(
                                                'h-2 w-2 rounded-full ml-auto flex-shrink-0',
                                                mapped ? 'bg-emerald-500' : isSelected ? 'bg-primary' : 'bg-muted-foreground/30',
                                            )}
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the (system → entity) tree for both sides from pipelineSteps. Source
 * entities are sorted by entityPriority when present (with unmentioned entities
 * appended in their natural order so adding new ones is non-destructive).
 */
function buildSystemTrees(
    pipelineSteps: PipelineStep[],
    entityPriority: string[],
): { sourceSystems: SystemNode[]; destSystems: SystemNode[] } {
    // Two parallel maps: provider → entity → EntityNode.
    const srcMap = new Map<string, Map<string, EntityNode>>()
    const dstMap = new Map<string, Map<string, EntityNode>>()
    const srcCategory = new Map<string, ProviderCategory>()
    const dstCategory = new Map<string, ProviderCategory>()

    for (const step of pipelineSteps) {
        const sCat = srcCategory.get(step.source_provider) || step.source_category
        srcCategory.set(step.source_provider, sCat)
        const dCat = dstCategory.get(step.dest_provider) || step.dest_category
        dstCategory.set(step.dest_provider, dCat)

        let sEntities = srcMap.get(step.source_provider)
        if (!sEntities) {
            sEntities = new Map()
            srcMap.set(step.source_provider, sEntities)
        }
        let sNode = sEntities.get(step.source_entity)
        if (!sNode) {
            sNode = {
                side: 'source',
                provider: step.source_provider,
                category: step.source_category,
                entity: step.source_entity,
                steps: [],
                config: step.source_config || {},
            }
            sEntities.set(step.source_entity, sNode)
        }
        sNode.steps.push(step)

        let dEntities = dstMap.get(step.dest_provider)
        if (!dEntities) {
            dEntities = new Map()
            dstMap.set(step.dest_provider, dEntities)
        }
        let dNode = dEntities.get(step.dest_entity)
        if (!dNode) {
            dNode = {
                side: 'dest',
                provider: step.dest_provider,
                category: step.dest_category,
                entity: step.dest_entity,
                steps: [],
                config: step.dest_config || {},
            }
            dEntities.set(step.dest_entity, dNode)
        }
        dNode.steps.push(step)
    }

    const sortByPriority = (entities: EntityNode[]): EntityNode[] => {
        if (entityPriority.length === 0) return entities
        const indexOf = new Map<string, number>()
        for (let i = 0; i < entityPriority.length; i++) {
            indexOf.set(entityPriority[i], i)
        }
        return [...entities].sort((a, b) => {
            const ia = indexOf.has(a.entity) ? indexOf.get(a.entity)! : Number.MAX_SAFE_INTEGER
            const ib = indexOf.has(b.entity) ? indexOf.get(b.entity)! : Number.MAX_SAFE_INTEGER
            if (ia !== ib) return ia - ib
            return a.entity.localeCompare(b.entity)
        })
    }

    const sourceSystems: SystemNode[] = []
    for (const [provider, entities] of srcMap.entries()) {
        sourceSystems.push({
            side: 'source',
            provider,
            category: srcCategory.get(provider) || 'erp',
            entities: sortByPriority(Array.from(entities.values())),
        })
    }
    const destSystems: SystemNode[] = []
    for (const [provider, entities] of dstMap.entries()) {
        destSystems.push({
            side: 'dest',
            provider,
            category: dstCategory.get(provider) || 'erp',
            entities: Array.from(entities.values()).sort((a, b) =>
                a.entity.localeCompare(b.entity),
            ),
        })
    }
    return { sourceSystems, destSystems }
}

/**
 * Fetch fields for a specific entity. Routes by category and adapts each API
 * shape to the canonical FieldDef. Mirrors the pattern in MappingPanel.
 */
async function fetchFieldsForNode(node: EntityNode): Promise<FieldDef[]> {
    if (node.category === 'erp') {
        const res = await erpConnectorsAPI.getEntityFields(node.provider, node.entity)
        return (res.fields || []).map((f: any) => ({
            key: f.key || f.name || '',
            label: f.label || f.key || f.name || '',
            data_type: f.data_type || f.type || 'string',
            required: f.required || false,
        })).filter((f: FieldDef) => f.key)
    }
    if (
        node.category === 'warehouse'
        && node.config?.database
        && node.config?.schema
    ) {
        const cols = await warehouseConnectorsAPI.getTableColumns(
            node.provider,
            node.config.database,
            node.config.schema,
            node.entity,
        )
        return cols.map(c => ({
            key: c.name,
            label: c.name,
            data_type: c.type || 'string',
            required: false,
        }))
    }
    // Storage / fallback.
    const params: Record<string, string> = {}
    if (node.config?.database) params.database = String(node.config.database)
    if (node.config?.schema) params.schema = String(node.config.schema)
    if (node.config?.warehouse) params.warehouse = String(node.config.warehouse)
    const res = await connectorsAPI.getEntityFields(
        node.provider,
        node.entity,
        params,
    )
    return (res.fields || []).map((f: any) => ({
        key: f.key || f.name || '',
        label: f.label || f.key || f.name || '',
        data_type: f.data_type || f.type || 'string',
        required: f.required || false,
    })).filter((f: FieldDef) => f.key)
}

export default HierarchicalMapper
