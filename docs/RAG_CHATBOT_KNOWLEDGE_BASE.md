# RightRev – Customer Knowledge Base for RAG Chatbot

Version: 1.0 (2026-05-15)

---

## What is RightRev

RightRev is a data quality platform that ingests CSV files from your team, automatically detects and fixes common data issues (whitespace, encoding, malformed dates, invalid emails, wrong country codes, etc.), and quarantines rows that can't be auto-fixed so a human can review and correct them. The cleaned data can then be exported to your ERP (QuickBooks, Zoho Books), pushed to your data warehouse (Snowflake), or downloaded as clean CSV / Parquet.

RightRev is built on top of CleanFlowAI's data-quality engine and is hosted on AWS in your dedicated Austin tenant (region us-east-2).

## Who uses RightRev

RightRev is designed for finance, RevOps, and data-engineering teams who deal with messy CSV exports from upstream systems — Salesforce, NetSuite, Zuora, Stripe, Snowflake views — and need to standardize that data before pushing it back into a system of record. Typical users include AR/AP analysts (uploading invoice batches), revenue accountants (loading deferred-revenue tables for ASC 606), customer-success leads (cleaning contact lists before a marketing campaign), and data engineers (validating large vendor extracts before ingest into their warehouse).

## The four user roles

RightRev has four roles, each with specific permissions. Super Admin has full control — manages members, settings, billing, and all data. The user who creates the org is automatically assigned Super Admin. Admin can manage members (invite, change roles to Admin/Data Steward/Member), see all files, but cannot change billing. Data Steward can upload and edit files, manage transformations and exports, but cannot manage members or billing. Member can upload files and view their own data, but cannot edit other users' files or manage members. Members cannot trigger augmentation jobs.

## How to sign up and create an organization

To sign up, go to https://rightrev.vercel.app, click "Sign up", enter your name, email, and a password. The password must be at least 12 characters long and contain uppercase, lowercase, and a digit (symbol is optional). On the next page, enter your organization name, industry, and a contact person. Click "Create Organization". You will receive a verification code via email — enter it to complete signup. You become the Super Admin of the new organization automatically.

## Why I might see Permission denied

If you see "Permission denied" on actions you think you should be able to perform, check your current role in the top-right profile dropdown. If your role is "Member" or "Data Steward" but you expected "Super Admin", contact your organization admin to promote you. If you are the original creator of the organization and still see "Permission denied", this is a bug — refresh the page first; if it persists, log out and back in. Your role is set on the server when the org is created and should be Super Admin.

## How to invite team members

If you are Super Admin or Admin, go to Settings → Members and click "Invite". Enter the email address and pick a role (Admin, Data Steward, or Member — only Super Admin can invite another Super Admin). The invitee receives an email with a link that expires in 7 days. They click the link, set a password, and join your organization. Up to 50 active members can exist in one organization on the standard plan; contact support for higher limits.

## I didn't receive my invite email

Invite emails are sent through Amazon SES from a verified sender. If you do not see the email within 5 minutes, check your spam folder. If still missing, ask your admin to resend the invite from Settings → Members → Pending Invites → click "Resend". If repeated attempts fail, the admin can manually copy the invite link from the member detail panel and send it directly via Slack, WhatsApp, or chat. Common causes of missing emails are corporate firewalls flagging the sender, full inbox, or a typo in the email address — confirm the address before re-inviting.

## How to upload a file

Click "Data Catalog" in the left sidebar, then "Import File" in the top right. Choose a CSV file from your computer. The maximum file size depends on your plan — free is 100 MB, starter 5 GB, pro 50 GB, enterprise 200 GB, unlimited has no cap. The file uploads to S3 directly via a presigned URL — your browser uploads the bytes; the server only sees the metadata. Once uploaded, the file enters the "Validation" state for about 5 seconds, then automatically dispatches to the data-quality engine.

## What happens during data quality processing

After upload, RightRev runs your file through a multi-stage pipeline. First, FileValidator confirms the CSV is well-formed (no missing headers, no oversized rows). Then DQ Manager reads a sample, detects column types using a large language model (Groq llama-3.3), and writes a shard plan. DQ Workers run in parallel — for a 10-million-row file they fan out to up to 40 workers, each handling about 250k rows. Each row is checked against 33 universal rules plus any custom rules and cross-field rules you have defined. The reduce stage merges per-shard results, the materialize stage writes the cleaned Parquet and the quarantine read-model, and the status updater marks the file DQ_FIXED.

