"use client"

// ─── ConnectorLogo ───────────────────────────────────────────────────────────
// Shared visual representation of a connector / provider. Uses self-hosted SVGs
// from /public/connectors/{slug}.svg. Falls back to a generic plug glyph for
// unknown providers. Sizes are constrained with max width AND max height and
// `object-contain` so non-square logos do not distort.

import { useState } from "react"

// Map every known provider id (and a few common aliases) → asset slug under
// /public/connectors/. Any provider not listed here falls back to "generic".
const PROVIDER_LOGO_SLUG: Record<string, string> = {
    quickbooks: "quickbooks",
    "quickbooks-online": "quickbooks",
    quickbooks_online: "quickbooks",
    qb: "quickbooks",

    zohobooks: "zoho-books",
    "zoho-books": "zoho-books",
    zoho_books: "zoho-books",
    zoho: "zoho-books",

    snowflake: "snowflake",

    googledrive: "google-drive",
    "google-drive": "google-drive",
    google_drive: "google-drive",
    gdrive: "google-drive",

    netsuite: "netsuite",
    sap: "sap",
    salesforce: "salesforce",
    dynamics: "dynamics",
    microsoft_dynamics: "dynamics",
    "microsoft-dynamics": "dynamics",
    epicor: "epicor",
    qad: "qad",
    oracle: "oracle",
    workday: "workday",
    sage: "sage",
    "infor-m3": "infor-m3",
    infor_m3: "infor-m3",
    "infor-ln": "infor-ln",
    infor_ln: "infor-ln",
    ifs: "ifs",

    // UI-only ERP / billing / payment connectors (Simple Icons + Wikimedia + neutral fallback)
    odoo: "odoo",
    d365: "d365",
    "dynamics-365": "d365",
    erpnext: "erpnext",
    oracleords: "oracleords",
    "oracle-ords": "oracleords",
    xero: "xero",
    dolibarr: "dolibarr",
    katana: "katana",
    "katana-mrp": "katana",
    "sage-accounting": "sage",
    sage_accounting: "sage",
    "myob-acumatica": "myob-acumatica",
    myob_acumatica: "myob-acumatica",
    acumatica: "myob-acumatica",
    stripe: "stripe",
    square: "square",
    chargebee: "chargebee",
    razorpay: "razorpay",
    recurly: "recurly",
    bill: "bill",
    "bill-com": "bill",
    chargeover: "chargeover",
    nolapro: "nolapro",
    taxjar: "taxjar",
    adyen: "adyen",
    paddle: "paddle",
    braintree: "braintree",
    authorizenet: "authorizenet",
    "authorize-net": "authorizenet",
    paypal: "paypal",

    // Ingestion protocols
    ftp: "ftp",
    sftp: "sftp",
    http: "http",
    https: "http",
    tcp: "tcp",
}

export type ConnectorLogoSize = "xs" | "sm" | "md" | "lg"

const SIZE_PX: Record<ConnectorLogoSize, number> = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 40,
}

interface ConnectorLogoProps {
    /** Provider id (e.g. "quickbooks") or a free-form slug. Case-insensitive. */
    provider: string
    /** Constrains both width AND height to prevent distortion. */
    size?: ConnectorLogoSize
    /** Extra Tailwind classes — applied to the wrapping <span>. */
    className?: string
    /** Optional accessible label override. Defaults to provider id. */
    alt?: string
}

function slugFor(provider: string): string {
    if (!provider) return "generic"
    const key = provider.toLowerCase().trim()
    return PROVIDER_LOGO_SLUG[key] || "generic"
}

/**
 * Renders the brand glyph for a connector. Uses a native <img> rather than
 * next/image because (a) the assets are tiny inline SVGs, (b) we already set
 * `images.unoptimized: true` in next.config.mjs so Image gives no benefit here,
 * and (c) <img> avoids the layout-shift gotcha of unsized Image children.
 */
export function ConnectorLogo({ provider, size = "md", className = "", alt }: ConnectorLogoProps) {
    const px = SIZE_PX[size]
    const initialSlug = slugFor(provider)
    const [slug, setSlug] = useState(initialSlug)

    return (
        <span
            className={`inline-flex items-center justify-center shrink-0 ${className}`}
            style={{ width: px, height: px }}
        >
            <img
                src={`/connectors/${slug}.svg`}
                alt={alt || provider}
                width={px}
                height={px}
                className="object-contain"
                style={{ width: px, height: px }}
                onError={() => {
                    // Fallback to generic plug glyph if a specific asset 404s.
                    if (slug !== "generic") setSlug("generic")
                }}
                draggable={false}
            />
        </span>
    )
}

export default ConnectorLogo
