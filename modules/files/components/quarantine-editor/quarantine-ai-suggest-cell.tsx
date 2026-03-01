'use client'

/**
 * quarantine-ai-suggest-cell.tsx
 *
 * AG Grid cell renderer for quarantined cells that adds an AI fix suggestion
 * button (✨ wand icon). Clicking the button calls the suggest-fix endpoint
 * and shows a popover with the suggestion, confidence, and reasoning.
 *
 * Only renders the AI button when the cell's column has dq_status = 'quarantined'.
 * Non-quarantined cells render as plain text — no overhead.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Wand2, Loader2, Check, X } from 'lucide-react'
import { suggestQuarantineFix, type AiSuggestFixResponse } from '@/modules/files/api/file-quarantine-api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiSuggestCellRendererProps {
  /** Current display value of the cell */
  value: any
  /** Full row data — used to read {col}_dq_status and dq_violations */
  data: Record<string, any>
  /** Column definition — used to read the field name */
  colDef: { field?: string }
  /** Upload ID of the file being edited */
  uploadId: string
  /** JWT auth token for the API call */
  authToken: string | null
  /** Called when user clicks Accept on a suggestion — applies it as an edit */
  onAccept: (rowId: string, column: string, value: string) => void
}

// ─── Confidence badge styles ──────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25',
  low: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AiSuggestCellRenderer({
  value,
  data,
  colDef,
  uploadId,
  authToken,
  onAccept,
}: AiSuggestCellRendererProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<AiSuggestFixResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Local accepted value — shows the accepted suggestion immediately without
  // waiting for AG Grid's prop update cycle to propagate the new value.
  const [acceptedValue, setAcceptedValue] = useState<string | null>(null)
  // Tracks what we last accepted so we can distinguish "AG Grid caught up" from
  // "an unrelated value change arrived before AG Grid caught up".
  const pendingAcceptRef = useRef<string | null>(null)

  // Render the Popover portal INSIDE the Dialog's DOM node rather than
  // document.body. Without this, Radix Dialog's DismissableLayer intercepts
  // all pointerdown events on portal children outside its subtree — which
  // prevents the Accept button from receiving click events.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const dialog = wrapperRef.current?.closest('[role="dialog"]') as HTMLElement | null
    setPortalContainer(dialog)
  }, [])

  // Sync acceptedValue back to null only when AG Grid has actually caught up
  // with the value we accepted, OR when there is no pending accept at all.
  // Without this guard the old useEffect would reset acceptedValue on ANY value
  // change — including intermediate stale AG Grid updates — which wiped out the
  // accepted value before the cell ever rendered it.
  useEffect(() => {
    if (pendingAcceptRef.current === null) {
      // No pending accept — just stay in sync with AG Grid
      setAcceptedValue(null)
    } else if (String(value ?? '') === pendingAcceptRef.current) {
      // AG Grid has caught up: clear the override and trust AG Grid going forward
      setAcceptedValue(null)
      pendingAcceptRef.current = null
    }
    // else: AG Grid still has a stale value — keep showing our accepted value
  }, [value])

  const displayValue = acceptedValue !== null ? acceptedValue : (value ?? '')

  const col = colDef?.field ?? ''
  const rowId = String(data?.row_id ?? '')

  // Only show the AI button for cells whose column is quarantined
  const isQuarantined =
    String(data?.[`${col}_dq_status`] ?? '').toLowerCase() === 'quarantined'

  // ── AI fetch ──────────────────────────────────────────────────────────────

  const fetchSuggestion = useCallback(async () => {
    if (!uploadId || !authToken || suggestion) return
    setLoading(true)
    setError(null)
    try {
      // Try to extract per-column violation info for richer AI context
      let ruleId = 'unknown'
      let issueMessage = ''
      let relatedColumns: Record<string, string> | undefined
      let crossCondition: string | undefined
      const rawViolations = data?.dq_violations
      let parsedViolations: any[] = []
      if (rawViolations) {
        try {
          const parsed =
            typeof rawViolations === 'string'
              ? JSON.parse(rawViolations)
              : rawViolations
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedViolations = parsed
            // Prefer a violation entry that mentions this specific column
            const match =
              parsed.find((v: any) => v.column === col) ?? parsed[0]
            ruleId = String(match?.rule_id ?? 'unknown')
            issueMessage = String(match?.message ?? '')
          }
        } catch {
          // ignore parse errors — proceed with fallback defaults
        }
      }

      // For cross-column violations, collect sibling column values so the LLM
      // can suggest a fix that satisfies the required relationship.
      // Cross rule_ids have the format "CROSS:<rule>|<condition>", e.g.
      // "CROSS:date_order|CREATED_TS <= UPDATED_TS".
      if (ruleId.startsWith('CROSS:')) {
        const pipeIdx = ruleId.indexOf('|')
        if (pipeIdx !== -1) {
          crossCondition = ruleId.slice(pipeIdx + 1)
        }
        // Find all other columns that share the exact same cross violation
        const relCols: Record<string, string> = {}
        parsedViolations.forEach((v: any) => {
          if (String(v?.rule_id ?? '') === ruleId && v.column !== col) {
            const relCol = String(v.column ?? '')
            if (relCol && relCol in data) {
              relCols[relCol] = String(data[relCol] ?? '')
            }
          }
        })
        if (Object.keys(relCols).length > 0) {
          relatedColumns = relCols
        }
      }

      const result = await suggestQuarantineFix(uploadId, authToken, {
        column: col,
        value: String(value ?? ''),
        rule_id: ruleId,
        column_type: 'text',
        issue_message: issueMessage,
        related_columns: relatedColumns,
        cross_condition: crossCondition,
      })
      setSuggestion(result)
    } catch (err: any) {
      setError(err?.message ?? 'AI suggestion unavailable')
    } finally {
      setLoading(false)
    }
  }, [uploadId, authToken, col, value, data, suggestion])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open) void fetchSuggestion()
    setOpen((prev) => !prev)
  }

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!suggestion) return

    // API can return null for "remove this value"; normalize to empty string
    // so the edit pipeline always receives a concrete text value.
    const accepted = suggestion.suggestion == null ? '' : String(suggestion.suggestion)
    pendingAcceptRef.current = accepted // guard against premature useEffect reset
    setAcceptedValue(accepted)          // show immediately, don't wait for AG Grid
    onAccept(rowId, col, accepted)
    setOpen(false)
    setSuggestion(null) // reset so next open fetches fresh
  }

  // ── Non-quarantined: plain value ───────────────────────────────────────────

  if (!isQuarantined) {
    return <span className="truncate text-sm">{displayValue}</span>
  }

  // ── Quarantined: value + ✨ button ────────────────────────────────────────

  const confidenceStyle =
    CONFIDENCE_STYLES[suggestion?.confidence ?? 'low'] ?? CONFIDENCE_STYLES.low

  return (
    <div ref={wrapperRef} className="flex items-center gap-1 w-full h-full overflow-hidden">
      <span className="flex-1 truncate text-sm">{displayValue}</span>

      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleTriggerClick}
            className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-violet-500 hover:bg-violet-500/15 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
            title="AI fix suggestion"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-72 p-0 overflow-hidden shadow-xl"
          side="bottom"
          align="start"
          sideOffset={4}
          container={portalContainer}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
            <Wand2 className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            <span className="text-xs font-semibold text-foreground">AI Fix Suggestion</span>
            {suggestion && !loading && (
              <span
                className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${confidenceStyle}`}
              >
                {suggestion.confidence}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-3 space-y-2.5">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                <span>Generating suggestion…</span>
              </div>
            )}

            {error && !loading && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {suggestion && !loading && (
              <>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mb-1">
                    Suggested value
                  </p>
                  <div className="bg-muted rounded-md px-2.5 py-1.5 text-sm font-mono break-all">
                    {suggestion.suggestion || <span className="italic text-muted-foreground">(empty)</span>}
                  </div>
                </div>

                {suggestion.reasoning && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {suggestion.reasoning}
                  </p>
                )}

                <div className="flex gap-2 pt-0.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={handleAccept}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
