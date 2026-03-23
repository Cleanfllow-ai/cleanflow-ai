'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import {
    jobsAPI, type Job, type JobFrequency, type CreateJobPayload, type UpdateJobPayload,
    frequencyToBackend, frequencyFromBackend
} from '@/modules/jobs/api/jobs-api'
import {
    FREQUENCY_OPTIONS,
    getProviderDisplayName,
    CATEGORY_LABELS,
} from './job-dialog-constants'
import { connectorsAPI, erpConnectorsAPI, warehouseConnectorsAPI } from '@/modules/connectors'
import type { ProviderInfo } from '@/modules/connectors/api/connectors-api'
import type { EntityInfo } from '@/modules/connectors/api/erp-connectors-api'
import type { WarehouseMetadataItem } from '@/modules/connectors/api/warehouse-connectors-api'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UseJobDialogProps {
    open: boolean
    job?: Job | null
    onSuccess: () => void
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderCategory = 'erp' | 'warehouse' | 'storage'

export interface ProviderOption {
    provider_id: string
    display_name: string
    category: string
    connected: boolean
}

export interface EntityOption {
    label: string
    value: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJobDialog({ open, job, onSuccess }: UseJobDialogProps) {
    const isEdit = !!job
    const { toast } = useToast()

    // ── Providers & connections (fetched from backend) ─────────────────────────
    const [allProviders, setAllProviders] = useState<ProviderInfo[]>([])
    const [connectedProviderIds, setConnectedProviderIds] = useState<Set<string>>(new Set())
    const [providersLoading, setProvidersLoading] = useState(false)

    // ── Core fields ───────────────────────────────────────────────────────────
    const [name, setName] = useState("")
    const [sourceCategory, setSourceCategory] = useState<ProviderCategory>("erp")
    const [sourceProvider, setSourceProvider] = useState("")
    const [destinationCategory, setDestinationCategory] = useState<ProviderCategory>("erp")
    const [destinationProvider, setDestinationProvider] = useState("")
    const [frequency, setFrequency] = useState<JobFrequency>("1hr")
    const [cronExpression, setCronExpression] = useState("")

    // ── Entities (multi-select for source) ────────────────────────────────────
    const [entities, setEntities] = useState<string[]>([])
    const [availableEntities, setAvailableEntities] = useState<EntityOption[]>([])
    const [entitiesLoading, setEntitiesLoading] = useState(false)

    // ── Source config (generic) ───────────────────────────────────────────────
    const [sourceConfig, setSourceConfig] = useState<Record<string, any>>({})

    // ── Destination config (generic) ──────────────────────────────────────────
    const [destinationConfig, setDestinationConfig] = useState<Record<string, any>>({})

    // ── Column mapping ────────────────────────────────────────────────────────
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
    const [mappingLoading, setMappingLoading] = useState(false)
    const [autoMapMethod, setAutoMapMethod] = useState("")
    const [showMappingEditor, setShowMappingEditor] = useState(false)
    const [cachedSourceFields, setCachedSourceFields] = useState<Array<{key: string; label?: string; data_type?: string; required?: boolean}>>([])
    const [cachedDestFields, setCachedDestFields] = useState<Array<{key: string; label?: string; data_type?: string; required?: boolean}>>([])

    // ── DQ toggle ─────────────────────────────────────────────────────────────
    const [dqEnabled, setDqEnabled] = useState(true)

    // ── UI state ──────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false)

    // ── Derived: providers filtered by category + connection status ────────────

    const sourceProviders: ProviderOption[] = allProviders
        .filter(p => p.category === sourceCategory)
        .map(p => ({
            ...p,
            connected: connectedProviderIds.has(p.provider_id),
        }))
        .filter(p => p.connected)

    const destinationProviders: ProviderOption[] = allProviders
        .filter(p => p.category === destinationCategory)
        .map(p => ({
            ...p,
            connected: connectedProviderIds.has(p.provider_id),
        }))
        .filter(p => p.connected)

    // ── Fetch providers + connections on dialog open ──────────────────────────

    useEffect(() => {
        if (!open) return
        let cancelled = false
        setProvidersLoading(true)

        Promise.all([
            connectorsAPI.listProviders().catch(() => ({ providers: [] })),
            connectorsAPI.listConnections().catch(() => ({ connections: [] })),
        ]).then(([provResult, connResult]) => {
            if (cancelled) return
            setAllProviders(provResult.providers || [])

            const connectedIds = new Set<string>()
            for (const conn of (connResult.connections || [])) {
                const pid = (conn as any).provider_id || (conn as any).provider
                if (pid) connectedIds.add(pid)
            }
            setConnectedProviderIds(connectedIds)
        }).finally(() => {
            if (!cancelled) setProvidersLoading(false)
        })

        return () => { cancelled = true }
    }, [open])

    // ── Populate / Reset on open ─────────────────────────────────────────────

    useEffect(() => {
        if (!open) return

        if (job) {
            setName(job.name)
            setSourceCategory((job.source_category || "erp") as ProviderCategory)
            setSourceProvider(job.source_provider || "")
            setDestinationCategory((job.destination_category || "erp") as ProviderCategory)
            setDestinationProvider(job.destination_provider || "")
            setEntities(job.entities || [])
            setSourceConfig(job.source_config || {})
            setDestinationConfig(job.destination_config || {})
            setColumnMapping(job.column_mapping || {})
            setDqEnabled(job.dq_config?.mode !== 'default' || true)
            const freq = frequencyFromBackend(job.frequency_type, job.frequency_value)
            setFrequency(freq.frequency)
            setCronExpression(freq.cronExpression)
        } else {
            setName("")
            setSourceCategory("erp")
            setSourceProvider("")
            setDestinationCategory("erp")
            setDestinationProvider("")
            setFrequency("1hr")
            setCronExpression("")
            setEntities([])
            setAvailableEntities([])
            setSourceConfig({})
            setDestinationConfig({})
            setColumnMapping({})
            setAutoMapMethod("")
            setDqEnabled(true)
        }
    }, [job, open])

    // ── Entity discovery: fetch entities when source provider changes ─────────

    useEffect(() => {
        if (!open || !sourceProvider) {
            setAvailableEntities([])
            return
        }
        let cancelled = false
        setEntitiesLoading(true)
        setAvailableEntities([])

        const fetchEntities = async () => {
            try {
                if (sourceCategory === 'erp') {
                    const res = await erpConnectorsAPI.discoverEntities(sourceProvider)
                    if (cancelled) return
                    const opts = (res.entities || []).map((e: EntityInfo) => ({
                        label: e.label || e.name || e.entity || "",
                        value: e.entity || e.value || e.name || "",
                    })).filter((e: EntityOption) => e.value)
                    setAvailableEntities(opts)
                } else if (sourceCategory === 'warehouse') {
                    // For warehouses, entities are tables — user selects via source_config
                    // We can list tables if config has database + schema
                    const db = sourceConfig.database
                    const schema = sourceConfig.schema
                    if (db && schema) {
                        const tables = await warehouseConnectorsAPI.listTables(sourceProvider, db, schema)
                        if (cancelled) return
                        const opts = tables.map((t: WarehouseMetadataItem) => ({
                            label: t.name,
                            value: t.name,
                        }))
                        setAvailableEntities(opts)
                    }
                }
                // Storage category: entities not applicable
            } catch {
                // Silently fail — user sees empty list
            } finally {
                if (!cancelled) setEntitiesLoading(false)
            }
        }

        fetchEntities()
        return () => { cancelled = true }
    }, [open, sourceProvider, sourceCategory, sourceConfig.database, sourceConfig.schema])

    // ── Reset source provider when category changes ──────────────────────────

    useEffect(() => {
        setSourceProvider("")
        setEntities([])
        setAvailableEntities([])
        setSourceConfig({})
    }, [sourceCategory])

    useEffect(() => {
        setDestinationProvider("")
        setDestinationConfig({})
    }, [destinationCategory])

    // ── Reset entities when source provider changes ──────────────────────────

    useEffect(() => {
        setEntities([])
        setSourceConfig({})
    }, [sourceProvider])

    // ── Warehouse metadata helpers (for source_config cascading) ─────────────

    const [warehouseList, setWarehouseList] = useState<WarehouseMetadataItem[]>([])
    const [databaseList, setDatabaseList] = useState<WarehouseMetadataItem[]>([])
    const [schemaList, setSchemaList] = useState<WarehouseMetadataItem[]>([])
    const [warehouseMetaLoading, setWarehouseMetaLoading] = useState(false)

    // Fetch warehouses + databases when warehouse provider selected
    useEffect(() => {
        if (sourceCategory !== 'warehouse' || !sourceProvider) return
        let cancelled = false
        setWarehouseMetaLoading(true)
        Promise.all([
            warehouseConnectorsAPI.listWarehouses(sourceProvider).catch(() => []),
            warehouseConnectorsAPI.listDatabases(sourceProvider).catch(() => []),
        ]).then(([wh, db]) => {
            if (cancelled) return
            setWarehouseList(wh)
            setDatabaseList(db)
        }).finally(() => { if (!cancelled) setWarehouseMetaLoading(false) })
        return () => { cancelled = true }
    }, [sourceCategory, sourceProvider])

    // Fetch schemas when database selected
    useEffect(() => {
        if (sourceCategory !== 'warehouse' || !sourceProvider || !sourceConfig.database) {
            setSchemaList([])
            return
        }
        let cancelled = false
        warehouseConnectorsAPI.listSchemas(sourceProvider, sourceConfig.database).then(schemas => {
            if (!cancelled) setSchemaList(schemas)
        }).catch(() => { if (!cancelled) setSchemaList([]) })
        return () => { cancelled = true }
    }, [sourceCategory, sourceProvider, sourceConfig.database])

    // ── Entity toggle helper ─────────────────────────────────────────────────

    const toggleEntity = useCallback((entityValue: string) => {
        setEntities(prev =>
            prev.includes(entityValue)
                ? prev.filter(e => e !== entityValue)
                : [...prev, entityValue]
        )
    }, [])

    const selectAllEntities = useCallback(() => {
        setEntities(availableEntities.map(e => e.value))
    }, [availableEntities])

    const clearAllEntities = useCallback(() => {
        setEntities([])
    }, [])

    // ── Source config setter helpers ──────────────────────────────────────────

    const updateSourceConfig = useCallback((key: string, value: any) => {
        setSourceConfig(prev => {
            const next = { ...prev, [key]: value }
            // Clear downstream when parent changes
            if (key === 'database') {
                delete next.schema
                delete next.table
            }
            if (key === 'schema') {
                delete next.table
            }
            return next
        })
    }, [])

    const updateDestinationConfig = useCallback((key: string, value: any) => {
        setDestinationConfig(prev => ({ ...prev, [key]: value }))
    }, [])

    // ── Auto-map column mapping ──────────────────────────────────────────────

    const handleAutoMap = useCallback(async () => {
        if (!sourceProvider || entities.length === 0) {
            toast({ title: "Select source and entities first", variant: "destructive" })
            return
        }
        setMappingLoading(true)
        try {
            if (sourceCategory === 'erp' && destinationCategory === 'erp') {
                // ERP-to-ERP: fetch source entity fields, then AI auto-map to destination
                const sourceFields = await erpConnectorsAPI.getEntityFields(sourceProvider, entities[0])
                const sourceFieldNames = (sourceFields.fields || []).map((f: any) => f.key || f.name || f.field_name || "")
                    .filter(Boolean)
                if (sourceFieldNames.length === 0) {
                    toast({ title: "No source fields found", description: "Could not fetch fields for source entity.", variant: "destructive" })
                    setMappingLoading(false)
                    return
                }
                const res = await erpConnectorsAPI.aiAutoMap(
                    destinationProvider,
                    sourceFieldNames,
                    entities[0],
                    sourceProvider,
                )
                if (res.mapping && Object.keys(res.mapping).length > 0) {
                    setColumnMapping(res.mapping)
                    setAutoMapMethod(res.method || "ai")
                    toast({
                        title: "Mapping Complete",
                        description: `Mapped ${res.columns_mapped || Object.keys(res.mapping).length} columns via ${res.method || "ai"}`,
                    })
                } else {
                    toast({ title: "No mappings found", description: "Could not auto-map columns.", variant: "destructive" })
                }
            } else if (sourceCategory === 'warehouse' || destinationCategory === 'warehouse') {
                // Warehouse mapping: fetch source fields, then auto-map
                const whProvider = sourceCategory === 'warehouse' ? sourceProvider : destinationProvider
                const srcProvider = sourceCategory === 'erp' ? sourceProvider : sourceProvider
                let sourceFieldNames: string[] = []
                if (sourceCategory === 'erp') {
                    const srcFields = await erpConnectorsAPI.getEntityFields(srcProvider, entities[0])
                    sourceFieldNames = (srcFields.fields || []).map((f: any) => f.key || f.name || f.field_name || "").filter(Boolean)
                }
                const res = await warehouseConnectorsAPI.aiAutoMap(whProvider, sourceFieldNames, [])
                if (res.mapping && Object.keys(res.mapping).length > 0) {
                    setColumnMapping(res.mapping)
                    setAutoMapMethod(res.method || "ai")
                    toast({
                        title: "Mapping Complete",
                        description: `Mapped ${res.columns_mapped || Object.keys(res.mapping).length} columns`,
                    })
                } else {
                    toast({ title: "No mappings found", variant: "destructive" })
                }
            } else {
                toast({ title: "Auto-map not supported for this combination", variant: "destructive" })
            }
        } catch (err: any) {
            toast({ title: "Auto-map failed", description: err?.message || "Failed to generate mapping", variant: "destructive" })
        } finally {
            setMappingLoading(false)
        }
    }, [sourceProvider, destinationProvider, sourceCategory, destinationCategory, entities, toast])

    // ── Manual mapping editor ────────────────────────────────────────────────

    const handleOpenMappingEditor = useCallback(async () => {
        if (!sourceProvider || entities.length === 0 || !destinationProvider) {
            toast({ title: "Select source, destination and entities first", variant: "destructive" })
            return
        }

        // Fetch fields if not cached
        if (cachedSourceFields.length === 0 || cachedDestFields.length === 0) {
            try {
                const [srcRes, dstRes] = await Promise.all([
                    erpConnectorsAPI.getEntityFields(sourceProvider, entities[0]),
                    erpConnectorsAPI.getEntityFields(destinationProvider, entities[0]),
                ])
                const srcFields = (srcRes.fields || []).map((f: any) => ({
                    key: f.key || f.name || "",
                    label: f.label || f.key || f.name || "",
                    data_type: f.data_type || f.type || "string",
                    required: f.required || false,
                })).filter((f: any) => f.key)
                const dstFields = (dstRes.fields || []).map((f: any) => ({
                    key: f.key || f.name || "",
                    label: f.label || f.key || f.name || "",
                    data_type: f.data_type || f.type || "string",
                    required: f.required || false,
                })).filter((f: any) => f.key)
                setCachedSourceFields(srcFields)
                setCachedDestFields(dstFields)
            } catch (err: any) {
                toast({ title: "Failed to load fields", description: err?.message, variant: "destructive" })
                return
            }
        }
        setShowMappingEditor(true)
    }, [sourceProvider, destinationProvider, entities, cachedSourceFields.length, cachedDestFields.length, toast])

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast({ title: "Name required", description: "Please enter a job name", variant: "destructive" })
            return
        }
        if (!sourceProvider) {
            toast({ title: "Source required", description: "Please select a source provider", variant: "destructive" })
            return
        }
        if (!destinationProvider) {
            toast({ title: "Destination required", description: "Please select a destination provider", variant: "destructive" })
            return
        }
        if (entities.length === 0) {
            toast({ title: "Entities required", description: "Please select at least one entity", variant: "destructive" })
            return
        }
        if (frequency === "cron" && !cronExpression.trim()) {
            toast({ title: "Cron expression required", variant: "destructive" })
            return
        }

        setSaving(true)
        try {
            const freqBackend = frequencyToBackend(frequency, cronExpression.trim())

            const dq_config = dqEnabled
                ? { mode: "default" as const }
                : { mode: "default" as const }

            const payload: Record<string, any> = {
                name: name.trim(),
                source_provider: sourceProvider,
                source_category: sourceCategory,
                destination_provider: destinationProvider,
                destination_category: destinationCategory,
                entities,
                ...freqBackend,
                dq_config,
            }

            if (Object.keys(sourceConfig).length > 0) {
                payload.source_config = sourceConfig
            }
            if (Object.keys(destinationConfig).length > 0) {
                payload.destination_config = destinationConfig
            }
            if (Object.keys(columnMapping).length > 0) {
                payload.column_mapping = columnMapping
            }

            if (isEdit && job) {
                await jobsAPI.updateJob(job.job_id, payload as UpdateJobPayload)
                toast({ title: "Job Updated", description: `${name} has been updated` })
            } else {
                const created = await jobsAPI.createJob(payload as CreateJobPayload)
                if (frequency === "batch" && created?.job_id) {
                    toast({ title: "Batch Job Created", description: `${name} -- triggering transfer now...` })
                    try {
                        await jobsAPI.triggerJob(created.job_id)
                        toast({ title: "Batch Transfer Started", description: `${name} is now running` })
                    } catch (triggerErr: any) {
                        toast({ title: "Trigger failed", description: triggerErr?.message || "Job created but trigger failed", variant: "destructive" })
                    }
                } else {
                    toast({ title: "Job Created", description: `${name} has been created and scheduled` })
                }
            }
            onSuccess()
        } catch (err: any) {
            toast({
                title: isEdit ? "Update failed" : "Creation failed",
                description: err?.message || "Something went wrong",
                variant: "destructive"
            })
        } finally {
            setSaving(false)
        }
    }

    return {
        isEdit,
        // Providers
        allProviders,
        connectedProviderIds,
        providersLoading,
        sourceProviders,
        destinationProviders,
        // Core fields
        name, setName,
        sourceCategory, setSourceCategory,
        sourceProvider, setSourceProvider,
        destinationCategory, setDestinationCategory,
        destinationProvider, setDestinationProvider,
        frequency, setFrequency,
        cronExpression, setCronExpression,
        // Entities
        entities,
        availableEntities,
        entitiesLoading,
        toggleEntity,
        selectAllEntities,
        clearAllEntities,
        // Source / destination config
        sourceConfig, updateSourceConfig,
        destinationConfig, updateDestinationConfig,
        // Warehouse metadata (for cascading selects)
        warehouseList,
        databaseList,
        schemaList,
        warehouseMetaLoading,
        // Column mapping
        columnMapping, setColumnMapping,
        mappingLoading,
        autoMapMethod,
        handleAutoMap,
        showMappingEditor, setShowMappingEditor,
        cachedSourceFields,
        cachedDestFields,
        handleOpenMappingEditor,
        // DQ
        dqEnabled, setDqEnabled,
        // Submit / UI
        saving,
        handleSubmit,
    }
}
