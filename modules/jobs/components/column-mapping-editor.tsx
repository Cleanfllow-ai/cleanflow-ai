'use client'

import { useState, useMemo } from 'react'
import { ArrowRight, Search, X, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

export interface FieldDef {
    key: string
    label?: string
    data_type?: string
    required?: boolean
}

interface ColumnMappingEditorProps {
    sourceFields: FieldDef[]
    destFields: FieldDef[]
    mapping: Record<string, string>
    onMappingChange: (mapping: Record<string, string>) => void
    onClose: () => void
    onAutoMap?: () => void
    autoMapLoading?: boolean
    sourceLabel?: string
    destLabel?: string
    /**
     * Optional confidence per source-field key (0–100). Renders an inline
     * green/amber/red badge with a tooltip showing the resolution method.
     * Pass an empty object (or omit) when confidence is unknown.
     */
    confidenceMap?: Record<string, number>
    /** Optional method per source-field key (e.g. 'template', 'cdf', 'local', 'ai'). */
    methodMap?: Record<string, string>
    /**
     * Optional preview rows of source data — first ~3 rows for inline display
     * underneath each source field. Each row is keyed by source-field key.
     */
    sampleDataRows?: Record<string, unknown>[]
}

// ─── Confidence helpers ───────────────────────────────────────────────────────

function confidenceTier(score: number): 'high' | 'medium' | 'low' {
    if (score >= 90) return 'high'
    if (score >= 70) return 'medium'
    return 'low'
}

const CONFIDENCE_CLASSES: Record<'high' | 'medium' | 'low', string> = {
    high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-red-100 text-red-700 border-red-200',
}

export function ColumnMappingEditor({
    sourceFields,
    destFields,
    mapping,
    onMappingChange,
    onClose,
    onAutoMap,
    autoMapLoading,
    sourceLabel = 'Source',
    destLabel = 'Destination',
    confidenceMap,
    methodMap,
    sampleDataRows,
}: ColumnMappingEditorProps) {
    const [search, setSearch] = useState('')

    const mappedCount = useMemo(
        () => Object.values(mapping).filter(Boolean).length,
        [mapping],
    )

    const usedDestKeys = useMemo(
        () => new Set(Object.values(mapping).filter(Boolean)),
        [mapping],
    )

    const filteredSourceFields = useMemo(() => {
        if (!search) return sourceFields
        const q = search.toLowerCase()
        return sourceFields.filter(
            f => (f.key || '').toLowerCase().includes(q)
                || (f.label || '').toLowerCase().includes(q),
        )
    }, [sourceFields, search])

    const handleFieldMap = (sourceKey: string, destKey: string) => {
        const next = { ...mapping }
        if (destKey === '__none__') {
            delete next[sourceKey]
        } else {
            next[sourceKey] = destKey
        }
        onMappingChange(next)
    }

    const handleClearAll = () => {
        onMappingChange({})
    }

    return (
        <div className="rounded-lg border bg-card p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">Column Mapping</h4>
                    <Badge variant="outline" className="text-xs">
                        {mappedCount} / {sourceFields.length} mapped
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    {onAutoMap && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAutoMap}
                            disabled={autoMapLoading}
                            className="text-xs"
                        >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {autoMapLoading ? 'Mapping...' : 'Auto-map'}
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs text-muted-foreground">
                        Clear All
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Filter fields..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                />
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_30px_1fr] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                <span>{sourceLabel} Field</span>
                <span />
                <span>{destLabel} Field</span>
            </div>

            {/* Field mapping rows */}
            <div className="max-h-[300px] overflow-y-auto space-y-1.5">
                {filteredSourceFields.map(srcField => {
                    const currentDest = mapping[srcField.key] || ''
                    const isMapped = Boolean(currentDest)
                    const conf = confidenceMap?.[srcField.key]
                    const method = methodMap?.[srcField.key]
                    const tier = typeof conf === 'number' ? confidenceTier(conf) : null
                    // Up to 3 sample values for inline preview under the field name.
                    const samples = (sampleDataRows || [])
                        .slice(0, 3)
                        .map(r => r?.[srcField.key])
                        .filter(v => v !== undefined && v !== null && v !== '')

                    return (
                        <div
                            key={srcField.key}
                            className={`grid grid-cols-[1fr_30px_1fr] gap-2 items-start px-1 py-1 rounded text-xs ${
                                isMapped ? 'bg-emerald-500/5' : ''
                            }`}
                        >
                            {/* Source field */}
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 truncate" title={srcField.key}>
                                    <span className="font-medium truncate">{srcField.label || srcField.key}</span>
                                    {srcField.label && srcField.label !== srcField.key && (
                                        <span className="text-muted-foreground text-[10px] truncate">
                                            {srcField.key}
                                        </span>
                                    )}
                                    {srcField.required && (
                                        <span className="text-red-500">*</span>
                                    )}
                                    {tier && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center justify-center rounded-full border px-1.5 py-0 text-[9px] font-semibold leading-none h-4 cursor-help',
                                                        CONFIDENCE_CLASSES[tier],
                                                    )}
                                                >
                                                    {Math.round(conf!)}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <span className="text-[11px]">
                                                    Confidence {Math.round(conf!)}%
                                                    {method ? ` · ${method}` : ''}
                                                </span>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                                {samples.length > 0 && (
                                    <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate font-mono">
                                        {samples.map((s, i) => (
                                            <span key={i} className="mr-1">
                                                {String(s).length > 24 ? `${String(s).slice(0, 24)}…` : String(s)}
                                                {i < samples.length - 1 && <span className="text-muted-foreground/40">,</span>}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Arrow */}
                            <ArrowRight className={`h-3 w-3 mx-auto mt-1 ${
                                isMapped ? 'text-emerald-500' : 'text-muted-foreground/30'
                            }`} />

                            {/* Destination dropdown */}
                            <Select
                                value={currentDest || '__none__'}
                                onValueChange={val => handleFieldMap(srcField.key, val)}
                            >
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Select field..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    <SelectItem value="__none__" className="text-xs text-muted-foreground">
                                        — Not mapped —
                                    </SelectItem>
                                    {destFields.map(df => {
                                        const isUsed = usedDestKeys.has(df.key) && df.key !== currentDest
                                        return (
                                            <SelectItem
                                                key={df.key}
                                                value={df.key}
                                                className="text-xs"
                                                disabled={isUsed}
                                            >
                                                {df.label || df.key}
                                                {isUsed && ' (used)'}
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )
                })}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t">
                <Button size="sm" onClick={onClose}>
                    Done
                </Button>
            </div>
        </div>
    )
}
