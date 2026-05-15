// Static product knowledge for the in-product assistant.
// Used when Pinecone RAG is unavailable (empty PINECONE_API_KEY) so the
// model can answer feature questions accurately without retrieval.
//
// Keep this concise (~500 tokens). Anything that drifts (per-org metrics,
// run-specific numbers) belongs in the page-context block, NOT here.

export const STATIC_PRODUCT_CONTEXT = `
RightRev is a data quality + ERP sync platform. Core surfaces:

1. Data Catalog (/files)
   - Upload CSV / Excel / JSON / TXT or import from a connector.
   - Each file moves through statuses: UPLOADING → UPLOADED → VALIDATED → DQ_DISPATCHED → DQ_RUNNING → DQ_FIXED. Terminal failure states: DQ_FAILED, UPLOAD_FAILED, REJECTED.
   - DQ score is the percent of cells that passed all rules (clean cells / total cells × 100).
   - Files are versioned. Each Quarantine reprocess produces a new version (v1, v2, ...).

2. DQ Engine
   - Runs 30+ rules across categories: universal (whitespace, encoding, null/empty, duplicates, security), contact (email/phone/address), date (12 formats), numeric (currency, UOM, ranges), domain (GL codes, fiscal periods), security (PII, injection).
   - Auto-fixes safe issues, quarantines anything ambiguous or unsafe.
   - Pipeline: orchestrator → manager → worker fleet (DistributedMap, 40 concurrency) → aggregator → materialize.
   - Performance: ~1M rows in ~36s, 60M rows in ~92s, throughput ~650K rows/sec. Files up to 50 GB and 2.5 TB streaming.

3. Quarantine Editor (/files/{id}/quarantine)
   - Edits quarantined rows in an AG Grid that handles millions of rows.
   - Cell colors: green = clean / fixed, red = needs action, yellow = edited unsaved.
   - Auto-saves edits in the background; no manual save button.
   - Real-time multi-user collaboration via WebSocket: presence avatars, per-cell locks.
   - Version history: switch to a previous version, download clean or quarantined records per version.
   - Reprocess button: pushes only the just-fixed rows back through DQ + connector export (delta reprocess).

4. Jobs (/jobs)
   - Automated source → DQ → destination pipelines. Cron or one-time.
   - Run statuses: SUCCESS (all rows landed), PARTIAL (some rows landed AND some quarantined), AWAITING_REVIEW (zero rows landed, everything quarantined), FAILED, NO_CHANGES.
   - PARTIAL run-detail modal shows amber banner: "X of Y records pushed to destination · Z records awaiting your review · Open Quarantine Editor".
   - Cron builder presets: every 5/15/30 min, hourly, every 2/6 hours, daily midnight, daily 9 AM, weekdays 9 AM, Mondays 9 AM, 1st of month. Custom cron is 6-field EventBridge syntax with live IST next-fire-time preview.

5. Connectors (/admin → Connectors)
   - 32+ integrations across three categories.
   - ERP: QuickBooks Online, Zoho Books, Salesforce, NetSuite, Epicor Kinetic, QAD ERP, Odoo, Microsoft Dynamics 365 BC, ERPNext/Frappe, Oracle ORDS, SAP S/4HANA Cloud, Xero, Dolibarr, Katana MRP, Sage Business Cloud, MYOB Acumatica, Stripe, Square, Chargebee, Razorpay, Recurly, BILL, ChargeOver, NolaPro, TaxJar, Adyen, Paddle, Braintree, Authorize.Net, PayPal.
   - Data Warehouses: Snowflake.
   - Cloud Storage: Google Drive.
   - OAuth-based connections; tokens auto-refresh. If refresh fails (revoked / expired refresh token / Snowflake 90-day cap), reconnect manually.

6. Dashboard (/dashboard)
   - KPIs: total files, processed files, average DQ score, total quarantined rows.
   - Recent Activity card → click any item to open the file's preview directly.
   - Top DQ Issues lists the most frequent rule violations across all files.

7. Org / Admin (/admin)
   - Tabs: Organization, Members, Permissions, Services, Connectors, Approvals.
   - GDPR Art. 15-22 / DPDPA: Export my data, Delete my account, Delete organization.
`.trim()

