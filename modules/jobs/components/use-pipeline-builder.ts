'use client'

/**
 * use-pipeline-builder
 * --------------------
 * Composes (does NOT replace) the existing `useJobDialog` hook to add
 * multi-cardinality (1:1, 1:N, N:1) source/destination pipelines.
 *
 * Cardinality rules (enforced at derive level — see `pipelineSteps`):
 *   - 1:1  → 1 source AND 1 destination     → one PipelineStep per (src,dst) pair
 *   - 1:N  → 1 source AND N destinations    → N steps sharing the source
 *   - N:1  → N sources AND 1 destination    → N steps sharing the destination
 *   - M:N  → BLOCKED. The hook throws if asked to derive when both > 1.
 *
 * Anti-patterns this hook intentionally fixes (without removing the legacy
 * fields that the old JobDialog still reads):
 *   - `selectEntity` here is truly additive (toggles membership), unlike
 *     the legacy single-element-replace behaviour kept in `useJobDialog`.
 *   - `destinationEntities: string[]` replaces the single `destinationEntity`
 *     for multi-destination pairs. The legacy single field is still synced
 *     from the first element so JobDialog continues to work unchanged.
 *
 * pipelineSteps are DERIVED from (sources × destinations) using the
 * auto-pair-by-name rule. When entity names mismatch, the consumer can
 * override the pairing via `setManualPair(sourceIndex, destIndex, srcEntity, dstEntity)`.
 */

import { useCallback, useMemo, useState } from 'react'
import { useJobDialog, type UseJobDialogProps, type ProviderCategory } from './use-job-dialog'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SourceEndpoint {
    /** Stable client-side id (e.g. `src-0`, `src-1`) — used for React keys. */
    endpoint_id: string
    provider: string
    category: ProviderCategory
    /** ERP entity keys, warehouse table names, or storage file IDs. */
    entities: string[]
    config: Record<string, any>
}

export interface DestEndpoint {
    endpoint_id: string
    provider: string
    category: ProviderCategory
    entities: string[]
    config: Record<string, any>
}

export type Cardinality = '1:1' | '1:N' | 'N:1'

/**
 * One concrete (sourceEntity → destEntity) pair derived from the
 * source/destination endpoints. The `step_id` is stable across re-renders so
 * mapping data keyed by it survives entity-list edits.
 */
export interface PipelineStep {
    step_id: string
    source_provider: string
    source_category: ProviderCategory
    source_config: Record<string, any>
    source_entity: string
    dest_provider: string
    dest_category: ProviderCategory
    dest_config: Record<string, any>
    dest_entity: string
}

export interface MappingData {
    column_mapping: Record<string, string>
    template_id?: string
    /** Confidence per source field (0..100) when auto-mapped. */
    confidence_map?: Record<string, number>
    /** Method used per source field (template, cdf, local, ai). */
    method_map?: Record<string, string>
    /** True when user has edited a template-applied mapping. */
    modified?: boolean
}

// ─── Step ID helpers ─────────────────────────────────────────────────────────

/** Deterministic step_id derived from the (src,dst) pair so React state is
 *  stable across renders without random UUIDs. */
