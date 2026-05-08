'use client'

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { ArrowRight, Search, X, Sparkles, List, GitBranch, Link2Off } from 'lucide-react'
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
    const [filterMode, setFilterMode] = useState<'all' | 'mapped' | 'unmapped'>('all')
    const [viewMode, setViewMode] = useState<'list' | 'visual'>('list')

    const mappedCount = useMemo(
        () => Object.values(mapping).filter(Boolean).length,
        [mapping],
    )

    const unmappedCount = sourceFields.length - mappedCount

    const usedDestKeys = useMemo(
        () => new Set(Object.values(mapping).filter(Boolean)),
        [mapping],
    )

    const filteredSourceFields = useMemo(() => {
        let list = sourceFields
        if (filterMode === 'mapped')   list = list.filter(f => Boolean(mapping[f.key]))
        if (filterMode === 'unmapped') list = list.filter(f => !mapping[f.key])
        if (!search) return list
        const q = search.toLowerCase()
        return list.filter(
            f => (f.key || '').toLowerCase().includes(q)
                || (f.label || '').toLowerCase().includes(q),
        )
    }, [sourceFields, search, filterMode, mapping])

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
                    {/* View toggle: List (form-driven) vs Visual (click-to-connect) */}
                    <div className="flex items-center rounded-md border border-border/60 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'flex items-center gap-1 px-2 py-1 text-[11px] transition-colors',
                                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/40 text-muted-foreground',
                            )}
                            title="Form view — search source field, pick destination from dropdown"
                        >
                            <List className="h-3 w-3" /> List
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('visual')}
                            className={cn(
                                'flex items-center gap-1 px-2 py-1 text-[11px] transition-colors border-l border-border/60',
                                viewMode === 'visual' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/40 text-muted-foreground',
                            )}
                            title="Visual view — click source field then destination field to connect"
                        >
                            <GitBranch className="h-3 w-3" /> Visual
                        </button>
                    </div>
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

            {/* Search + filter chips */}
            <div className="space-y-1.5">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder={`Search ${sourceLabel.toLowerCase()} field by name...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 h-9 text-xs"
                    />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                    {([
                        { key: 'all', label: 'All', count: sourceFields.length },
                        { key: 'mapped', label: 'Mapped', count: mappedCount },
                        { key: 'unmapped', label: 'Unmapped', count: unmappedCount },
                    ] as const).map(opt => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => setFilterMode(opt.key)}
                            className={cn(
                                'px-2 py-0.5 rounded-full border transition-colors',
                                filterMode === opt.key
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted/70',
                            )}
                        >
                            {opt.label} <span className="opacity-70">({opt.count})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Visual click-to-connect view (alternative to the list view) */}
            {viewMode === 'visual' && (
                <VisualMapper
                    sourceFields={filteredSourceFields}
                    destFields={destFields}
                    mapping={mapping}
                    onMappingChange={onMappingChange}
                    sourceLabel={sourceLabel}
                    destLabel={destLabel}
                />
            )}

            {/* Column headers */}
            {viewMode === 'list' && (
            <div className="grid grid-cols-[1fr_30px_1fr] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                <span>{sourceLabel} Field</span>
                <span />
                <span>{destLabel} Field</span>
            </div>
            )}

            {/* Field mapping rows (List view) */}
            {viewMode === 'list' && (
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
            )}

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t">
                <Button size="sm" onClick={onClose}>
                    Done
                </Button>
            </div>
        </div>
    )
}

// ─── Visual click-to-connect mapper ───────────────────────────────────────────
//
// Two-column layout with absolutely-positioned source field cards on the left
// and destination field cards on the right. An SVG overlay draws curved lines
// between connected pairs. Click flow:
//
//   1. User clicks a SOURCE card → it turns "selecting" (blue ring).
//   2. User clicks a DEST card → mapping[source.key] = dest.key, line drawn.
//   3. Click on a line OR click the X on a connection chip → removes the link.
//
// Lines are recomputed on resize / mapping change via a layout effect that
// reads each card's bounding box.

interface VisualMapperProps {
    sourceFields: FieldDef[]
    destFields: FieldDef[]
    mapping: Record<string, string>
    onMappingChange: (mapping: Record<string, string>) => void
    sourceLabel: string
    destLabel: string
}

function VisualMapper({
    sourceFields,
    destFields,
    mapping,
    onMappingChange,
    sourceLabel,
    destLabel,
}: VisualMapperProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const destRefs = useRef<Record<string, HTMLDivElement | null>>({})

    const [selectedSource, setSelectedSource] = useState<string | null>(null)
    const [lines, setLines] = useState<Array<{ src: string; dst: string; d: string; mid: { x: number; y: number } }>>([])

    const usedDestKeys = useMemo(
        () => new Set(Object.values(mapping).filter(Boolean)),
        [mapping],
    )

    const handleSourceClick = useCallback((srcKey: string) => {
        setSelectedSource(prev => prev === srcKey ? null : srcKey)
    }, [])

    const handleDestClick = useCallback((dstKey: string) => {
        if (!selectedSource) return
        // Don't allow mapping a dest already used by another source.
        const conflict = Object.entries(mapping).find(([s, d]) => d === dstKey && s !== selectedSource)
        if (conflict) {
            return
        }
        onMappingChange({ ...mapping, [selectedSource]: dstKey })
        setSelectedSource(null)
    }, [selectedSource, mapping, onMappingChange])

    const handleRemoveLine = useCallback((srcKey: string) => {
        const next = { ...mapping }
        delete next[srcKey]
        onMappingChange(next)
    }, [mapping, onMappingChange])

    // Recompute SVG paths whenever mapping or layout changes.
    const recompute = useCallback(() => {
        const c = containerRef.current
        if (!c) return
        const cb = c.getBoundingClientRect()
        const next: typeof lines = []
        for (const [srcKey, dstKey] of Object.entries(mapping)) {
            if (!dstKey) continue
            const s = sourceRefs.current[srcKey]
            const d = destRefs.current[dstKey]
            if (!s || !d) continue
            const sb = s.getBoundingClientRect()
            const db = d.getBoundingClientRect()
            // Anchor: right-middle of source, left-middle of dest, relative to container.
            const x1 = sb.right - cb.left
            const y1 = sb.top + sb.height / 2 - cb.top
            const x2 = db.left - cb.left
            const y2 = db.top + db.height / 2 - cb.top
            // Curved bezier with horizontal pull proportional to gap.
            const dx = Math.max(40, (x2 - x1) * 0.45)
            const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
            next.push({ src: srcKey, dst: dstKey, d: path, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } })
        }
        setLines(next)
    }, [mapping])

    useLayoutEffect(() => { recompute() }, [recompute, sourceFields.length, destFields.length])

    useEffect(() => {
        const handler = () => recompute()
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [recompute])

    return (
        <div className="rounded-md border border-border/60 bg-muted/10 p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                <span className="font-medium">
                    {selectedSource
                        ? <>Now click a <strong className="text-primary">{destLabel.toLowerCase()}</strong> field to connect <code className="bg-muted px-1 rounded">{selectedSource}</code></>
                        : <>Click a <strong>{sourceLabel.toLowerCase()}</strong> field, then a <strong>{destLabel.toLowerCase()}</strong> field to connect them</>
                    }
                </span>
                {selectedSource && (
                    <button
                        type="button"
                        onClick={() => setSelectedSource(null)}
                        className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                        Cancel
                    </button>
                )}
            </div>

            <div ref={containerRef} className="relative grid grid-cols-2 gap-x-32 gap-y-1.5 max-h-[420px] overflow-y-auto py-1">
                {/* SOURCE column */}
                <div className="space-y-1.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 sticky top-0 bg-muted/10">
                        {sourceLabel}
                    </div>
                    {sourceFields.map(f => {
                        const isSelected = selectedSource === f.key
                        const isMapped = Boolean(mapping[f.key])
                        return (
                            <div
                                key={f.key}
                                ref={el => { sourceRefs.current[f.key] = el }}
                                onClick={() => handleSourceClick(f.key)}
                                className={cn(
                                    'flex items-center justify-between px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-all',
                                    isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
                                    !isSelected && isMapped && 'border-emerald-300 bg-emerald-50/40',
                                    !isSelected && !isMapped && 'border-border/60 bg-card hover:border-primary/40',
                                )}
                            >
                                <span className="truncate">
                                    {f.label || f.key}
                                    {f.required && <span className="text-red-500 ml-1">*</span>}
                                </span>
                                {/* connection node — visual hint */}
                                <span className={cn(
                                    'h-2 w-2 rounded-full ml-2 flex-shrink-0',
                                    isMapped ? 'bg-emerald-500' : isSelected ? 'bg-primary' : 'bg-muted-foreground/30',
                                )} />
                            </div>
                        )
                    })}
                </div>

                {/* DEST column */}
                <div className="space-y-1.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 sticky top-0 bg-muted/10">
                        {destLabel}
                    </div>
                    {destFields.map(f => {
                        const isUsed = usedDestKeys.has(f.key)
                        const isClickable = Boolean(selectedSource)
                        return (
                            <div
                                key={f.key}
                                ref={el => { destRefs.current[f.key] = el }}
                                onClick={() => handleDestClick(f.key)}
                                className={cn(
                                    'flex items-center px-2 py-1.5 rounded-md border text-xs transition-all',
                                    isClickable ? 'cursor-pointer hover:border-primary/60' : 'cursor-default',
                                    isUsed && 'border-emerald-300 bg-emerald-50/40',
                                    !isUsed && 'border-border/60 bg-card',
                                )}
                            >
                                <span className={cn(
                                    'h-2 w-2 rounded-full mr-2 flex-shrink-0',
                                    isUsed ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                                )} />
                                <span className="truncate">
                                    {f.label || f.key}
                                    {f.required && <span className="text-red-500 ml-1">*</span>}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* SVG line overlay */}
                <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: '100%', height: '100%' }}
                >
                    {lines.map(l => (
                        <g key={`${l.src}::${l.dst}`} className="pointer-events-auto">
                            <path
                                d={l.d}
                                fill="none"
                                stroke="rgb(16 185 129)"      /* emerald-500 */
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                opacity="0.85"
                            />
                        </g>
                    ))}
                </svg>

                {/* Per-line "X" remove buttons placed at midpoint */}
                {lines.map(l => (
                    <button
                        key={`x-${l.src}::${l.dst}`}
                        type="button"
                        onClick={() => handleRemoveLine(l.src)}
                        title={`Disconnect ${l.src} → ${l.dst}`}
                        className="absolute z-10 h-4 w-4 rounded-full bg-white border border-emerald-300 shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-300"
                        style={{ left: l.mid.x - 8, top: l.mid.y - 8 }}
                    >
                        <Link2Off className="h-2.5 w-2.5 text-emerald-600" />
                    </button>
                ))}
            </div>
        </div>
    )
}