// Route → list of canonical Q&A pairs the model can echo verbatim.
// Format: question → answer (the model will phrase it naturally; this is grounding,
// not a script). Keep each answer ≤ 2 sentences.
export const ROUTE_QA_PACK: Record<string, Array<{ q: string; a: string }>> = {
  '/dashboard': [
    {
      q: 'What does each KPI on the dashboard mean?',
      a: 'Total Files = uploads in the org; Processed = files that completed DQ (status DQ_FIXED); Avg DQ Score = mean clean-cell percentage across processed files; Quarantined Rows = total rows still needing remediation.',
    },
    {
      q: 'Why does Recent Activity show some files in amber?',
      a: 'Amber means the file is still mid-pipeline (UPLOADING / VALIDATED / DQ_RUNNING). Red means a terminal failure (DQ_FAILED / UPLOAD_FAILED). Green is DQ_FIXED.',
    },
    {
      q: 'What are the Top DQ Issues based on?',
      a: 'Aggregated rule-violation counts across every processed file in your org. Click an issue to drill into the files where it appears most.',
    },
  ],
  '/files': [
    {
      q: 'Why is my file stuck at "Uploaded"?',
      a: 'It usually means the file validator hasn\'t picked it up yet. Wait ~30s; if it stays put, the auto-detect step may have rejected the file because its column headers don\'t match any registered ERP entity schema.',
    },
    {
      q: 'What\'s the difference between "Complete" and "DQ_FIXED"?',
      a: 'Both mean the DQ pipeline finished successfully. "Complete" is the user-friendly label in the catalog; "DQ_FIXED" is the underlying canonical status used by the engine and APIs.',
    },
    {
      q: 'Can I open a file\'s preview without opening the catalog row first?',
      a: 'Yes — click any item in the Dashboard\'s Recent Activity card and the preview modal opens directly on the file detail.',
    },
    {
      q: 'How do I download just the clean rows?',
      a: 'Open the file detail → Versions tab → pick a version → Download (clean) or Download (quarantined). Each version exports independently.',
    },
  ],
  '/jobs': [
    {
      q: 'What\'s the difference between PARTIAL and AWAITING_REVIEW?',
      a: 'PARTIAL = some rows pushed to the destination AND some are quarantined. AWAITING_REVIEW = zero rows pushed yet because everything is quarantined. Both surface the Open Quarantine Editor button so you can fix and re-run.',
    },
    {
      q: 'How do I trigger a job manually?',
      a: 'Click the kebab menu (⋯) on the job row and choose "Run Now". The run appears in the inline run history within seconds.',
    },
    {
      q: 'Why is one of my Zoho jobs Auto-Paused?',
      a: 'Auto-Pause kicks in when the connector returns repeated authentication or subscription errors. Most common cause: the Zoho Books subscription has expired on Zoho\'s side. Renew the plan and the job resumes.',
    },
    {
      q: 'How does the cron builder work?',
      a: 'Pick a frequency preset chip (Hourly, Daily 9 AM, etc.), or switch to Custom (Cron) for the 6-field EventBridge syntax. The next-5-firing-times preview is computed in IST and updates as you edit.',
    },
  ],
  '/jobs/create': [
    {
      q: 'What goes in Source vs Destination?',
      a: 'Source is where data is read from (a Snowflake table, a QuickBooks entity, a Google Drive file). Destination is where the cleaned data is written. Both can be ERP / Warehouse / Storage connectors.',
    },
    {
      q: 'Why is the Schema dropdown empty for my Snowflake source?',
      a: 'Usually the Snowflake OAuth refresh token has expired or been revoked. Go to Admin → Connectors → Snowflake → Disconnect, then Connect again to re-authorize.',
    },
    {
      q: 'When should I use Advanced configuration?',
      a: 'Default DQ rules + auto-mapping work for ~80% of pipelines. Open Advanced when you need manual column mapping, business consistency rules, or per-column DQ overrides.',
    },
  ],
  '/admin': [
    {
      q: 'How do I disconnect a connector?',
      a: 'Admin → Connectors tab → find the provider → Disconnect. This revokes the stored tokens; any jobs using that connector will pause until you reconnect.',
    },
    {
      q: 'What does the Approvals tab do?',
      a: 'Lists pending member invites and role-change requests that need a superadmin to approve before they take effect.',
    },
  ],
}

// Build the static-knowledge block to inject into the system prompt when
// RAG is unavailable. Includes the global product context + page-specific
// Q&A drawn from ROUTE_QA_PACK based on the page-context route.
export function buildStaticKnowledgeBlock(route: string | null | undefined): string {
  const lines: string[] = ['Product reference (use this as your knowledge base):', STATIC_PRODUCT_CONTEXT]

  if (route) {
    // Match longest-prefix route key (so /files/[id]/quarantine still grabs /files entries).
    const matchKey = Object.keys(ROUTE_QA_PACK)
      .sort((a, b) => b.length - a.length)
      .find((k) => route === k || route.startsWith(`${k}/`) || route.startsWith(k))

    if (matchKey) {
      const pairs = ROUTE_QA_PACK[matchKey]
      lines.push(
        '',
        `Common questions on this page (${matchKey}). Echo these answers when the user asks something close, paraphrasing naturally:`,
      )
      for (const { q, a } of pairs) {
        lines.push(`- Q: ${q}`)
        lines.push(`  A: ${a}`)
      }
    }
  }

  return lines.join('\n')
}
