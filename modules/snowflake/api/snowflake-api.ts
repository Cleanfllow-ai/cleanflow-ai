import { AWS_CONFIG } from "@/shared/config/aws-config"

import type {
    SnowflakeConnectResponse,
    SnowflakeConnectionStatus,
    SnowflakeImportRequest,
    SnowflakeImportResponse,
    SnowflakeExportRequest,
    SnowflakeExportResponse,
    SnowflakeMetadataItem,
    SnowflakeMetadataResponse,
} from "@/modules/snowflake/types/snowflake.types"

export type {
    SnowflakeConnectResponse,
    SnowflakeConnectionStatus,
    SnowflakeImportRequest,
    SnowflakeImportResponse,
    SnowflakeExportRequest,
    SnowflakeExportResponse,
    SnowflakeMetadataItem,
    SnowflakeMetadataResponse,
} from "@/modules/snowflake/types/snowflake.types"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

class SnowflakeService {
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
    async connect(accountIdentifier?: string): Promise<SnowflakeConnectResponse> {
        return await this.makeRequest<SnowflakeConnectResponse>(
            "/snowflake/connect",
            {
                method: "POST",
                body: JSON.stringify(
                    accountIdentifier ? { account_identifier: accountIdentifier } : {}
                ),
            }
        )
    }

    /** Check whether a Snowflake connection is active. */
    async getConnectionStatus(): Promise<SnowflakeConnectionStatus> {
        try {
            return await this.makeRequest<SnowflakeConnectionStatus>(
                "/snowflake/connections",
                { method: "GET" }
            )
        } catch {
            return { connected: false }
        }
    }

    /** Revoke the active connection. */
    async disconnect(): Promise<void> {
        await this.makeRequest("/snowflake/disconnect", { method: "DELETE" })
    }

    // ─── Metadata browsing ────────────────────────────────────────────────────

    /** List available warehouses. */
    async listWarehouses(): Promise<SnowflakeMetadataItem[]> {
        const resp = await this.makeRequest<SnowflakeMetadataResponse>(
            "/snowflake/warehouses",
            { method: "GET" }
        )
        return resp.items || []
    }

    /** List available databases. */
    async listDatabases(): Promise<SnowflakeMetadataItem[]> {
        const resp = await this.makeRequest<SnowflakeMetadataResponse>(
            "/snowflake/databases",
            { method: "GET" }
        )
        return resp.items || []
    }

    /** List schemas in a database. */
    async listSchemas(database: string): Promise<SnowflakeMetadataItem[]> {
        const resp = await this.makeRequest<SnowflakeMetadataResponse>(
            `/snowflake/schemas?database=${encodeURIComponent(database)}`,
            { method: "GET" }
        )
        return resp.items || []
    }

    /** List tables in a schema. */
    async listTables(database: string, schema: string): Promise<SnowflakeMetadataItem[]> {
        const resp = await this.makeRequest<SnowflakeMetadataResponse>(
            `/snowflake/tables?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}`,
            { method: "GET" }
        )
        return resp.items || []
    }

    /** Describe columns of an existing Snowflake table. */
    async getTableColumns(
        database: string,
        schema: string,
        table: string
    ): Promise<{ name: string; type?: string }[]> {
        const params = new URLSearchParams({ database, schema, table })
        const resp = await this.makeRequest<{ columns: { name: string; type?: string }[] }>(
            `/snowflake/table-columns?${params.toString()}`,
            { method: "GET" }
        )
        return resp.columns || []
    }

    // ─── AI Mapping ───────────────────────────────────────────────────────────

    /** Use AI to suggest column mapping for Snowflake export. */
    async aiAutoMap(
        fileColumns: string[],
        targetColumns: string[]
    ): Promise<{ mapping: Record<string, string>; columns_mapped: number; method?: string }> {
        return this.makeRequest("/snowflake/ai-automap", {
            method: "POST",
            body: JSON.stringify({ file_columns: fileColumns, target_columns: targetColumns }),
        })
    }

    // ─── Import / Export ──────────────────────────────────────────────────────

    /** Import a table from Snowflake as a CleanFlow file. */
    async importData(
        request: SnowflakeImportRequest
    ): Promise<SnowflakeImportResponse> {
        return await this.makeRequest<SnowflakeImportResponse>(
            "/snowflake/import",
            {
                method: "POST",
                body: JSON.stringify(request),
            }
        )
    }

    /** Export a CleanFlow file to a Snowflake table. */
    async exportToSnowflake(
        request: SnowflakeExportRequest
    ): Promise<SnowflakeExportResponse> {
        return await this.makeRequest<SnowflakeExportResponse>(
            "/snowflake/export",
            {
                method: "POST",
                body: JSON.stringify(request),
            }
        )
    }

    // ─── OAuth popup ──────────────────────────────────────────────────────────

    /** Open OAuth popup and wait for result. */
    async openOAuthPopup(
        accountIdentifier?: string
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise(async (resolve) => {
            try {
                const response = await this.connect(accountIdentifier)

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
                    "Snowflake OAuth",
                    `width=${width},height=${height},top=${top},left=${left}`
                )

                const messageHandler = (event: MessageEvent) => {
                    if (event.origin !== window.location.origin) return
                    if (event.data.type === "snowflake-auth-success") {
                        window.removeEventListener("message", messageHandler)
                        resolve({ success: true })
                    } else if (event.data.type === "snowflake-auth-error") {
                        window.removeEventListener("message", messageHandler)
                        resolve({
                            success: false,
                            error: event.data.error || "Authorization failed",
                        })
                    }
                }

                window.addEventListener("message", messageHandler)

                const pollTimer = setInterval(() => {
                    if (authWindow && authWindow.closed) {
                        clearInterval(pollTimer)
                        window.removeEventListener("message", messageHandler)
                        resolve({ success: false, error: "Auth window closed" })
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

export const snowflakeAPI = new SnowflakeService()
export default snowflakeAPI
