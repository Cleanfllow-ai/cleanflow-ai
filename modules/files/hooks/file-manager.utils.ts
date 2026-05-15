import type { FileItem } from "@/modules/files/types"
import { AWS_CONFIG } from "@/shared/config/aws-config"

export const FILES_API_CONFIG = {
  apiUrl: `${AWS_CONFIG.API_BASE_URL}/`,
}

// ── P0-1: Complete status map — every BE status has an explicit FE variant.
// Unknown statuses fall through to "processing" (NOT "uploaded") so the
// Run-DQ button stays disabled for files the FE doesn't recognise yet.
export const mapStatus = (apiStatus: string): FileItem["status"] => {
  const statusMap: Record<string, FileItem["status"]> = {
    // Stable / terminal
    UPLOADED: "uploaded",
    DQ_FIXED: "processed",
    DQ_FAILED: "dq_failed",
    FAILED: "failed",
    REJECTED: "failed",
    IMPORT_FAILED: "failed",
    OPTIMIZE_FAILED: "failed",
    SHARD_FAILED: "failed",
    UPLOAD_FAILED: "failed",
    // In-progress (non-terminal; disable Run-DQ)
    UPLOADING: "processing",
    QUEUED: "queued",
    VALIDATED: "processing",
    DQ_DISPATCHED: "processing",
    DQ_RUNNING: "dq_running",
    IMPORTING: "processing",
    OPTIMIZING: "processing",
    NORMALIZING: "processing",
    SHARDING: "processing",
    SHARDED: "processing",
    COMPLETED: "processed",
  }

  // Unknown statuses → "processing" so Run-DQ is disabled (not "uploaded")
  return statusMap[apiStatus] ?? "processing"
}
