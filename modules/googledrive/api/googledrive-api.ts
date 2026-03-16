import { AWS_CONFIG } from "@/shared/config/aws-config"

import type {
    GoogleDriveConnectResponse,
    GoogleDriveConnectionStatus,
    GoogleDriveListResponse,
    GoogleDriveFoldersResponse,
    GoogleDriveImportResponse,
} from "@/modules/googledrive/types/googledrive.types"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

class GoogleDriveService {
    private baseURL: string

    constructor(baseURL: string = API_BASE_URL) {
        this.baseURL = baseURL
    }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {},
        retries: number = 0
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(options.headers as Record<string, string>),
        }

        const token = this.getAuthToken()
        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 60000)

            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(
                    errorData.error || errorData.message || `HTTP ${response.status}`
                )
            }

            return await response.json()
        } catch (error) {
            if (
                (error as Error).name === "AbortError" &&
                retries < 2
            ) {
                await new Promise((resolve) =>
                    setTimeout(resolve, (retries + 1) * 2000)
                )
                return this.makeRequest<T>(endpoint, options, retries + 1)
            }
            throw error
        }
    }

    private getAuthToken(): string | null {
        if (typeof window === "undefined") return null
        try {
            const tokensStr = localStorage.getItem("authTokens")
            if (tokensStr) {
                const tokens = JSON.parse(tokensStr)
                return tokens.idToken || null
            }
        } catch {
            // ignore
        }
        return null
    }

    // ─── OAuth ────────────────────────────────────────────────────────────────

    /** Initiate OAuth — returns auth_url to open in a popup. */
    async connect(): Promise<GoogleDriveConnectResponse> {
        return await this.makeRequest<GoogleDriveConnectResponse>(
            "/googledrive/connect",
            { method: "POST", body: JSON.stringify({}) }
        )
    }

    /** Check whether a Google Drive connection is active. */
    async getConnectionStatus(): Promise<GoogleDriveConnectionStatus> {
        try {
            return await this.makeRequest<GoogleDriveConnectionStatus>(
                "/googledrive/connections",
                { method: "GET" }
            )
        } catch {
            return { connected: false }
        }
    }

    /** Revoke the active connection. */
    async disconnect(): Promise<void> {
        await this.makeRequest("/googledrive/disconnect", { method: "DELETE" })
    }

    // ─── File browsing ────────────────────────────────────────────────────────

    /** List CSV/Excel/Google Sheets files from Google Drive. */
    async listFiles(
        folderId?: string,
        pageToken?: string,
        query?: string
    ): Promise<GoogleDriveListResponse> {
        const params = new URLSearchParams()
        if (folderId) params.set("folder_id", folderId)
        if (pageToken) params.set("page_token", pageToken)
        if (query) params.set("query", query)
        const qs = params.toString()
        return await this.makeRequest<GoogleDriveListResponse>(
            `/googledrive/files${qs ? `?${qs}` : ""}`,
            { method: "GET" }
        )
    }

    /** List folders in a given parent directory. */
    async listFolders(parentId?: string): Promise<GoogleDriveFoldersResponse> {
        const params = new URLSearchParams()
        if (parentId) params.set("parent_id", parentId)
        const qs = params.toString()
        return await this.makeRequest<GoogleDriveFoldersResponse>(
            `/googledrive/folders${qs ? `?${qs}` : ""}`,
            { method: "GET" }
        )
    }

    // ─── Import ───────────────────────────────────────────────────────────────

    /** Start an async import from Google Drive. Returns immediately with upload_id. */
    async importFile(
        fileId: string,
        fileName: string,
        mimeType: string
    ): Promise<GoogleDriveImportResponse> {
        return await this.makeRequest<GoogleDriveImportResponse>(
            "/googledrive/import",
            {
                method: "POST",
                body: JSON.stringify({
                    file_id: fileId,
                    file_name: fileName,
                    mime_type: mimeType,
                }),
            }
        )
    }

    /** Poll import status (IMPORTING → UPLOADED / IMPORT_FAILED). */
    async getImportStatus(uploadId: string): Promise<{
        upload_id: string
        status: string
        filename?: string
        file_size?: number
        error_message?: string
    }> {
        return await this.makeRequest(
            `/googledrive/import?upload_id=${encodeURIComponent(uploadId)}`,
            { method: "GET" }
        )
    }

    // ─── OAuth popup ──────────────────────────────────────────────────────────

    /** Open OAuth popup and wait for result. */
    async openOAuthPopup(): Promise<{ success: boolean; error?: string }> {
        return new Promise(async (resolve) => {
            try {
                const response = await this.connect()

                if (!response.auth_url) {
                    resolve({ success: false, error: "No auth URL received" })
                    return
                }

                const width = 600
                const height = 700
                const left = window.screen.width / 2 - width / 2
                const top = window.screen.height / 2 - height / 2

                const authWindow = window.open(
                    response.auth_url,
                    "Google Drive OAuth",
                    `width=${width},height=${height},top=${top},left=${left}`
                )

                const cleanup = (result: { success: boolean; error?: string }) => {
                    clearInterval(pollTimer)
                    window.removeEventListener("message", messageHandler)
                    resolve(result)
                }

                const messageHandler = (event: MessageEvent) => {
                    if (event.origin !== window.location.origin) return
                    if (event.data.type === "googledrive-auth-success") {
                        cleanup({ success: true })
                    } else if (event.data.type === "googledrive-auth-error") {
                        cleanup({
                            success: false,
                            error: event.data.error || "Authorization failed",
                        })
                    }
                }

                window.addEventListener("message", messageHandler)

                // Poll for popup closed — Google's COOP headers can make
                // authWindow.closed throw, so we wrap in try/catch
                const pollTimer = setInterval(() => {
                    try {
                        if (authWindow && authWindow.closed) {
                            cleanup({ success: false, error: "Auth window closed" })
                        }
                    } catch {
                        // COOP policy blocked access — ignore, rely on postMessage
                    }
                }, 500)
            } catch (error) {
                resolve({
                    success: false,
                    error: (error as Error).message || "Connection failed",
                })
            }
        })
    }
}

export const googleDriveAPI = new GoogleDriveService()
export default googleDriveAPI
