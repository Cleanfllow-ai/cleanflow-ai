# RightRev — Re-Test Guide (Post-Fix)
**Based on:** UPDATED_MANUAL_TESTING_REPORT.md (18 May 2026)
**Purpose:** Verify all 22 reported bugs are fixed + re-run 6 previously SKIPped tests.
**Tester:** ___________  **Date:** ___________  **Environment:** https://rightrev.vercel.app

> **How to fill in results:** Use ✅ FIXED · ❌ STILL BROKEN · ⚠️ PARTIAL · ➡️ SKIP (explain why)

---

## Quick-reference: All bugs

| # | Sev | Section | Short description |
|---|---|---|---|
| 1 | 🔴 | §11 | All downloads fail |
| 2 | 🔴 | §4 | DQ Report shows no issue names |
| 3 | 🔴 | §1 | Invited user cannot set password |
| 4 | 🔴 | §8 | Salesforce import fails |
| 5 | 🟠 | §4 | Download Report is raw JSON |
| 6 | 🟠 | §4 | 100% quarantine when multiple column rules fire |
| 7 | 🟠 | §4 | Quality Score shows N/A |
| 8 | 🟡 | §10 | Raw rule codes (R19, CUST_xxx) visible in Dashboard |
| 9 | 🟡 | §5 | Built-in rules show "Rule R67" codes in Rules step |
| 10 | 🟡 | §3 | Empty CSV silently validates, no warning |
| 11 | 🟡 | §5 | Unsafe prompt silently reinterpreted, no refusal shown |
| 12 | 🟡 | §6 | Augmentation processing fails with generic error |
| 13 | 🟡 | §4 | UI DQ score inconsistent with downloaded JSON |
| 14 | 🟢 | §3 | Malformed file error too technical |
| 15 | 🟢 | §13 | Forward navigation doesn't reopen file details dialog |
| 16 | 🔴 | §8 | All connector OAuth callbacks crash on reconnect |
| 17 | 🔴 | §9 | QuickBooks Online import fails |
| 18 | 🔴 | §9 | Zoho Books import fails |
| 19 | 🔴 | §9 | Snowflake import fails despite data visible |
| 20 | 🟠 | §9 | Job run history infinite loading |
| 21 | 🟡 | §7 | Bulk Fix not implemented |
| 22 | 🟢 | §1 | No password visibility toggle on invite set-password screen |

---

## Section 1 — Org & User Setup

### BUG #3 — Invited user cannot set password
**Was:** "Failed to set new password" error, account stuck in Pending.

**Re-test steps:**
1. Log in as Super Admin → Admin / Settings → Members.
2. Click **Invite User** → email `qa-retest-01+<yourname>@example.com` → role **Data Steward** → Send.
3. Open the invite email in incognito → click the invite link.
4. Set password `TempPass456!` → submit.
5. Complete TOTP setup → log in.

**Expected (fixed):** Password accepted, TOTP setup completes, user lands on Dashboard inside the same org.

**Result:** ___ Notes: ___

---

### BUG #22 — No password visibility toggle on invite set-password screen
**Was:** No eye icon in password field on invite activation page.

