export const getDqQuality = (
  score: number | null | undefined
): "excellent" | "good" | "bad" | null => {
  if (typeof score !== "number") return null
  if (score >= 90) return "excellent"
  if (score >= 70) return "good"
  return "bad"
}

export const getDqQualityLabel = (score: number | null | undefined): string => {
  const quality = getDqQuality(score)
  if (!quality) return "-"
  if (quality === "excellent") return "Excellent"
  if (quality === "good") return "Good"
  return "Bad"
}

export const calculateProcessingTime = (
  uploadedAt: string | null | undefined,
  updatedAt: string | null | undefined
): string => {
  if (!uploadedAt || !updatedAt) return "-"
  const uploadTime = new Date(uploadedAt).getTime()
  const updateTime = new Date(updatedAt).getTime()
  const diffMs = updateTime - uploadTime
  if (diffMs < 0) return "-"
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/**
 * Returns whether a status represents an "active" (in-progress) state.
 * Used to show a pulsing indicator next to the badge.
 */
export const isActiveStatus = (status: string): boolean => {
  return ["DQ_RUNNING", "NORMALIZING", "REPROCESSING", "UPLOADING", "QUEUED", "DQ_DISPATCHED", "SHARDING"].includes(status)
}

/**
 * Returns a human-readable label for file status.
 * Simplifies technical status names for business users.
 */
export const getStatusLabel = (status: string): string => {
  switch (status) {
    case "DQ_FIXED": return "Complete"
    case "COMPLETED": return "Complete"
    case "DQ_COMPLETE": return "Complete"
    case "DQ_RUNNING": return "Processing"
    case "NORMALIZING": return "Processing"
    case "DQ_DISPATCHED": return "Queued"
    case "QUEUED": return "Queued"
    case "UPLOADED": return "Uploaded"
    case "UPLOADING": return "Uploading"
    case "DQ_FAILED": return "Failed"
    case "FAILED": return "Failed"
    case "UPLOAD_FAILED": return "Upload Failed"
    case "REJECTED": return "Rejected"
    case "REPROCESSING": return "Reprocessing"
    case "REPROCESS_FAILED": return "Reprocess Failed"
    case "SHARDING": return "Sharding..."
    case "SHARDED": return "Ready"
    case "SHARD_FAILED": return "Shard Failed"
    default: return status
  }
}

export const getStatusBadgeColor = (status: string) => {
  switch (status) {
    // Success states — green
    case "DQ_FIXED":
    case "COMPLETED":
    case "DQ_COMPLETE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25"
    // Failed states — red
    case "FAILED":
    case "DQ_FAILED":
    case "UPLOAD_FAILED":
    case "REJECTED":
    case "REPROCESS_FAILED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25"
    // Active/processing states — blue
    case "DQ_RUNNING":
    case "NORMALIZING":
    case "REPROCESSING":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25"
    // Waiting states — amber
    case "QUEUED":
    case "DQ_DISPATCHED":
    case "UPLOADED":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25"
    // Upload in progress — purple
    case "UPLOADING":
      return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/25"
    // Sharding in progress — amber (processing indicator)
    case "SHARDING":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25"
    // Sharding complete — green (file ready)
    case "SHARDED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25"
    // Sharding failed — red (error state)
    case "SHARD_FAILED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25"
    default:
      return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-500/25"
  }
}

export const getScoreBadgeColor = (score: number) => {
  if (score >= 90) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25"
  }
  if (score >= 70) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25"
  }
  return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25"
}