## How long does data quality processing take

Typical processing time for a 100,000-row file is 12–15 seconds. A 1-million-row file takes about 30 seconds, a 10-million-row file takes about 2 minutes. Large files (100 GB+) can take 10–20 minutes because of S3 throughput limits. If your file has been in DQ_RUNNING state for more than 30 minutes without progress, contact support — there may be a stuck worker or a transient AWS issue. Files larger than 200 GB are rejected on the unlimited plan unless you contact support to raise the limit.

## What the 33 universal data-quality rules check

R1 (Missing Required Value) checks columns marked required have no empty cells. R2 (Whitespace Padding) detects leading or trailing spaces. R3 (Multiple Spaces) detects more than one space between words. R4 (Tabs and Control Chars) detects tabs, newlines, and zero-width chars. R5–R8 (Encoding) detect Mojibake, BOM, mixed encoding, and non-printable bytes. R9–R12 (Casing) detect inconsistent capitalization. R13–R16 (Dates) detect invalid calendar dates, ambiguous formats, and date-out-of-range. R17–R20 (Numbers) detect non-numeric in numeric columns, sign inconsistency, scientific notation, and currency formatting. R21–R24 (Duplicates) detect exact and fuzzy duplicates. R25–R28 (Identifiers) detect bad GL codes, invalid SKUs, malformed IDs. R29–R33 (Contact and format) detect invalid emails, malformed phone numbers, bad country codes, and SQL/XSS injection attempts.

## What quarantined means

A row is quarantined when the engine detects an issue it cannot auto-fix safely. For example, whitespace padding is auto-fixed (R2 strips it); but a row with a malformed email like foo@@bar cannot be auto-corrected — the engine quarantines that row so you can review and fix it. Quarantined rows are kept in a separate view (the Quarantine Editor) and do not end up in your cleaned output until you fix them. You can edit quarantined cells directly, run find-and-replace across them, or delete rows that are not recoverable.

## How to edit quarantined data

Click into a file with quarantined rows, then click "Open Quarantine Editor". You see all quarantined rows in a spreadsheet-like view with the failing rules highlighted on each cell. Click any cell to edit it directly — your changes are saved automatically and tracked in an audit log. You can run find-and-replace across a column (Tools → Find and Replace), filter by failing rule (sidebar), and bulk-delete rows (select rows → Delete). When you have finished editing, click "Reprocess" — RightRev re-runs the DQ engine on the edited rows and merges them back into the clean output.

## Collaborative editing multiple users editing the same file

The Quarantine Editor supports real-time multi-user collaboration. When you click into a cell, it locks for you for 60 seconds — other users see a "User is editing" indicator and cannot edit that same cell. When you click away or your session disconnects, the lock releases within 2 seconds. Up to 10 users can simultaneously edit the same file. If your edit conflicts with another user's edit, the second writer's change is rejected and they see a "cell changed — please refresh" toast. Locks are stored in DynamoDB and expire automatically via TTL.

## How to download cleaned data

After your file has reached DQ_FIXED status, you can download the cleaned output. Click the file in Data Catalog, then click "Download". You can choose CSV (default) or Parquet (recommended for large files; loads natively into Snowflake, BigQuery, Spark, pandas). The download includes only clean and auto-fixed rows by default. If you want quarantined rows too, toggle "Include quarantined" in the download dialog. Downloads are presigned URLs valid for 60 minutes; refresh the page to generate a new URL if it expires.

## Augmentation AI-powered column enrichment

Augmentation lets you add columns to your data by writing a natural-language prompt. For example: "Add a column called country_iso2 that converts the existing country_name column to ISO 3166 alpha-2 code." RightRev's Groq LLM generates a Polars expression and applies it across your file. Augmentation jobs run asynchronously — submit the job and check back; for 1 million rows expect 1–3 minutes. Only Admin and Super Admin can submit augmentation jobs; Members are read-only for this feature.

## ERP connectors QuickBooks and Zoho Books