**Re-test steps (combine with Bug #3 above):**
1. On the invite set-password screen, look at the password field.
2. Check for a show/hide eye icon.

**Expected (fixed):** Eye icon present; clicking it toggles between hidden/visible password text.

**Result:** ___ Notes: ___

---

### PREVIOUSLY SKIPPED — TEST 1.4: Member cannot access admin
**Blocked by:** Bug #3 (invite flow). Now unblocked.

**Re-test steps:**
1. Invite a third user as **Member** role (use `qa-retest-02+<yourname>@example.com`).
2. Activate that account (verifying Bug #3 is fixed).
3. Log in as that Member user.
4. Try to access the Admin / Members page via sidebar or direct URL.

**Expected:** Admin section is either hidden entirely OR visible but disabled with tooltip "You do not have permission". No raw 403 page.

**Result:** ___ Notes: ___

---

## Section 3 — File Upload

### BUG #10 — Empty CSV silently validates
**Was:** Headers-only CSV got VALIDATED status, ROWS column showed `--` instead of `0`, no warning.

**Re-test steps:**
1. Create a CSV with only a header row, no data (e.g. `name,email,phone` and nothing else).
2. Upload it via the Import dialog.
3. Wait for status.

**Expected (fixed):** Status shows `EMPTY_FILE` (or equivalent), or a clear warning banner — NOT silently `VALIDATED`. ROWS column shows `0`.

**Result:** ___ Notes: ___

---

### BUG #14 — Malformed file error too technical
**Was:** Error read "Unsupported content type: text/plain" — too technical for end users.

**Re-test steps:**
1. Rename any `.png` or `.jpg` to `.csv`.
2. Upload it.
3. Read the error message shown.

**Expected (fixed):** Plain-language message like "This file doesn't look like a valid CSV. Please check the file and try again." No raw MIME type strings.

**Result:** ___ Notes: ___

---

## Section 4 — DQ Engine

> **For all §4 tests:** Upload `L01.csv` (currency + region rules) and apply the Standard preset unless noted.

### BUG #6 — 100% quarantine when multiple column rules fire
**Was:** All 100/100 rows quarantined; expected ~20 (only the actually-bad rows).

**Re-test steps:**
1. Upload a fresh `L01.csv`.
2. Apply Standard preset → process.
3. Check the quarantined row count when DQ_FIXED.

**Expected (fixed):** Only the rows that genuinely violate rules are quarantined (~20, not 100%).

**Result:** ___ Notes: ___

---

### BUG #7 — Quality Score shows N/A
**Was:** When all rows quarantined, score showed N/A instead of a numeric value.

**Re-test steps (observe after Bug #6 re-test above):**
1. After processing, look at the Quality Score on the file detail page.

**Expected (fixed):** Numeric score (e.g. `80%`) always displayed, even when quarantine count is high. N/A never shown.

**Result:** ___ Notes: ___

---

### BUG #2 — DQ Report shows no issue names (only donut chart)
**Was:** DQ Report panel showed only a row-distribution donut chart; no per-rule violation breakdown.

**Re-test steps:**
1. Open any DQ_FIXED file → go to the DQ Report tab (or panel).
2. Look for a list/table of issues that were found.

**Expected (fixed):** A visible list of violations with human-readable names (e.g. "Currency Code Allowlist", "Region Currency Mismatch") and row counts. Not just a donut.

**Result:** ___ Notes: ___

---

### BUG #5 — "Download Report" exports raw JSON metadata
**Was:** Clicking Download Report downloaded `{org_id, s3_key, ...}` JSON instead of a human-readable report.

**Re-test steps:**
1. From a DQ_FIXED file, click **Download Report** (from the DQ Report tab or Downloads menu).
2. Open the downloaded file.

**Expected (fixed):** File is a readable CSV or PDF summary — rule names, counts, sample bad values. Not a raw JSON metadata object.

**Result:** ___ Notes: ___

---

### BUG #13 — UI DQ score inconsistent with downloaded JSON
**Was:** UI showed 93%, downloaded JSON showed `dq_score: 98`.

**Re-test steps (combine with Bug #5 above):**
1. Note the DQ score shown in the UI for a processed file.
2. Download the DQ report.
3. Find the score value in the downloaded file — compare to UI.

**Expected (fixed):** Both values match.

**Result:** ___ Notes: ___

---

## Section 5 — Custom Rules

### BUG #9 — Built-in rules show raw codes ("Rule R67", "Rule R60")
**Was:** In the Rules step of the processing wizard, built-in rules appeared as "Rule R67", "Rule R60" instead of descriptive names.

**Re-test steps:**
1. Upload any CSV → open the processing wizard → navigate to the **Rules** step.
2. Look at the list of built-in rules.

**Expected (fixed):** All built-in rules show descriptive names (e.g. "Currency Code Allowlist", "Date Format Strict ISO8601") — no raw codes like `R67`.

**Result:** ___ Notes: ___

---

### BUG #11 — Unsafe prompt silently reinterpreted, no refusal shown
**Was:** Typing "delete all customer records" in the custom rule generator silently produced a harmless rule ("Non Empty First Name Check") with no message to the user that the prompt was refused/reinterpreted.

**Re-test steps:**
1. Upload any CSV → open the processing wizard → Rules step → **+ Add Custom Rule**.
2. Type: `delete all customer records` → click **Generate Rule**.
3. Observe the response.

**Expected (fixed):** A clear refusal or warning message is shown — e.g. "This prompt describes a destructive action and cannot be used to generate a data quality rule. Please describe a validation check instead." The system should NOT silently generate an unrelated rule.

**Result:** ___ Notes: ___

---

## Section 6 — Augmentation

### BUG #12 — Augmentation processing fails (A01, A09, A13)
**Was:** `A01.csv` (fiscal_year), `A09.csv` (group-by sum), and `A13.csv` (pivot) all failed with generic "Processing failed or timed out."

**Re-test steps — A01 (ONE_TO_ONE):**
1. Upload `A01.csv` → add augmentation: column `fiscal_year`, prompt `"Extract fiscal year (April–March) from order_date. Example: 2024-06-15 → FY2025"`.
2. Process → download output CSV.
3. Verify row count matches input and `fiscal_year` column is populated.

**Result:** ___ Notes: ___

**Re-test steps — A09 (MANY_TO_ONE, group-by sum):**
1. Upload `A09.csv` → add augmentation: prompt `"For each contract_id, sum the invoice_amount and call it total_arr"`.
2. Process → download.
3. Verify fewer rows than input (one per contract), `total_arr` column present.

**Result:** ___ Notes: ___

**Re-test steps — A13 (MANY_TO_MANY, pivot):**
1. Upload `A13.csv` → add augmentation: prompt `"Pivot so each customer is one row with one column per month"`.
2. Process → download.
3. Verify one row per customer, month columns present.

**Result:** ___ Notes: ___

---

### BUG #12 (partial) — Augmentation failure shows generic error
**Was:** When augmentation fails, "Processing failed or timed out" with no specific reason.

**Re-test steps:**
1. Add an aug with an impossible prompt: `"Compute the square root of customer_name"` → process.
2. When it fails, read the error message.

**Expected (fixed):** Error message includes a specific reason why the augmentation failed (e.g. "Could not apply transformation: non-numeric column"). "Processing failed or timed out" alone is not acceptable.

**Result:** ___ Notes: ___

---

## Section 7 — Quarantine Editor

### BUG #21 — Bulk Fix not implemented
**Was:** No row checkboxes or bulk selection UI in the Quarantine Editor. Hovering row numbers did nothing.

**Re-test steps:**
1. Open any DQ_FIXED file with quarantined rows → go to Quarantine Editor.
2. Hover over row numbers on the left.
3. Look for checkboxes or a "select all" header checkbox.
4. If checkboxes appear, select multiple rows and look for a bulk action button.

**Expected (fixed):** Row checkboxes present; selecting multiple rows reveals a bulk action toolbar (e.g. "Apply fix to all selected", "Mark as reviewed").

**Result:** ___ Notes: ___

---

### PREVIOUSLY SKIPPED — TEST 7.3: Concurrent edits
**Blocked by:** Bug #3 (invite flow). Now unblocked — needs 2 browser profiles.

**Re-test steps:**
1. Open the same DQ_FIXED file's Quarantine Editor in **two** browser profiles simultaneously (primary + incognito logged in as the invited Data Steward from Bug #3 retest).
2. In browser A: click cell row 5, email column — start editing (do NOT press Enter yet).
3. In browser B: try to click the same cell (row 5, email column).

**Expected:** Browser B sees the cell as locked — different border, or tooltip "User1 is editing". Cannot edit until A saves or cancels.

**Result:** ___ Notes: ___

---

### PREVIOUSLY SKIPPED — TEST 7.6: Network blip recovery
**Blocked by:** Bug #3. Now unblocked.

**Re-test steps:**
1. Open Quarantine Editor.
2. Disable WiFi for ~5 seconds, then re-enable.
3. After reconnect, try editing a cell.

**Expected:** Editor reconnects automatically (brief "Reconnecting…" indicator OK). Post-reconnect edits save successfully.

**Result:** ___ Notes: ___

---

## Section 8 — Connectors

### BUG #16 — All connector OAuth callbacks crash on reconnect
**Was:** After disconnect + reconnect, browser lands on raw AWS API Gateway URL (`/prod/connectors/callback/<provider>`) showing `{"error": "Internal server error", "code": "InternalError", "provider": null}`. First-time connect worked; any reconnect was permanently broken.

**Re-test steps (Salesforce):**
1. Connect Salesforce (if already connected, disconnect first → reconnect).
2. Once connected, click **Disconnect** → confirm.
3. Immediately click **Connect** again → complete OAuth flow.
4. Observe where the browser lands after Salesforce redirects back.

**Expected (fixed):** Browser lands back inside the RightRev app (not an AWS URL). Salesforce shows as **Connected** with a green check.

**Result:** ___ Notes: ___

**Re-test steps (Google Drive):**
1. Repeat the same connect → disconnect → reconnect cycle for Google Drive.

**Expected (fixed):** Same — lands inside the app, Connected status shown.

**Result:** ___ Notes: ___

---

### BUG #4 — Salesforce import fails
**Was:** "Could not import from Salesforce. Please try again." with no specific reason.

**Re-test steps:**
1. Connect Salesforce (confirming Bug #16 is fixed first).
2. Click **Import** on the Accounts entity.
3. Wait for the import job to complete.

**Expected (fixed):** Import succeeds. A new file appears in the Files list named something like `salesforce_accounts_<timestamp>.csv` with Id, Name, and other expected columns.

**Result:** ___ Notes: ___

---

### PREVIOUSLY SKIPPED — TEST 8.3: Salesforce export round-trip
**Blocked by:** Bug #4 (import failed, nothing to export). Now unblocked if Bug #4 is fixed.

**Re-test steps:**
1. Take a DQ_FIXED file that originated from Salesforce.
2. In file detail, click **Export to Salesforce** → select Accounts entity → confirm.
3. Wait for export job.

**Expected:** Export completes with a summary (created/updated/error counts). Verify records updated in Salesforce UI.

**Result:** ___ Notes: ___

---

## Section 9 — DQ Jobs

### BUG #17 — QuickBooks Online import fails
**Was:** "Could not import from Quick Books. Please try again." — no specific reason.

**Re-test steps:**
1. Connectors → QuickBooks → **Import** on any entity (Bills, Invoices, etc.).
2. Wait for import to complete.

**Expected (fixed):** Import succeeds. File appears in Files list.

**Result:** ___ Notes: ___

---

### BUG #18 — Zoho Books import fails
**Was:** "Could not import from Zoho Books. Please try again." — no specific reason.

**Re-test steps:**
1. Connectors → Zoho Books → **Import** on any entity.
2. Wait for result.

**Expected (fixed):** Import succeeds.

**Result:** ___ Notes: ___

---

### BUG #19 — Snowflake import fails despite table data visible
**Was:** Table `CUSTOMER_ZOHO_DATA` showed 621 records in the UI, but import returned "Could not import from Snowflake. Please try again."

**Re-test steps:**
1. Connectors → Snowflake → navigate to `CUSTOMER_ZOHO_DATA` table (or equivalent).
2. Confirm row count is still visible.
3. Click **Import**.

**Expected (fixed):** Import succeeds. File appears in Files list with ~621 rows.

**Result:** ___ Notes: ___

---

### BUG #20 — Job run history infinite loading
**Was:** Run History panel showed "5 runs" count but spinner never resolved.

**Re-test steps:**
1. Jobs list → click any job that has run at least once → open the **Run History** panel/tab.
2. Wait up to 15 seconds.

**Expected (fixed):** Run history list loads and shows individual run entries (timestamp, status, duration).

**Result:** ___ Notes: ___

---

### Jobs end-to-end (re-test after Bugs #17–19 fixed)
**Verify the full job pipeline now works.**

**Re-test steps:**
1. Create a job with a QuickBooks or Zoho Books source.
2. Click **Run Now**.
3. Wait for completion.
4. Verify: status goes RUNNING → SUCCESS, new file appears in Files list, Run History shows the run with details.

**Result:** ___ Notes: ___

---

## Section 10 — Dashboard

### BUG #8 — Raw rule codes visible in Dashboard Top DQ Issues
**Was:** Human-readable names shown correctly but raw codes (`R19`, `R15`, `R27`, `CUST_MPAXK1A2`) visible as sub-labels underneath.

**Re-test steps:**
1. Go to **Dashboard** → look at the **Top DQ Issues** panel.
2. For each issue row, check what appears below/next to the issue name.

**Expected (fixed):** Only human-readable names and counts visible. No raw codes (`R##`, `CUST_###`, `BCR-###`, `CROSS_###`) anywhere in the panel — not as labels, sub-labels, or tooltips.

**Result:** ___ Notes: ___

---

## Section 11 — Downloads

### BUG #1 — All downloads fail
**Was:** Every download attempt returned "Download failed" toast with no reason. Entire download feature broken.

**Re-test steps — Clean CSV:**
1. Open any DQ_FIXED file → click **Download** → **Fixed Data** (or Clean CSV).
2. Wait for download to start.
3. Open the downloaded file — verify it has data rows and all expected columns.

**Result:** ___ Notes: ___

**Re-test steps — Quarantine Report:**
1. Same file → **Download** → **Quarantine Report**.
2. Verify the file contains only the quarantined rows with error reason columns.

**Result:** ___ Notes: ___

**Re-test steps — DQ Summary:**
1. Same file → **Download** → **DQ Summary** (or Report PDF).
2. Verify the file is a human-readable summary (not raw JSON — see also Bug #5).

**Result:** ___ Notes: ___

---

## Section 12 — Delete (previously skipped tests)

### PREVIOUSLY SKIPPED — TEST 12.3: Delete during quarantine editor
**Blocked by:** Bug #3. Now unblocked — needs 2 active users.

**Re-test steps:**
1. Open a DQ_FIXED file's Quarantine Editor as the invited Data Steward (second user).
2. Simultaneously, as Super Admin in another tab, delete that same file.
3. Switch back to the Data Steward's Quarantine Editor — observe.

**Expected:** Editor shows a clear message like "This file has been deleted." No crash, no blank screen, no frozen spinner.

**Result:** ___ Notes: ___

---

### PREVIOUSLY SKIPPED — TEST 12.4: Member role cannot delete
**Blocked by:** Bug #3. Now unblocked.

**Re-test steps:**
1. Log in as the Member-role user.
2. Go to Files list — look at the delete button/icon for any file.

**Expected:** Delete button is hidden OR disabled with a permission tooltip. Clicking (if visible) does nothing or shows "You do not have permission."

**Result:** ___ Notes: ___

---

## Section 13 — Edge Cases

### BUG #15 — Forward navigation doesn't reopen file details dialog
**Was:** Browser Back worked but Forward did not reopen the file details dialog — dialog state not in browser history.

**Re-test steps:**
1. From Files list, click on a file to open its detail view.
2. Press browser **Back** → lands on Files list. ✓
3. Press browser **Forward**.

**Expected (fixed):** File details reopen (either as a page or dialog, whichever the current implementation uses). Forward navigation is not a dead-end.

**Result:** ___ Notes: ___

---

## Re-Test Summary Table

Fill this in after completing all re-tests.

**Tester:** ___________  **Date:** ___________  **Browser:** ___________

| Bug # | Severity | Short description | Result | Notes |
|---|---|---|---|---|
| 3 | 🔴 | Invited user cannot set password | | |
| 22 | 🟢 | No password toggle on invite screen | | |
| 1.4 (skip→retest) | — | Member cannot access admin | | |
| 10 | 🟡 | Empty CSV silently validates | | |
| 14 | 🟢 | Malformed file error too technical | | |
| 6 | 🟠 | 100% quarantine bug | | |
| 7 | 🟠 | Quality Score shows N/A | | |
| 2 | 🔴 | DQ Report shows no issue names | | |
| 5 | 🟠 | Download Report is raw JSON | | |
| 13 | 🟡 | UI score inconsistent with download | | |
| 9 | 🟡 | Built-in rules show raw codes in Rules step | | |
| 11 | 🟡 | Unsafe prompt not refused | | |
| 12 | 🟡 | Augmentation fails (A01, A09, A13) | | |
| 12b | 🟡 | Augmentation failure generic error | | |
| 21 | 🟡 | Bulk Fix not implemented | | |
| 7.3 (skip→retest) | — | Concurrent edits lock | | |
| 7.6 (skip→retest) | — | Network blip recovery | | |
| 16 | 🔴 | Connector OAuth reconnect crash | | |
| 4 | 🔴 | Salesforce import fails | | |
| 8.3 (skip→retest) | — | Salesforce export round-trip | | |
| 17 | 🔴 | QuickBooks import fails | | |
| 18 | 🔴 | Zoho Books import fails | | |
| 19 | 🔴 | Snowflake import fails | | |
| 20 | 🟠 | Job run history infinite loading | | |
| Jobs E2E | — | Full job pipeline end-to-end | | |
| 8 | 🟡 | Raw codes in Dashboard Top DQ Issues | | |
| 1 (Clean CSV) | 🔴 | Download Clean CSV fails | | |
| 1 (Quarantine) | 🔴 | Download Quarantine Report fails | | |
| 1 (DQ Summary) | 🔴 | Download DQ Summary fails | | |
| 12.3 (skip→retest) | — | Delete during quarantine editor | | |
| 12.4 (skip→retest) | — | Member cannot delete | | |
| 15 | 🟢 | Forward navigation broken | | |

---

## Re-Test Outcome

| | Count |
|---|---|
| ✅ FIXED | |
| ❌ STILL BROKEN | |
| ⚠️ PARTIAL | |
| ➡️ SKIP | |
| **Total** | **32** |

**New bugs found (not in original report):**

| # | Severity | Description | Screenshot? |
|---|---|---|---|
| | | | |

---

## Recommended test order

Run in this order so each unlock unblocks later tests:

1. **Bug #3** (invite flow) — unlocks 1.4, 7.3, 7.6, 12.3, 12.4
2. **Bug #16** (connector reconnect) — test both Salesforce + Google Drive reconnect
3. **Bug #4** (Salesforce import) — unlocks 8.3 export
4. **Bugs #17–19** (QB / Zoho / Snowflake imports) — then run Jobs E2E
5. **Bug #1** (downloads) — test all three download types
6. **Bug #6** (100% quarantine) — prerequisite for meaningful §4/§5/§10 checks
7. Remaining bugs in any order

---

*Re-test guide generated: 19 May 2026 | Environment: rightrev.vercel.app*
