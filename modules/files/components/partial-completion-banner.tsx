"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface FailedShard {
  shard_id: string
  error_code: string
  error_message: string
}

interface PartialCompletionBannerProps {
  partialCompletion: boolean
  failedShards?: FailedShard[]
  /**
   * Optional total shard count. When unknown, the banner falls back to
   * "Some shards encountered errors..." instead of "X of Y".
   */
  totalShards?: number
}

/**
 * Banner shown when DQ processing completed with one or more shard failures.
 * The file status remains DQ_FIXED so the file is usable, but the user is
 * informed that some rows may have incomplete validation results.
 *
 * Renders nothing when partialCompletion is false / undefined.
 */
export function PartialCompletionBanner({
  partialCompletion,
  failedShards,
  totalShards,
}: PartialCompletionBannerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (!partialCompletion) return null

  const failedCount = failedShards?.length ?? 0
  const hasDetails = failedCount > 0

  const summary =
    hasDetails && typeof totalShards === "number" && totalShards > 0
      ? `${failedCount} of ${totalShards} shards encountered errors during data quality processing.`
      : hasDetails
      ? `${failedCount} shard${failedCount === 1 ? "" : "s"} encountered errors during data quality processing.`
      : "Some shards encountered errors during data quality processing."

  return (
    <>
      <Alert
        data-testid="partial-completion-banner"
        className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400"
      >
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="font-semibold">Processed with warnings</AlertTitle>
        <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
          <p>
            {summary} The file is usable, but some rows may have incomplete validation results.
          </p>
          {hasDetails && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 border-amber-300 bg-amber-100/70 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
              onClick={() => setDetailsOpen(true)}
            >
              View details
            </Button>
          )}
        </AlertDescription>
      </Alert>

      {hasDetails && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Shard failure details
              </DialogTitle>
              <DialogDescription>
                {failedCount} shard{failedCount === 1 ? "" : "s"} failed during DQ processing.
                The remaining shards completed successfully and the file is usable.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-3">
                {failedShards!.map((shard, idx) => (
                  <div
                    key={`${shard.shard_id}-${idx}`}
                    className="rounded-md border border-amber-300 bg-amber-100/60 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/5"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <code className="text-xs font-mono text-amber-900 dark:text-amber-200">
                        {shard.shard_id}
                      </code>
                      {shard.error_code && (
                        <span className="rounded border border-amber-300 bg-amber-100/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                          {shard.error_code}
                        </span>
                      )}
                    </div>
                    {shard.error_message && (
                      <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90 break-words">
                        {shard.error_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default PartialCompletionBanner