function stepId(srcProvider: string, srcEntity: string, dstProvider: string, dstEntity: string): string {
    return `${srcProvider}::${srcEntity}::${dstProvider}::${dstEntity}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePipelineBuilderProps extends UseJobDialogProps {}

export function usePipelineBuilder(props: UsePipelineBuilderProps) {
    const dialog = useJobDialog(props)

    // We model multiple endpoints on top of the legacy single-source/single-dest
    // state. The 0th source mirrors `dialog.sourceProvider/Category/Config` +
    // `dialog.entities`; the 0th destination mirrors `dialog.destination*`.
    // Additional endpoints live here so the legacy hook stays untouched.
    const [extraSources, setExtraSources] = useState<SourceEndpoint[]>([])
    const [extraDestinations, setExtraDestinations] = useState<DestEndpoint[]>([])

    // Manual pair overrides, keyed by `${srcEndpointId}::${dstEndpointId}`.
    // Default: auto-pair by entity name. When a user picks an explicit pairing
    // we record `(sourceEntity, destEntity)` here and the derive uses it.
    const [pairOverrides, setPairOverrides] = useState<Record<string, { src_entity: string; dst_entity: string }>>({})

    // Per-step mapping data, keyed by step_id.
    const [mappingsByPair, setMappingsByPair] = useState<Record<string, MappingData>>({})

    // ── Build full source/destination arrays (legacy 0th + extras) ───────────

    const sources: SourceEndpoint[] = useMemo(() => {
        const primary: SourceEndpoint = {
            endpoint_id: 'src-0',
            provider: dialog.sourceProvider,
            category: dialog.sourceCategory,
            entities: dialog.entities,
            config: dialog.sourceConfig,
        }
        return [primary, ...extraSources]
    }, [dialog.sourceProvider, dialog.sourceCategory, dialog.entities, dialog.sourceConfig, extraSources])

    const destinations: DestEndpoint[] = useMemo(() => {
        // The legacy hook stores ONE destination ERP entity in `destinationEntity`.
        // We treat the primary destination's `entities` as
        // [dialog.destinationEntity] (or [] for warehouse target which uses table).
        const primaryEntities: string[] = (() => {
            if (dialog.destinationCategory === 'erp' && dialog.destinationEntity) {
                return [dialog.destinationEntity]
            }
            // Warehouse/storage: use config.table or config.file_id as the entity
            const tbl = dialog.destinationConfig?.table
            if (typeof tbl === 'string' && tbl) return [tbl]
            return []
        })()
        const primary: DestEndpoint = {
            endpoint_id: 'dst-0',
            provider: dialog.destinationProvider,
            category: dialog.destinationCategory,
            entities: primaryEntities,
            config: dialog.destinationConfig,
        }
        return [primary, ...extraDestinations]
    }, [dialog.destinationProvider, dialog.destinationCategory, dialog.destinationEntity, dialog.destinationConfig, extraDestinations])

    // ── Cardinality (derived) ────────────────────────────────────────────────

    const cardinality: Cardinality = useMemo(() => {
        if (sources.length > 1 && destinations.length > 1) {
            // M:N is blocked at the UI level — but if some bug lets state slip
            // through we still report 1:1 to avoid throwing during render.
            // The derive step below WILL throw to make the bug loud.
            return '1:1'
        }
        if (destinations.length > 1) return '1:N'
        if (sources.length > 1) return 'N:1'
        return '1:1'
    }, [sources.length, destinations.length])

    // ── pipelineSteps (derived) ──────────────────────────────────────────────
    //
    // For each (sourceEndpoint, destEndpoint) cross-product we generate ONE
    // step per matched (srcEntity, dstEntity) pair using:
    //
    //   1. Manual override (if `pairOverrides[srcId::dstId]` is set)
    //   2. Same-name auto-pair  (e.g. both ends have `customers`)
    //   3. Cross-product fallback for 1:1 — pair the first entity on each side
    //
    // M:N is rejected with a thrown error so the caller has no choice but to
    // fix the state.

    const pipelineSteps: PipelineStep[] = useMemo(() => {
        if (sources.length > 1 && destinations.length > 1) {
            throw new Error(
                'use-pipeline-builder: M:N pipelines are not supported. ' +
                'Reduce sources or destinations to 1.',
            )
        }

        const steps: PipelineStep[] = []

        for (const src of sources) {
            for (const dst of destinations) {
                if (!src.provider || !dst.provider) continue

                const overrideKey = `${src.endpoint_id}::${dst.endpoint_id}`
                const override = pairOverrides[overrideKey]

                // Build candidate pairs.
                let pairs: { srcEntity: string; dstEntity: string }[] = []

                if (override) {
                    pairs = [{ srcEntity: override.src_entity, dstEntity: override.dst_entity }]
                } else if (src.entities.length === 0 || dst.entities.length === 0) {
                    // Endpoint not yet fully configured — emit nothing for this leg.
                    pairs = []
                } else {
                    // Auto-pair by entity name (case-insensitive). For each
                    // source entity, find a dest entity with the same key.
                    const dstByLower = new Map(dst.entities.map(e => [e.toLowerCase(), e]))
                    for (const sEntity of src.entities) {
                        const match = dstByLower.get(sEntity.toLowerCase())
                        if (match) {
                            pairs.push({ srcEntity: sEntity, dstEntity: match })
                        } else if (src.entities.length === 1 && dst.entities.length === 1) {
                            // Single-on-each-side: pair them even with different names.
                            pairs.push({ srcEntity: sEntity, dstEntity: dst.entities[0] })
                        }
                        // else: skip — UI must surface a "Pair manually" picker.
                    }
                }

                for (const { srcEntity, dstEntity } of pairs) {
                    steps.push({
                        step_id: stepId(src.provider, srcEntity, dst.provider, dstEntity),
                        source_provider: src.provider,
                        source_category: src.category,
                        source_config: src.config,
                        source_entity: srcEntity,
                        dest_provider: dst.provider,
                        dest_category: dst.category,
                        dest_config: dst.config,
                        dest_entity: dstEntity,
                    })
                }
            }
        }
        return steps
    }, [sources, destinations, pairOverrides])

    // ── Source mutations ─────────────────────────────────────────────────────

    /** Add a new (empty) source endpoint. Blocked when destinations.length > 1. */
    const addSource = useCallback(() => {
        if (destinations.length > 1) {
            // M:N guard — UI also hides the button, this is the safety net.
            return
        }
        setExtraSources(prev => [
            ...prev,
            {
                endpoint_id: `src-${prev.length + 1}-${Date.now()}`,
                provider: '',
                category: 'erp',
                entities: [],
                config: {},
            },
        ])
    }, [destinations.length])

    const removeSource = useCallback((endpoint_id: string) => {
        setExtraSources(prev => prev.filter(s => s.endpoint_id !== endpoint_id))
    }, [])

    const updateSource = useCallback((endpoint_id: string, patch: Partial<SourceEndpoint>) => {
        if (endpoint_id === 'src-0') {
            // Primary source maps to the legacy hook's setters.
            if (patch.provider !== undefined) dialog.setSourceProvider(patch.provider)
            if (patch.category !== undefined) dialog.setSourceCategory(patch.category)
            if (patch.entities !== undefined) {
                // Replace entire entities array — used by the EndpointEntry component.
                // Direct setter not exposed; we call clearAllEntities then selectEntity for each.
                // Simpler: the consumer uses selectEntity directly for additive toggling.
                // Here we only patch other fields; entities should be mutated via
                // the dedicated `toggleSourceEntity` helper below.
            }
            if (patch.config !== undefined) {
                Object.entries(patch.config).forEach(([k, v]) => dialog.updateSourceConfig(k, v))
            }
            return
        }
        setExtraSources(prev => prev.map(s => s.endpoint_id === endpoint_id ? { ...s, ...patch } : s))
    }, [dialog])

    /** Truly additive entity toggle — primary or extra source. */
    const toggleSourceEntity = useCallback((endpoint_id: string, entityValue: string) => {
        if (endpoint_id === 'src-0') {
            // The legacy hook's `selectEntity` was rewritten to be truly additive
            // (toggles membership in the entities array), so we delegate directly.
            dialog.selectEntity(entityValue)
            return
        }
        setExtraSources(prev => prev.map(s => s.endpoint_id === endpoint_id
            ? {
                ...s,
                entities: s.entities.includes(entityValue)
                    ? s.entities.filter(e => e !== entityValue)
                    : [...s.entities, entityValue],
            }
            : s,
        ))
    }, [dialog])

    // ── Destination mutations ────────────────────────────────────────────────

    /** Add a new (empty) destination endpoint. Blocked when sources.length > 1. */
    const addDestination = useCallback(() => {
        if (sources.length > 1) return
        setExtraDestinations(prev => [
            ...prev,
            {
                endpoint_id: `dst-${prev.length + 1}-${Date.now()}`,
                provider: '',
                category: 'erp',
                entities: [],
                config: {},
            },
        ])
    }, [sources.length])

    const removeDestination = useCallback((endpoint_id: string) => {
        setExtraDestinations(prev => prev.filter(d => d.endpoint_id !== endpoint_id))
    }, [])

    const updateDestination = useCallback((endpoint_id: string, patch: Partial<DestEndpoint>) => {
        if (endpoint_id === 'dst-0') {
            if (patch.provider !== undefined) dialog.setDestinationProvider(patch.provider)
            if (patch.category !== undefined) dialog.setDestinationCategory(patch.category)
            if (patch.entities !== undefined && patch.entities.length > 0) {
                // Primary destination is single-entity — record the first.
                dialog.setDestinationEntity(patch.entities[0])
            }
            if (patch.config !== undefined) {
                Object.entries(patch.config).forEach(([k, v]) => dialog.updateDestinationConfig(k, v))
            }
            return
        }
        setExtraDestinations(prev => prev.map(d => d.endpoint_id === endpoint_id ? { ...d, ...patch } : d))
    }, [dialog])

    const toggleDestinationEntity = useCallback((endpoint_id: string, entityValue: string) => {
        if (endpoint_id === 'dst-0') {
            // Primary destination ERP is single-select today; toggling mirrors
            // either set or clear.
            dialog.setDestinationEntity(dialog.destinationEntity === entityValue ? '' : entityValue)
            return
        }
        setExtraDestinations(prev => prev.map(d => d.endpoint_id === endpoint_id
            ? {
                ...d,
                entities: d.entities.includes(entityValue)
                    ? d.entities.filter(e => e !== entityValue)
                    : [...d.entities, entityValue],
            }
            : d,
        ))
    }, [dialog])

    // ── Manual pair override ─────────────────────────────────────────────────

    /** Override the auto-pair-by-name resolution for one (src,dst) endpoint pair. */
    const setManualPair = useCallback((srcEndpointId: string, dstEndpointId: string, srcEntity: string, dstEntity: string) => {
        setPairOverrides(prev => ({ ...prev, [`${srcEndpointId}::${dstEndpointId}`]: { src_entity: srcEntity, dst_entity: dstEntity } }))
    }, [])

    const clearManualPair = useCallback((srcEndpointId: string, dstEndpointId: string) => {
        setPairOverrides(prev => {
            const next = { ...prev }
            delete next[`${srcEndpointId}::${dstEndpointId}`]
            return next
        })
    }, [])

    // ── Mapping data ─────────────────────────────────────────────────────────

    const setMappingForStep = useCallback((step_id: string, mapping: MappingData) => {
        setMappingsByPair(prev => ({ ...prev, [step_id]: mapping }))
    }, [])

    const updateMappingForStep = useCallback((step_id: string, patch: Partial<MappingData>) => {
        setMappingsByPair(prev => ({
            ...prev,
            [step_id]: { ...(prev[step_id] || { column_mapping: {} }), ...patch },
        }))
    }, [])

    const clearMappingForStep = useCallback((step_id: string) => {
        setMappingsByPair(prev => {
            const next = { ...prev }
            delete next[step_id]
            return next
        })
    }, [])

    // ── Pipeline steps payload (for POST /jobs) ──────────────────────────────
    //
    // Backend (Agent 2) accepts a `pipeline_steps[]` array on Create/Update Job.
    // We assume the wire shape mirrors the backend dataclass.

    const buildPipelineStepsPayload = useCallback((): Array<{
        step_id: string
        source_provider: string
        source_category: string
        source_config: Record<string, any>
        source_entity: string
        dest_provider: string
        dest_category: string
        dest_config: Record<string, any>
        dest_entity: string
        template_id?: string
        inline_mapping?: Record<string, string>
    }> => {
        return pipelineSteps.map(step => {
            const mapping = mappingsByPair[step.step_id]
            return {
                step_id: step.step_id,
                source_provider: step.source_provider,
                source_category: step.source_category,
                source_config: step.source_config,
                source_entity: step.source_entity,
                dest_provider: step.dest_provider,
                dest_category: step.dest_category,
                dest_config: step.dest_config,
                dest_entity: step.dest_entity,
                ...(mapping?.template_id ? { template_id: mapping.template_id } : {}),
                ...(mapping?.column_mapping && Object.keys(mapping.column_mapping).length > 0
                    ? { inline_mapping: mapping.column_mapping }
                    : {}),
            }
        })
    }, [pipelineSteps, mappingsByPair])

    // ── Public surface ───────────────────────────────────────────────────────

    return {
        // Re-export the legacy hook so consumers can still reach it.
        dialog,

        // Pipeline state
        sources,
        destinations,
        pipelineSteps,
        cardinality,
        mappingsByPair,

        // Source mutations
        addSource,
        removeSource,
        updateSource,
        toggleSourceEntity,

        // Destination mutations
        addDestination,
        removeDestination,
        updateDestination,
        toggleDestinationEntity,

        // Pair overrides
        pairOverrides,
        setManualPair,
        clearManualPair,

        // Mappings
        setMappingForStep,
        updateMappingForStep,
        clearMappingForStep,

        // Submit helpers
        buildPipelineStepsPayload,
    }
}

export type PipelineState = ReturnType<typeof usePipelineBuilder>
