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

export const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case "DQ_FIXED":
    case "COMPLETED":
      return "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400 border-green-300 dark:border-green-500/30"
    case "FAILED":
    case "DQ_FAILED":
    case "REJECTED":
      return "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 border-red-300 dark:border-red-500/30"
    case "DQ_RUNNING":
    case "NORMALIZING":
      return "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-500/30"
    case "QUEUED":
    case "UPLOADED":
    case "DQ_DISPATCHED":
      return "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30"
    default:
      return "bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-500/30"
  }
}

export const getScoreBadgeColor = (score: number) => {
  if (score >= 90) {
    return "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400 border-green-300 dark:border-green-500/30"
  }
  if (score >= 70) {
    return "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30"
  }
  return "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 border-red-300 dark:border-red-500/30"
}