RightRev integrates with QuickBooks Online and Zoho Books for two-way data flow. Import pulls Customers, Vendors, Invoices, Items, and other entities from the ERP into RightRev as a file — useful for cleaning up legacy customer lists. Export pushes selected rows from a cleaned RightRev file into the ERP as new records or updates to existing records. To use, go to Connectors → click "Connect QuickBooks" (or Zoho), authorize the OAuth flow, then on any cleaned file click "Export" and pick the destination entity. Mapping columns from your file to ERP fields is AI-assisted — RightRev pre-fills the mapping based on column names and confirms with you before pushing.

## Warehouse connector Snowflake

RightRev integrates with Snowflake for bulk import and bulk export. Import runs a SELECT against a table or view in your Snowflake account and pulls the result into RightRev as a file. Export loads a cleaned RightRev file into a target table — either creating a new table or appending to an existing one. To connect, go to Connectors → "Connect Snowflake" → enter your account URL, warehouse, database, schema, and authorize. RightRev uses Snowflake OAuth — your password never leaves Snowflake. Imports up to 100 GB are supported on the unlimited plan.

## Storage connector Google Drive

RightRev can pull files directly from your Google Drive — useful when your data lives in shared Drives instead of your laptop. Go to Connectors → "Connect Google Drive", authorize, then in the Import dialog browse to a CSV file in your Drive. The file is copied into RightRev and processed normally. RightRev requests read-only Drive access by default; we never write back to your Drive. To revoke access at any time, go to your Google account → Security → Third-party apps → revoke RightRev.

## Custom data-quality rules

If the 33 built-in rules do not cover your business case, write custom rules in natural language. Go to Settings → DQ Rules → "Add Custom Rule". For example: "GL code must be 6 digits starting with a 4 for revenue accounts." RightRev's LLM converts your description into Polars expressions and applies them across your file. Custom rules apply to ALL future uploads in your organization. You can preview a rule against a sample before saving — RightRev shows which rows would be flagged. Up to 50 custom rules per org on the standard plan.

## Cross-field rules validating relationships between columns

Cross-field rules check the relationship between two or more columns in the same row. For example: recognition_end_date must be after recognition_start_date. Or: if recognition_method is ratable, then recognition_start_date and recognition_end_date are both required. Cross-field rules are written in natural language too. To add one, go to Settings → DQ Rules → "Add Cross-Field Rule". Cross-field rules run in parallel with the per-cell rules and quarantine the row if any check fails.

## DQ score what the percentage means

Every processed file gets a DQ score — a percentage from 0 to 100. The formula is (clean_rows + auto_fixed_rows) divided by total_rows multiplied by 100. A score of 100 means every row is clean or auto-fixed and ready to export. A score below 50 means more than half the rows ended up in quarantine — likely a schema mismatch with your DQ rule preset, or the source data is genuinely bad. RightRev shows the score next to each file in the Data Catalog.

## Plan tiers and file-size limits

RightRev has 5 plan tiers. Free allows 100 MB per file. Starter allows 5 GB per file at $99 per month. Pro allows 50 GB per file at $299 per month. Enterprise allows 200 GB per file at custom pricing. Unlimited has no cap at custom pricing. All plans get unlimited number of files. To upgrade, go to Settings → Billing.

## How RightRev keeps your data secure

All data uploaded to RightRev is encrypted at rest in Amazon S3 using AES-256 server-side encryption. All API calls require a Cognito JWT bearer token; tokens expire after 1 hour. The WebSocket collaborative editor uses a separate Cognito access token, validated on every connect. All cross-region API calls use SigV4 signing. We never log raw row data — only file metadata and row counts.

## SOC 2 and DSAR Data Subject Access Request

RightRev is built to support SOC 2 Type II compliance. Every action that modifies data writes an audit log row to a tamper-evident DynamoDB table. To satisfy a DSAR (e.g. GDPR right to be forgotten), an admin can request a full export of all data attributable to a specific user, or a cascade-delete that removes all files, audit-log entries, and OrgMember rows for that user. DSAR operations require Super Admin role and are themselves audit-logged.

## File lifecycle and retention

Files in RightRev pass through these states: UPLOADING → UPLOADED → VALIDATED → DQ_DISPATCHED → DQ_RUNNING → DQ_FIXED (success) or DQ_FAILED (engine could not process) or REJECTED (file too big or wrong format). A file stays in your Data Catalog until you delete it. When you delete a file, RightRev cascade-deletes the raw CSV from S3, all DQ result artifacts, all quarantine edit history, and all reprocess outputs.

