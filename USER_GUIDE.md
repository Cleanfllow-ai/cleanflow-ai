# CleanFlowAI — User Guide

**Application URL:** https://rightrev.vercel.app/

Welcome to CleanFlowAI. This guide walks you through everything you need to use the platform — from your first login to scheduling recurring data jobs and connecting your ERP systems.

The guide is split into two parts:

- **Part 1 — End-User Guide:** Day-to-day use (uploading files, checking results, downloading data, importing from QuickBooks, etc.).
- **Part 2 — Administrator Guide:** Organization setup, inviting team members, connecting providers, managing presets and scheduled jobs.

---

## Table of Contents

**Part 1 — End-User Guide**

1. [What is CleanFlowAI?](#1-what-is-cleanflowai)
2. [Getting Started: Sign Up & First Login](#2-getting-started-sign-up--first-login)
3. [The Dashboard](#3-the-dashboard)
4. [Uploading & Processing Files](#4-uploading--processing-files)
5. [Viewing & Understanding Results](#5-viewing--understanding-results)
6. [Downloading Cleaned Data](#6-downloading-cleaned-data)
7. [Data Augmentation (AI Enrichment)](#7-data-augmentation-ai-enrichment)
8. [Account & Password Help](#8-account--password-help)

**Part 2 — Administrator Guide**

9. [Organization Setup](#9-organization-setup)
10. [Managing Team Members & Roles](#10-managing-team-members--roles)
11. [Connecting ERPs: QuickBooks & Zoho Books](#11-connecting-erps-quickbooks--zoho-books)
12. [Connecting a Data Warehouse: Snowflake](#12-connecting-a-data-warehouse-snowflake)
13. [Connecting Cloud Storage: Google Drive](#13-connecting-cloud-storage-google-drive)
14. [Data Quality Rule Presets](#14-data-quality-rule-presets)
15. [Scheduling Recurring Jobs](#15-scheduling-recurring-jobs)
16. [Status Reference & Glossary](#16-status-reference--glossary)
17. [Troubleshooting & FAQ](#17-troubleshooting--faq)

---

# PART 1 — END-USER GUIDE

## 1. What is CleanFlowAI?

CleanFlowAI is a data quality and transformation platform. You upload data files (CSV or Excel) — typically exported from an ERP system — and CleanFlowAI:

- **Validates** the data against built-in quality rules (formatting, missing values, duplicates, invalid emails, bad dates, etc.).
- **Fixes** issues automatically where it safely can.
- **Quarantines** rows it cannot fix so you can review them.
- **Transforms** the cleaned data into the format expected by your target ERP.

You can also schedule the entire process to run automatically on a recurring basis.

---

## 2. Getting Started: Sign Up & First Login

### 2.1 Creating an Account

1. Go to **https://rightrev.vercel.app/**.
2. Click **Sign Up**.
3. Enter your **email** and a **password** that meets these rules:
   - At least 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - A special character is recommended
4. Click **Create Account**.

### 2.2 Verifying Your Email

After signup you'll receive a 6-digit verification code by email.

1. Enter the 6-digit code on the verification screen.
2. Click **Verify**.
3. If the code expires (5 minute timer), click **Resend Code**.

### 2.3 Joining an Organization

After your first login, one of two things happens:

**Scenario A — You were invited:** Your admin sent you an invite email. Click the link in that email; you'll be taken to a **Set Password** page. Set your password, then sign in — you'll be added to the organization automatically.

**Scenario B — You're the first user:** You're routed to **Create Organization**. Fill in:

- Organization name
- Industry
- Contact email
- Phone number
- Address
- GSTIN / PAN (if applicable)

Click **Register & Continue**.

---

## 3. The Dashboard

**Route:** `/dashboard`

The dashboard is your home screen and shows the overall health of your data.

### Top Metrics (cards along the top)

| Card | What it means |
|---|---|
| **Total Files** | Number of files you've uploaded. Sub-text shows how many are fully processed. |
| **Average DQ Score** | Average data-quality score across all files. Badge color: green ≥ 90%, yellow ≥ 70%, red < 70%. |
| **Rows Processed** | Total input rows across all files; sub-text shows clean output rows. |
| **Issues Fixed** | Total rows the system automatically corrected; sub-text shows how many were quarantined. |

### Charts

- **Data Quality Distribution** (pie chart) — Clean (green) / Fixed (yellow) / Quarantined (red) rows across all files.
- **DQ Score Distribution** (bar chart) — How many of your files fall into Excellent, Good, or Needs-Attention buckets.

### Header Buttons

- **Refresh** — Reloads metrics.
- **Export** — Downloads `overall-dq-report.json` with all your metrics in one file.
- **Logout** — Signs you out.

### Activity Feed (right side)

A live feed of recent actions: uploads, transforms, downloads, errors. Each item shows what happened, by whom, and when (in IST).

---

## 4. Uploading & Processing Files

**Route:** `/files`

The File Manager has two tabs at the top: **File Upload** and **File Explorer**.

### 4.1 Uploading a Local File

1. Click the **File Upload** tab.
2. From the **Source** dropdown, choose **Local File**.
3. Check the **AI Processing** toggle:
   - **On** *(default)* — the file is processed automatically after upload.
   - **Off** — the file is only uploaded; you'll need to start processing manually.
4. **Drag and drop** your CSV/Excel file into the upload zone, or click the zone to open a file picker.
5. Wait for the upload bar to reach 100%.

**Supported formats:** `.csv`, `.xlsx`, `.xls`

### 4.2 Importing from QuickBooks Online

*(Requires QuickBooks to be connected — see §11.)*

1. From the **Source** dropdown, choose **QuickBooks Online**.
2. Fill in:
   - **Entity** — Customers, Invoices, Vendors, or Items.
   - **Max Records** — default 1000.
   - **From Date / To Date** *(optional)* — date range.
3. Click **Import from QuickBooks**.
4. The file appears in File Explorer and processing starts automatically.

### 4.3 Importing from Zoho Books

Same flow as QuickBooks — pick **Zoho Books** as the source, choose the entity, click **Import**.

### 4.4 The File Explorer

Click the **File Explorer** tab to see all your files. You can:

- **Search** by filename (top of the table).
- **Filter** by status (All / Uploaded / Processed / Processing / Queued / Failed).
- **Sort** by any column (Score, Rows, Uploaded date, etc.).

Each row has these **action icons** in the rightmost column:

| Icon | Action | Available When |
|---|---|---|
| ▶ Play | Start processing | UPLOADED, DQ_FAILED, or FAILED |
| 👁 Eye | View file details | Always |
| ⬇ Download | Download file | Always |
| 🗑 Trash | Delete file | Always |

### 4.5 What Happens During Processing

A file moves through these statuses:

```
UPLOADED → QUEUED → DQ_RUNNING → DQ_FIXED  ✅ Done
                              ↘ DQ_FAILED  ❌ Click Play to retry
```

Larger files take longer — you can keep browsing or check back later.

---

## 5. Viewing & Understanding Results

### 5.1 The File Details Dialog

Click the 👁 **Eye** icon next to any file. A dialog opens with three tabs:

#### Details Tab

Shows:

- **Rows In** — total input rows
- **Clean** — rows with no issues
- **Fixed** — rows the system corrected
- **Quarantined** — rows it could not fix
- **DQ Score** — overall quality percentage
- File size, upload time, last updated time

#### Preview Tab

Shows the first ~20 rows of your file in a scrollable table.

#### DQ Report Tab *(only for processed files)*

Shows detailed quality metrics per column. Click **Download Report** to get the full JSON.

### 5.2 Understanding Row Categories

| Category | Meaning |
|---|---|
| **Clean** | The system found no issues with this row. |
| **Fixed** | The system found issues but corrected them automatically (e.g., trimmed whitespace, normalized a date). |
| **Quarantined** | The system found issues it could not safely fix. These rows are **excluded** from the clean output — review them and either correct them at the source or accept the loss. |

### 5.3 Understanding the DQ Score

| Range | Rating | Color |
|---|---|---|
| 90 – 100% | Excellent | Green |
| 70 – 89% | Good | Yellow |
| < 70% | Needs Attention | Red |

---

## 6. Downloading Cleaned Data

1. Click the ⬇ **Download** icon on a processed file.
2. **Step 1 — Pick data type:**
   - **Cleaned Data** — quality-checked output (recommended).
   - **Original Data** — the raw file you uploaded.
3. **Step 2 — Pick format:**
   - **CSV** — universal compatibility (Excel, Google Sheets, etc.).
   - **Excel (.xlsx)** — native Excel format.
   - **JSON** — for programming / API use.
4. Click **Download**.

### Downloading the Detailed Issue Matrix

For very large files, the system stores an issue-only matrix (the `dq_matrix`) that lists exactly which cell in which row had what problem.

1. Open the file via the 👁 Eye icon.
2. Click **Download DQ Matrix**.
3. Enter:
   - **Limit** — how many issue rows to download (default 25).
   - **Start offset** — skip the first N rows.
   - **End** *(optional)* — last row index to include.
4. Click **Download**. You get a JSON file containing only the rows with issues.

---

## 7. Data Augmentation (AI Enrichment)

**Route:** `/augmentation`

Augmentation uses AI to enrich your data — for example, filling in missing fields, classifying records, or generating natural-language summaries.

### 7.1 Creating an Augmentation Job

1. Go to **/augmentation**.
2. Click **New job**.
3. In the form, pick:
   - **Prompt template** (e.g., "Classify vendor by industry")
   - **Input dataset** (one of your processed files)
4. Click **Submit**.

### 7.2 Monitoring & Downloading

- The job appears in the table with a status badge: Pending → Running → Succeeded / Failed.
- Click the job ID to open the detail panel — it shows row count, cost (USD), template, timestamps, and any error.
- Once status is **Succeeded**, click **Download output** to get the enriched CSV.

### 7.3 Prompt Templates Tab

Switch to the **Prompt Templates** tab to see all augmentation templates available to your organization.

---

## 8. Account & Password Help

### 8.1 Logging Out

Click your email/avatar at the bottom of the sidebar → **Logout**. Or use the **Logout** button in the dashboard header.

### 8.2 Forgot Password

1. On the login page, click **Forgot password?**.
2. Enter your email → click **Send reset code**.
3. Check your inbox for a numeric code.
4. Enter the code, a new password, and confirm.
5. Click **Reset password** — you'll be redirected to sign in.

### 8.3 Switching Theme

Click the sun/moon icon in the bottom-right corner of any page to switch between light and dark mode. The **System** option follows your operating system's preference.

---

# PART 2 — ADMINISTRATOR GUIDE

This section is for users with **Super Admin** or **Admin** roles. Most controls live under **Admin** in the sidebar.

## 9. Organization Setup

**Route:** `/admin` → **Organization** tab *(default)*

### 9.1 Organization Information

| Field | What it controls |
|---|---|
| Organization Name | Displayed throughout the app and on invitation emails. |
| Email | Primary contact email for the org. |
| Contact Number | Phone number. |
| Address | Business address. |

### 9.2 Logo

Click **Upload Logo** → pick an image. Used in the sidebar and on reports.

### 9.3 Preferred Data Format

Default format used when downloading: CSV / JSON / XLSX / SQL / Parquet.

Click **Save Changes** at the bottom to apply.

---

## 10. Managing Team Members & Roles

**Route:** `/admin` → **Members** tab

### 10.1 Inviting a Member

1. Click **Invite Member**.
2. Enter the member's email.
3. Pick a role:
   - **Super Admin** — Full access including billing.
   - **Admin** — All access except billing & subscription.
   - **Data Steward** — Can edit files and resolve quarantined rows.
4. Click **Send Invite**.

The invitee receives an email with a link to **/auth/set-password**. After setting their password, they're automatically added to your org.

### 10.2 Member Status Badges

| Badge | Meaning |
|---|---|
| **Active** *(green)* | Has accepted the invite and signed in. |
| **Pending** *(yellow)* | Invite sent but not yet accepted. |
| **Inactive** *(gray)* | Account disabled. |

### 10.3 Changing a Member's Role

1. Click the three-dot (⋮) menu on the member's row.
2. Pick the new role.
3. The change takes effect immediately.

### 10.4 Removing a Member

1. Click the three-dot menu → **Remove Member**.
2. Confirm. The member loses access and is detached from the org (their uploaded files remain).

### 10.5 The Permissions Tab

**Route:** `/admin` → **Permissions** tab

Shows a matrix of what each role can do. You can toggle individual permissions and click **Save Permissions**.

| Permission | Super Admin | Admin | Data Steward |
|---|:-:|:-:|:-:|
| File Management | ✅ | ✅ | ✅ |
| Data Transformation | ✅ | ✅ | ✅ |
| Export Data | ✅ | ✅ | ✅ |
| Manage Members | ✅ | ✅ | ❌ |
| Billing & Subscription | ✅ | ❌ | ❌ |
| Organization Settings | ✅ | ✅ | ❌ |
| API Access | ✅ | ✅ | ❌ |
| Audit Logs | ✅ | ✅ | ❌ |

---

## 11. Connecting ERPs: QuickBooks & Zoho Books

Connectors live in **Admin** → **Connectors** tab (or **Services** tab in older builds). Providers are grouped into **Applications** (ERPs), **Data Warehouses**, and **Cloud Storage**.

### 11.1 Connecting QuickBooks Online

1. In the **Applications** section, find **QuickBooks Online**.
2. Click the **Connect** (power) button on the card.
3. A popup opens at the QuickBooks sign-in page.
4. Sign in and click **Authorize**.
5. The popup redirects to **/connectors/callback**, confirms success, and closes automatically after ~2 seconds.
6. The card now shows **Connected** with the last-connected date.

**If the popup fails:** it stays open with **Try Again** and **Cancel** buttons. Click Try Again or check that your browser allows popups for `rightrev.vercel.app`.

### 11.2 Connecting Zoho Books

Same as QuickBooks — find **Zoho Books** in Applications, click **Connect**, sign in, authorize. After connection, the **Configure** link lets you pick your Zoho organization (if you have more than one).

### 11.3 Disconnecting

Click the power button again on a connected provider → **Disconnect** → confirm. Tokens are revoked immediately.

---

## 12. Connecting a Data Warehouse: Snowflake

Used to **import** data from a Snowflake table into CleanFlowAI for processing.

### 12.1 Connecting Snowflake

1. **Admin** → **Connectors** → **Data Warehouses** section → **Snowflake**.
2. Click **Connect**.
3. Enter:
   - **Account identifier** (e.g., `xy12345.ap-south-1`)
   - **Username**
   - **Password** (or key-pair credentials)
   - **Warehouse**
   - **Role**
4. Click **Save**.

### 12.2 Importing from Snowflake

1. Go to **/files** → **File Upload** tab.
2. Source → **Snowflake**.
3. Pick **Database** → **Schema** → **Table**.
4. Optionally add a **WHERE** clause to limit rows.
5. Click **Import**. The data is fetched, saved as a file, and processed.

---

## 13. Connecting Cloud Storage: Google Drive

Used to import files from Google Drive instead of uploading from your computer.

### 13.1 Connecting Google Drive

1. **Admin** → **Connectors** → **Cloud Storage** section → **Google Drive**.
2. Click **Connect**.
3. Sign in to Google and grant the requested permissions.
4. The popup closes; status flips to **Connected**.

### 13.2 Importing a File from Drive

1. **/files** → **File Upload**.
2. Source → **Google Drive**.
3. Browse your folders, pick a file, click **Import**.
4. The file is downloaded to CleanFlowAI and queued for processing.

---

## 14. Data Quality Rule Presets

Presets let you save a reusable set of DQ rules (which rules apply to which columns, severity thresholds, required columns, etc.) and apply them to multiple files.

### 14.1 Where Presets Live

When you process a file, you go through a **Settings** step. That step has a preset selector at the top.

- A **Default** preset is auto-seeded for every org and cannot be deleted.
- You can create as many additional presets as you need.

### 14.2 Creating a Preset

1. In the **Settings** step, click **New Preset**.
2. Pick **Start from** — either current edits or any existing preset.
3. Give it a name (e.g., "Vendor master rules").
4. Click **Create**.

### 14.3 Editing & Saving

Make any changes to rules, required columns, severity thresholds. Click **Save Preset**. (You cannot save changes onto the Default preset — create a new one first.)

### 14.4 Deleting

Click **Delete Preset** to remove the selected preset. The Default preset cannot be deleted.

### 14.5 Using a Preset

In the **Rules** step before processing, the selected preset's rules are pre-loaded. You can still toggle individual rules or add custom (LLM-generated) rules just for this run.

---

## 15. Scheduling Recurring Jobs

**Route:** `/jobs`

Jobs let you automate the full pipeline — pull data from a source, run DQ, optionally augment — on a schedule.

### 15.1 The Jobs List

The `/jobs` page shows all your scheduled jobs with:

- **Name**
- **Frequency** (e.g., daily, hourly, every 15 min, or custom cron)
- **Status** — Active (green, pulsing) / Paused (yellow) / Failed (red)
- **Last Run** and **Next Run** timestamps
- A row-actions menu: **Edit**, **Pause / Resume**, **View Runs**, **Delete**

Click any row to expand and see recent run history (date, records processed, status).

### 15.2 Creating a Job

1. Click **New Job** → routes to `/jobs/create`.
2. **Step 1 — Configure Job:**
   - Pick a **Source** provider (one you've already connected).
   - Pick the **Source entity** (e.g., Invoices).
   - Pick a **Destination** provider.
   - Give the job a **Name**.
   - Set **Frequency**: every 15 min, hourly, daily, or a custom cron expression.
   - Click **Continue**.
3. **Step 2 — Field Mapping:**
   - The system auto-maps source columns to destination columns.
   - Review and adjust any mismatches.
   - *(Optional)* Toggle **Advanced DQ** if you want to define quality rules.
   - Click **Continue**.
4. **Step 3 — DQ Configuration** *(only if Advanced DQ is on):*
   - Pick a preset or define rules.
   - Set error policies (skip / quarantine / fail).
5. Click **Create Job**. You're redirected back to `/jobs` with a success toast.

### 15.3 Pausing, Editing & Deleting

From the three-dot menu on any job row:

- **Pause** — stops further runs but keeps the schedule. Click **Resume** to restart.
- **Edit** — opens the same stepper, pre-filled with current values.
- **Delete** — removes the job and its schedule. Past run records are kept.

### 15.4 Reviewing Failed Runs

If a job is in **Failed** status, click **View Runs** to see the per-run log. Each failed run shows the error message and (where available) the input file ID so you can open it in the File Manager and re-process manually.

---

## 16. Status Reference & Glossary

### 16.1 File Statuses

| Status | Meaning | What to do |
|---|---|---|
| `UPLOADING` | Upload in progress | Wait |
| `UPLOADED` | Upload complete, not yet processed | Click ▶ Play to process |
| `VALIDATED` | File structure validated | Wait |
| `QUEUED` | In processing queue | Wait |
| `DQ_DISPATCHED` | Sent to DQ engine | Wait |
| `DQ_RUNNING` | Processing in progress | Wait |
| `NORMALIZING` | Standardizing formats | Wait |
| `DQ_FIXED` | Done — issues fixed | Download cleaned data |
| `COMPLETED` | Fully complete | Download cleaned data |
| `FAILED` / `DQ_FAILED` | Processing failed | Click ▶ Play to retry |
| `UPLOAD_FAILED` | Upload didn't finish | Re-upload |
| `REJECTED` | File rejected (e.g., > 200 GB) | Check size / requirements |

### 16.2 Member Roles

| Role | Summary |
|---|---|
| **Super Admin** | Full access including billing. |
| **Admin** | All access except billing & subscription. |
| **Data Steward** | Can edit files and resolve quarantined rows. |

### 16.3 Glossary

| Term | Meaning |
|---|---|
| **DQ** | Data Quality |
| **DQ Score** | A 0–100% rating of how clean your file is. |
| **Clean / Fixed / Quarantined** | The three outcomes for each row after processing. |
| **Preset** | A saved set of DQ rules you can reuse across files. |
| **Connector** | A configured link to an external system (QB, Zoho, Snowflake, Drive). |
| **Job** | A scheduled, recurring run of the full pipeline. |
| **Augmentation** | AI-driven enrichment of your data after DQ processing. |
| **Quarantine Editor** | UI for manually fixing rows that were quarantined. |

---

## 17. Troubleshooting & FAQ

**Q: My file is stuck at UPLOADED status — why?**
AI Processing was probably turned **Off** at upload time. Click the ▶ Play icon to start processing manually.

**Q: I get "Invalid email or password" but my password is right.**
Make sure you've verified your email (check the inbox for the 6-digit code). If still failing, use **Forgot password**.

**Q: My QuickBooks connection popup closed but it says "Not Connected".**
Check that your browser allows third-party cookies and popups for `rightrev.vercel.app`. Try the connect flow again — most one-off failures resolve on retry.

**Q: How big a file can I upload?**
The hard ceiling is **200 GB**. Files larger than that are rejected.

**Q: How do I share results with someone who doesn't have an account?**
Download the file as CSV / Excel / JSON and email it. Or invite them as a **Data Steward**.

**Q: How do I retry a failed scheduled job?**
Go to `/jobs`, click **View Runs** on the failed job, find the failed run, then open the source file from the File Manager and run it manually. To prevent the failure recurring, edit the job's mapping or DQ config.

**Q: Can I delete an account?**
Yes — open a support request and we'll initiate a DSAR (data subject access request) cascade delete, which removes your files and account data.

**Q: How do I export a list of all my files and their scores?**
Go to the Dashboard → click **Export** in the header. You get `overall-dq-report.json` with everything.

**Q: What about audit logs?**
Admins can view audit logs from **Admin → Audit Logs**. All edits to cells, role changes, and connector changes are recorded.

---

## Need Help?

- **In-app:** Click **Help & Support** in the sidebar.
- **Email:** Contact your project sponsor at the CleanFlowAI team.

---

*Document version 1.1 — covers the platform as deployed at https://rightrev.vercel.app/.*
