import type { FileItem } from "@/modules/files/types"
import { AWS_CONFIG } from "@/shared/config/aws-config"

export const FILES_API_CONFIG = {
  apiUrl: `${AWS_CONFIG.API_BASE_URL}/`,
}

export const mapStatus = (apiStatus: string): FileItem["status"] => {
  const statusMap: Record<string, FileItem["status"]> = {
    UPLOADED: "uploaded",
    QUEUED: "queued",
    DQ_RUNNING: "dq_running",
    DQ_FIXED: "processed",
    DQ_FAILED: "dq_failed",
    FAILED: "failed",
  }

  return statusMap[apiStatus] || "uploaded"
}

