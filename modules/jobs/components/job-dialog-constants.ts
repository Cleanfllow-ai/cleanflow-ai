// ─── Job dialog constants ─────────────────────────────────────────────────────
// Only frequency options are hardcoded — providers and entities come from the
// backend via /connectors/available and /connectors/{category}/{provider}/entities.

export const FREQUENCY_OPTIONS = [
    { label: "Every 15 min", value: "15min" },
    { label: "Every hour", value: "1hr" },
    { label: "Daily", value: "daily" },
    { label: "Custom (Cron)", value: "cron" },
    { label: "Batch (One-time)", value: "batch" },
]

export const CATEGORY_LABELS: Record<string, string> = {
    erp: "ERP Systems",
    warehouse: "Data Warehouses",
    storage: "Cloud Storage",
}

// Display names for known providers — unknown providers show their ID titlecased
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    quickbooks: "QuickBooks Online",
    zohobooks: "Zoho Books",
    snowflake: "Snowflake",
    googledrive: "Google Drive",
    netsuite: "NetSuite",
    dynamics: "Microsoft Dynamics",
    sap: "SAP",
    salesforce: "Salesforce",
    epicor: "Epicor Kinetic",
    qad: "QAD",
    oracle: "Oracle Fusion",
}

export function getProviderDisplayName(providerId: string): string {
    return PROVIDER_DISPLAY_NAMES[providerId] || providerId
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
}
