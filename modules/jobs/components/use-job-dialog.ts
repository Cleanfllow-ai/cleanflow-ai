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
import { connectorsAPI, warehouseConnectorsAPI, erpConnectorsAPI } from '@/modules/connectors'
import { ensureConnectorConfig } from '@/modules/connectors/hooks/use-connector-metadata-cache'
import type { ProviderInfo } from '@/modules/connectors/api/connectors-api'
import type { WarehouseMetadataItem } from '@/modules/connectors/api/warehouse-connectors-api'
import { getSettingsPresets } from '@/modules/files/api/file-settings-api'
import type { SettingsPreset } from '@/modules/files/types'
import { orgAPI, type OrgMembership } from '@/modules/auth/api/org-api'
import type { DQPolicy } from '@/modules/jobs/types/jobs.types'

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

    // ── DQ config ─────────────────────────────────────────────────────────────
    const [dqPolicy, setDqPolicy] = useState<DQPolicy>("block_and_notify")
    const [presetId, setPresetId] = useState("default")
    const [responsibleUserId, setResponsibleUserId] = useState("")
    const [rulesEnabled, setRulesEnabled] = useState<Record<string, boolean>>({})
    const [allowAutofix, setAllowAutofix] = useState(true)

    // ── DQ presets & org members (fetched on mount) ─────────────────────────
    const [presets, setPresets] = useState<SettingsPreset[]>([])
    const [presetsLoading, setPresetsLoading] = useState(false)
    const [orgMembers, setOrgMembers] = useState<OrgMembership[]>([])
    const [orgMembersLoading, setOrgMembersLoading] = useState(false)

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

    // ── Fetch DQ presets + org members on dialog open ──────────────────────────

    useEffect(() => {
        if (!open) return
        let cancelled = false

        setPresetsLoading(true)
        getSettingsPresets().then(res => {
            if (!cancelled) setPresets(res.presets || [])
        }).catch(() => {
            if (!cancelled) setPresets([])
        }).finally(() => {
            if (!cancelled) setPresetsLoading(false)
        })

        setOrgMembersLoading(true)
        orgAPI.listMembers().then(res => {
            if (!cancelled) setOrgMembers(res.members || [])
        }).catch(() => {
            if (!cancelled) setOrgMembers([])
        }).finally(() => {
            if (!cancelled) setOrgMembersLoading(false)
        })

        return () => { cancelled = true }
    }, [open])

    // ── Load rules from preset when preset changes ─────────────────────────

    useEffect(() => {
        if (presetId === "default" || !presetId) {
            // Reset to all rules enabled
            setRulesEnabled({})
            return
        }
        const preset = presets.find(p => p.preset_id === presetId)
        if (preset?.config?.rules_enabled) {
            setRulesEnabled(preset.config.rules_enabled)
        }
        if (preset?.config?.policies?.allow_autofix != null) {
            setAllowAutofix(preset.config.policies.allow_autofix)
        }
    }, [presetId, presets])

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
            // Restore DQ config from existing job
            setDqPolicy((job.dq_config?.policy as DQPolicy) || "block_and_notify")
            setPresetId(job.dq_config?.preset_id || "default")
            setRulesEnabled(job.dq_config?.rules_enabled || {})
            setAllowAutofix(job.dq_config?.policies?.allow_autofix ?? true)
            setResponsibleUserId(job.responsible_user_id || "")
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
            // Reset DQ config
            setDqPolicy("block_and_notify")
            setPresetId("default")
            setResponsibleUserId("")
            setRulesEnabled({})
            setAllowAutofix(true)
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
                // Build params from sourceConfig for warehouse providers
                const params: Record<string, string> = {}
                if (sourceConfig.database) params.database = sourceConfig.database
                if (sourceConfig.schema) params.schema = sourceConfig.schema
                if (sourceConfig.warehouse) params.warehouse = sourceConfig.warehouse

                const res = await connectorsAPI.discoverEntities(sourceProvider, Object.keys(params).length > 0 ? params : undefined)
                console.log("[job-dialog] discoverEntities response:", JSON.stringify(res))
                if (cancelled) return
                const opts = (res.entities || []).map((e: any) => ({
                    label: e.label || e.key || e.name || "",
                    value: e.key || e.name || e.entity || e.value || "",
                })).filter((e: EntityOption) => e.value)
                setAvailableEntities(opts)
            } catch (err) {
                console.error("[job-dialog] Entity discovery failed:", err)
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
        setCachedDestFields([])
    }, [destinationCategory])

    // ── Reset entities when source provider changes ──────────────────────────

    useEffect(() => {
        setEntities([])
        setSourceConfig({})
    }, [sourceProvider])

    // ── Warehouse config from admin connectors tab ──────────────────────────

    const [sourceConnectorConfig, setSourceConnectorConfig] = useState<{ warehouse?: string; database?: string }>({})
    const [destConnectorConfig, setDestConnectorConfig] = useState<{ warehouse?: string; database?: string }>({})
    const [sourceConfigMissing, setSourceConfigMissing] = useState(false)
    const [destConfigMissing, setDestConfigMissing] = useState(false)
    const [schemaList, setSchemaList] = useState<WarehouseMetadataItem[]>([])
    const [warehouseMetaLoading, setWarehouseMetaLoading] = useState(false)

    // Load admin connector config and auto-populate source config when warehouse provider selected
    useEffect(() => {
        if (sourceCategory !== 'warehouse' || !sourceProvider) {
            setSourceConnectorConfig({})
            setSourceConfigMissing(false)
            return
        }
        let cancelled = false
        setWarehouseMetaLoading(true)

        ensureConnectorConfig(sourceProvider).then(config => {
            if (cancelled) return
            setSourceConnectorConfig(config)
            if (!config.warehouse && !config.database) {
                setSourceConfigMissing(true)
            } else {
                setSourceConfigMissing(false)
                if (config.warehouse && !sourceConfig.warehouse) {
                    updateSourceConfig('warehouse', config.warehouse)
                }
                if (config.database && !sourceConfig.database) {
                    updateSourceConfig('database', config.database)
                }
            }
        }).finally(() => { if (!cancelled) setWarehouseMetaLoading(false) })

        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceCategory, sourceProvider])

    // Fetch schemas when database is set (from admin config)
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

    // ── Destination warehouse config from admin connectors tab ────────────────

    const [destSchemaList, setDestSchemaList] = useState<WarehouseMetadataItem[]>([])
    const [destTableList, setDestTableList] = useState<WarehouseMetadataItem[]>([])

    // Load admin connector config and auto-populate destination config
    useEffect(() => {
        if (destinationCategory !== 'warehouse' || !destinationProvider) {
            setDestConnectorConfig({})
            setDestConfigMissing(false)
            return
        }
        let cancelled = false

        ensureConnectorConfig(destinationProvider).then(config => {
            if (cancelled) return
            setDestConnectorConfig(config)
            if (!config.warehouse && !config.database) {
                setDestConfigMissing(true)
            } else {
                setDestConfigMissing(false)
                if (config.warehouse && !destinationConfig.warehouse) {
                    updateDestinationConfig('warehouse', config.warehouse)
                }
                if (config.database && !destinationConfig.database) {
                    updateDestinationConfig('database', config.database)
                }
            }
        })
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [destinationCategory, destinationProvider])

    useEffect(() => {
        if (destinationCategory !== 'warehouse' || !destinationProvider || !destinationConfig.database) {
            setDestSchemaList([])
            setDestTableList([])
            return
        }
        let cancelled = false
        warehouseConnectorsAPI.listSchemas(destinationProvider, destinationConfig.database).then(schemas => {
            if (!cancelled) setDestSchemaList(schemas)
        }).catch(() => { if (!cancelled) setDestSchemaList([]) })
        return () => { cancelled = true }
    }, [destinationCategory, destinationProvider, destinationConfig.database])

    useEffect(() => {
        if (destinationCategory !== 'warehouse' || !destinationProvider || !destinationConfig.database || !destinationConfig.schema) {
            setDestTableList([])
            return
        }
        let cancelled = false
        warehouseConnectorsAPI.listTables(destinationProvider, destinationConfig.database, destinationConfig.schema).then(tables => {
            if (!cancelled) setDestTableList(tables)
        }).catch(() => { if (!cancelled) setDestTableList([]) })
        return () => { cancelled = true }
    }, [destinationCategory, destinationProvider, destinationConfig.database, destinationConfig.schema])

    // ── Entity select helper (single-select) ─────────────────────────────────

    const selectEntity = useCallback((entityValue: string) => {
        setEntities(prev => prev.includes(entityValue) ? [] : [entityValue])
    }, [])

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
        setDestinationConfig(prev => {
            const next = { ...prev, [key]: value }
            if (key === 'database') {
                delete next.schema
                delete next.table
            }
            if (key === 'schema') {
                delete next.table
            }
            return next
        })
        // Clear cached dest fields so they get re-fetched for the new table/schema
        setCachedDestFields([])
    }, [])

    // ── Auto-map column mapping ──────────────────────────────────────────────

    const handleAutoMap = useCallback(async () => {
        if (!sourceProvider || entities.length === 0 || !destinationProvider) {
            toast({ title: "Select source, destination and entities first", variant: "destructive" })
            return
        }
        setMappingLoading(true)
        try {
            // Build separate params for source and destination (warehouse config)
            const srcParams: Record<string, string> = {}
            if (sourceConfig.database) srcParams.database = sourceConfig.database
            if (sourceConfig.schema) srcParams.schema = sourceConfig.schema
            if (sourceConfig.warehouse) srcParams.warehouse = sourceConfig.warehouse

            const dstParams: Record<string, string> = {}
            if (destinationConfig.database) dstParams.database = destinationConfig.database
            if (destinationConfig.schema) dstParams.schema = destinationConfig.schema
            if (destinationConfig.warehouse) dstParams.warehouse = destinationConfig.warehouse

            // For warehouse destinations, use the table name as destination entity
            const destinationEntity = destinationCategory === 'warehouse' && destinationConfig.table
                ? destinationConfig.table
                : entities[0]

            let mappings: Array<{ source: string; destination: string; confidence: number; method: string }> = []
            if (destinationCategory === 'erp') {
                // Fetch source fields first for ERP automap
                let sourceFields: string[] = []
                try {
                    const srcRes = await connectorsAPI.getEntityFields(sourceProvider, entities[0], Object.keys(srcParams).length > 0 ? srcParams : undefined)
                    sourceFields = (srcRes.fields || []).map((f: any) => f.key || f.name || "").filter(Boolean)
                } catch { /* proceed with empty — backend will try to infer */ }
                const erpRes = await erpConnectorsAPI.aiAutoMap(destinationProvider, sourceFields, entities[0], sourceProvider)
                // ERP automap returns {mapping: Record<string, string>} — convert to array
                mappings = Object.entries(erpRes.mapping || {}).map(([src, dst]) => ({
                    source: src, destination: dst, confidence: 80, method: erpRes.method || "ai",
                }))
            } else {
                const res = await connectorsAPI.autoMap(
                    sourceProvider,
                    destinationProvider,
                    entities[0],
                    [],
                    Object.keys(srcParams).length > 0 ? srcParams : undefined,
                    destinationEntity,
                    Object.keys(dstParams).length > 0 ? dstParams : undefined,
                )
                mappings = res.mappings || []
            }

            if (mappings.length > 0) {
                // Accept medium+ confidence mappings (>=70)
                const newMapping: Record<string, string> = {}
                let acceptedCount = 0
                for (const m of mappings) {
                    if (m.confidence >= 70) {
                        newMapping[m.source] = m.destination
                        acceptedCount++
                    }
                }
                setColumnMapping(newMapping)
                const topMethod = mappings[0]?.method || "auto"
                setAutoMapMethod(topMethod)
                toast({
                    title: "Mapping Complete",
                    description: `Mapped ${acceptedCount} columns (${mappings.length} total matches found)`,
                })
            } else {
                toast({ title: "No mappings found", description: "Could not auto-map columns.", variant: "destructive" })
            }
        } catch (err: any) {
            toast({ title: "Auto-map failed", description: err?.message || "Failed to generate mapping", variant: "destructive" })
        } finally {
            setMappingLoading(false)
        }
    }, [sourceProvider, sourceCategory, destinationProvider, destinationCategory, sourceConfig, destinationConfig, entities, toast])

    // ── Manual mapping editor ────────────────────────────────────────────────

    const handleOpenMappingEditor = useCallback(async () => {
        if (!sourceProvider || entities.length === 0 || !destinationProvider) {
            toast({ title: "Select source, destination and entities first", variant: "destructive" })
            return
        }

        // Fetch fields if not cached
        if (cachedSourceFields.length === 0 || cachedDestFields.length === 0) {
            try {
                // Build params for source/destination (warehouse config)
                const srcParams: Record<string, string> = {}
                if (sourceConfig.database) srcParams.database = sourceConfig.database
                if (sourceConfig.schema) srcParams.schema = sourceConfig.schema
                if (sourceConfig.warehouse) srcParams.warehouse = sourceConfig.warehouse

                const dstParams: Record<string, string> = {}
                if (destinationConfig.database) dstParams.database = destinationConfig.database
                if (destinationConfig.schema) dstParams.schema = destinationConfig.schema
                if (destinationConfig.warehouse) dstParams.warehouse = destinationConfig.warehouse

                // ── Fetch source fields ──────────────────────────────────
                let srcFields: Array<{key: string; label: string; data_type: string; required: boolean}> = []
                try {
                    if (sourceCategory === 'erp') {
                        const srcRes = await erpConnectorsAPI.getEntityFields(sourceProvider, entities[0])
                        srcFields = (srcRes.fields || []).map((f: any) => ({
                            key: f.key || f.name || "", label: f.label || f.key || f.name || "",
                            data_type: f.data_type || f.type || "string", required: f.required || false,
                        })).filter((f: any) => f.key)
                    } else if (sourceCategory === 'warehouse' && sourceConfig.database && sourceConfig.schema) {
                        const cols = await warehouseConnectorsAPI.getTableColumns(sourceProvider, sourceConfig.database, sourceConfig.schema, entities[0])
                        srcFields = cols.map(c => ({ key: c.name, label: c.name, data_type: c.type || "string", required: false }))
                    } else {
                        const srcRes = await connectorsAPI.getEntityFields(sourceProvider, entities[0], Object.keys(srcParams).length > 0 ? srcParams : undefined)
                        srcFields = (srcRes.fields || []).map((f: any) => ({
                            key: f.key || f.name || "", label: f.label || f.key || f.name || "",
                            data_type: f.data_type || f.type || "string", required: f.required || false,
                        })).filter((f: any) => f.key)
                    }
                } catch { /* source fields fetch failed */ }

                // ── Fetch destination fields ────────────────────────────
                let dstFields: typeof srcFields = []
                try {
                    if (destinationCategory === 'erp') {
                        const dstRes = await erpConnectorsAPI.getEntityFields(destinationProvider, entities[0])
                        dstFields = (dstRes.fields || []).map((f: any) => ({
                            key: f.key || f.name || "", label: f.label || f.key || f.name || "",
                            data_type: f.data_type || f.type || "string", required: f.required || false,
                        })).filter((f: any) => f.key)
                    } else if (destinationCategory === 'warehouse' && destinationConfig.database && destinationConfig.schema && destinationConfig.table) {
                        const cols = await warehouseConnectorsAPI.getTableColumns(destinationProvider, destinationConfig.database, destinationConfig.schema, destinationConfig.table)
                        dstFields = cols.map(c => ({ key: c.name, label: c.name, data_type: c.type || "string", required: false }))
                    } else {
                        const dstRes = await connectorsAPI.getEntityFields(destinationProvider, entities[0], Object.keys(dstParams).length > 0 ? dstParams : undefined)
                        dstFields = (dstRes.fields || []).map((f: any) => ({
                            key: f.key || f.name || "", label: f.label || f.key || f.name || "",
                            data_type: f.data_type || f.type || "string", required: f.required || false,
                        })).filter((f: any) => f.key)
                    }
                } catch { /* destination fields fetch failed */ }

                // If destination has no fields (new table), mirror source fields
                if (dstFields.length === 0) {
                    dstFields = srcFields.map(f => ({ ...f }))
                }

                setCachedSourceFields(srcFields)
                setCachedDestFields(dstFields)
            } catch (err: any) {
                toast({ title: "Failed to load fields", description: err?.message, variant: "destructive" })
                return
            }
        }
        setShowMappingEditor(true)
    }, [sourceProvider, destinationProvider, entities, cachedSourceFields.length, cachedDestFields.length, sourceConfig, destinationConfig, toast])

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

            const hasCustomRules = Object.keys(rulesEnabled).length > 0
            const dq_config: Record<string, any> = {
                mode: hasCustomRules || presetId !== "default" ? "custom" : "default",
                policy: dqPolicy,
                policies: { allow_autofix: allowAutofix },
            }
            if (presetId && presetId !== "default") {
                dq_config.preset_id = presetId
            }
            if (hasCustomRules) {
                dq_config.rules_enabled = rulesEnabled
            }

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

            if (dqPolicy === "block_and_notify" && responsibleUserId) {
                payload.responsible_user_id = responsibleUserId
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
        selectEntity,
        clearAllEntities,
        // Source / destination config
        sourceConfig, updateSourceConfig,
        destinationConfig, updateDestinationConfig,
        // Warehouse config from admin connectors tab
        sourceConnectorConfig,
        destConnectorConfig,
        sourceConfigMissing,
        destConfigMissing,
        schemaList,
        warehouseMetaLoading,
        destSchemaList,
        destTableList,
        // Column mapping
        columnMapping, setColumnMapping,
        mappingLoading,
        autoMapMethod,
        handleAutoMap,
        showMappingEditor, setShowMappingEditor,
        cachedSourceFields,
        cachedDestFields,
        handleOpenMappingEditor,
        // DQ config
        dqPolicy, setDqPolicy,
        presetId, setPresetId,
        responsibleUserId, setResponsibleUserId,
        rulesEnabled, setRulesEnabled,
        allowAutofix, setAllowAutofix,
        presets, presetsLoading,
        orgMembers, orgMembersLoading,
        // Submit / UI
        saving,
        handleSubmit,
    }
}