## Common errors and what they mean

"Permission denied" means your role does not have permission for that action; ask an admin to check Settings → Members. "File too large" means your file exceeds your plan tier's size limit; upgrade or split the file. "DQ_FAILED Empty file" means your file uploaded as 0 bytes; re-upload. "Invite email delivery failed" means Amazon SES could not deliver to that address; copy the invite link manually and send via chat. "Token expired" means your session is over 1 hour old; refresh the page. "Cell changed please refresh" means another user edited the same quarantined cell; refresh to see their changes.

## Troubleshooting I cannot log in

If you cannot log in, first confirm the password meets the policy: at least 12 characters, with uppercase, lowercase, and at least one digit. If you forgot it, click "Forgot password" — RightRev sends a reset code via email. If you do not receive the reset email, ask your Super Admin to reset your password directly via Settings → Members → click your row → "Reset Password". TOTP MFA may be enabled on your account — you will need to enter the 6-digit code from your authenticator app after the password.

## Troubleshooting my upload looks stuck

If your file has been in VALIDATED or DQ_DISPATCHED state for more than 5 minutes, this is unusual. Possible causes: the AWS Step Functions state machine might be cold-starting; the file might have triggered a DQ rule that requires LLM evaluation; or there is a transient AWS issue. Wait 2 more minutes; if still stuck, click "Refresh" on the Data Catalog row. If still stuck after 30 minutes, contact support with your upload_id visible in the file detail URL.

## Troubleshooting my export to QuickBooks failed

QuickBooks export failures usually mean: your OAuth token expired — re-authorize in Settings → Connectors → QuickBooks; the entity you are exporting to requires a field your file is missing — RightRev shows the missing field with a red marker; or you are hitting Intuit's API rate limit of 10 requests per second per realm — RightRev auto-retries with backoff but very large exports might need to be split.

## Pricing and billing

RightRev billing is monthly per-organization, not per-user. The standard plans are: Starter $99, Pro $299, Enterprise $999 plus custom add-ons. All plans include unlimited users, unlimited files, unlimited augmentation calls, and the full set of connectors. There is no per-row cost. To change your plan, go to Settings → Billing → Change Plan. Invoices are sent on the 1st of each month to the Super Admin's email address, and payment is by card via Stripe.

## Architecture overview for technical users

RightRev backend is a serverless AWS stack: API Gateway in front of 11 Lambda functions organized as bounded contexts (auth, org, files, ingest, dq, settings, connectors, jobs, remediation, augmentation, observability). Data lives in S3 and DynamoDB. The DQ engine uses AWS Step Functions DistributedMap for parallel processing — a 10M-row file fans out to 40 workers. The collaborative quarantine editor uses API Gateway WebSocket and DynamoDB conditional writes for cell locking.

## How RightRev compares to alternatives

Versus Trifacta, Talend, or Informatica: RightRev is lighter-weight, no on-prem install, no Java setup; pure SaaS, sign up in 30 seconds. Versus dbt: dbt requires you to write SQL transforms by hand; RightRev's DQ rules are out-of-the-box for the common 80% of cleanup work. Versus Snowflake's native data-quality functions: those are limited to schema-level checks; RightRev does row-level fuzzy detection that SQL cannot easily express. Versus Excel: Excel cannot handle 10-million-row files without crashing; RightRev does in 2 minutes what Excel cannot do at all.

## Getting help

For product questions, click the in-app chat icon on any page — that is the RightRev assistant. For account issues (login, billing, MFA reset), email support@infiniqon.com. For urgent production issues, your Super Admin has a dedicated Slack channel with our team.

## Glossary

Cognito is the AWS user authentication service that backs RightRev's signup and login flow. DQ means Data Quality. DQ_FIXED is a file state meaning the engine finished processing and the cleaned output is available. Quarantine refers to rows that failed automated cleanup and need human review. Shard is a slice of a large file processed by one DQ worker in parallel. Reprocess means re-running DQ on the rows you edited in the quarantine editor. OrgMember is a row in DynamoDB tying a Cognito user to an Org with a specific role. DSAR stands for Data Subject Access Request, a GDPR concept for getting or deleting all data about a person. SigV4 is AWS's signature-based request signing that protects API calls.
