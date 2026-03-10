import type { FileItem } from "@/modules/files/types"

export const FILES_API_CONFIG = {
  apiUrl: "https://oq92wt6zd9.execute-api.ap-south-1.amazonaws.com/prod/",
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

