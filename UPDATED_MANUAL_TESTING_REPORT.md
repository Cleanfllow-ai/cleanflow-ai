# RightRev — Manual Testing Report (Re-Test)
**Original Test Date:** 18 May 2026
**Re-Test Date:** 19 May 2026
**Tester:** Kishore Murthi
**Environment:** https://rightrev.vercel.app
**Browser:** Chrome (latest)
**Platform:** Windows 11

---

## Executive Summary

| Metric | Original (18 May) | Re-Test (19 May) |
|---|---|---|
| Total Bugs Reported | 22 | — |
| ✅ Fixed | — | 16 |
| ⚠️ Partial | — | 2 |
| ❌ Still Broken | — | 4 |
| ➡️ Skipped (blocked) | — | 5 |
| 🆕 New Bugs Found | — | 3 |
| **Demo Ready?** | ❌ NO | ❌ NO — blockers remain |

---

## Bug Status After Re-Test

| # | Sev | Section | Description | Re-Test Result |
|---|---|---|---|---|
| 1 | 🔴 | §11 | All file downloads fail | ✅ FIXED |
| 2 | 🔴 | §4 | DQ Report shows no issue names | ✅ FIXED |
| 3 | 🔴 | §1 | Invited user cannot set password | ❌ STILL BROKEN |
| 4 | 🔴 | §8 | Salesforce import fails | ✅ FIXED |
| 5 | 🟠 | §4 | Download Report is raw JSON | ⚠️ PARTIAL |
| 6 | 🟠 | §4 | 100% quarantine when multiple rules fire | ✅ FIXED |
| 7 | 🟠 | §4 | Quality Score shows N/A | ✅ FIXED |
| 8 | 🟡 | §10 | Raw rule codes in Dashboard Top DQ Issues | ✅ FIXED |
| 9 | 🟡 | §5 | Built-in rules show raw codes in Rules step | ✅ FIXED |
| 10 | 🟡 | §3 | Empty CSV silently validates | ✅ FIXED |
| 11 | 🟡 | §5 | Unsafe prompt not refused | ✅ FIXED |
| 12 (A01) | 🟡 | §6 | Augmentation fails — fiscal_year (ONE_TO_ONE) | ❌ STILL BROKEN |
| 12 (A09) | 🟡 | §6 | Augmentation fails — group-by sum (MANY_TO_ONE) | ⚠️ PARTIAL |
| 12 (A13) | 🟡 | §6 | Augmentation fails — pivot (MANY_TO_MANY) | ❌ STILL BROKEN |
| 13 | 🟡 | §4 | UI DQ score inconsistent with downloaded JSON | ✅ FIXED |
| 15 | 🟢 | §13 | Forward navigation doesn't reopen file details | ✅ FIXED |
| 16 | 🔴 | §8 | Connector OAuth callbacks crash on reconnect | ✅ FIXED |
| 17 | 🔴 | §9 | QuickBooks Online import fails | ✅ FIXED |
| 18 | 🔴 | §9 | Zoho Books import fails | ✅ FIXED |
| 19 | 🔴 | §9 | Snowflake import fails despite data visible | ✅ FIXED |
| 20 | 🟠 | §9 | Job run history infinite loading | ✅ FIXED |
| 21 | 🟡 | §7 | Bulk Fix not implemented | ✅ FIXED |
| 22 | 🟢 | §1 | No password visibility toggle on invite screen | ❌ STILL BROKEN |

---

## New Bugs Found During Re-Test

| # | Severity | Section | Description |
|---|---|---|---|
| N1 | 🔴 | §6 | **Augmentation silently corrupts source column** — impossible prompt ("sqrt of customer_name") did not fail; instead it overwrote the `customer_name` column with numeric values derived from character count. Original data permanently lost. No warning shown. |
| N2 | 🟠 | §6 | **Internal metadata columns included in augmentation output downloads** — `source_row_hash`, `augmented_at_utc`, `prompt_template_version`, `expression_hash`, `cost_usd_micro`, and all `*_status` columns appear in downloaded CSV. These are system-internal fields and must be stripped before delivery to users. |
| N3 | 🟡 | §6 | **Augmentation error banner has extremely low contrast** — the error banner on A01.csv FAILED state uses faded light-pink text on a light-pink background. Text is barely readable. Accessibility issue. |

---

## Remaining Blockers (Still Broken)

### Bug #3 — Invited user account stays Pending ❌
- **Was:** "Failed to set new password" error, user could not activate account.
- **Re-test:** Password appears to be accepted (user can log in using invite link directly), but admin panel still shows account status as **Pending**. User session does not activate properly. Backend not transitioning account from Pending → Active.
- **Impact:** Blocks Tests 1.4, 7.3, 7.6, 12.3, 12.4 (all multi-user scenarios).

### Bug #22 — No password visibility toggle on invite set-password screen ❌
- **Was:** No eye icon in password field on invite activation page.
- **Re-test:** Still no eye icon. User cannot verify what they are typing.

### Bug #12 (A01) — ONE_TO_ONE augmentation fails ❌
- **Re-test:** Status FAILED. Error message: *"Augmentation failed — FAILED: AugmentationStateMachine failed"* — still a raw internal technical error, not user-friendly.
- **Also:** Error banner has extremely low contrast (see Bug N3).

### Bug #12 (A13) — MANY_TO_MANY pivot augmentation broken ❌
- **Re-test:** File processes and completes, but all pivot values are **0.0**. Month columns (January–December) are created but no values populated. Pivot logic does not work.

---

## Partial Fixes

### Bug #5 — Download Report (DQ Summary CSV) ⚠️
- **Fixed:** No longer downloads raw JSON metadata. Now a proper CSV format with rule breakdown (Rule ID, Issue, Description, Hits populated correctly).
- **Still broken:** `Total Rows`, `Clean Rows`, `Quarantined Rows` fields are **blank** in both the report CSV and DQ Matrix JSON. Row count fields not being written by backend.

### Bug #12 (A09) — MANY_TO_ONE group-by sum ⚠️
- **Fixed:** Augmentation runs successfully. `total_arr` column created with correct summed values per `contract_id`. Row count correctly reduced (100 → 20).
- **Still broken:** Output CSV contains internal metadata columns that should be stripped (see Bug N2).

---

## Section-by-Section Re-Test Results

### Section 1 — Organization & User Setup

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 1.1 Sign up new org | ✅ PASS | ✅ PASS | — |
| 1.2 Invite second user | ⚠️ PARTIAL | ❌ FAIL | Account stays Pending after activation. False "Failed to set new password" error shown but password technically set. Account never goes Active. |
| 1.3 Role badge display | ✅ PASS | ✅ PASS | — |
| 1.4 Member access guard | ➡️ SKIP | ➡️ SKIP | Blocked by Bug #3 |

### Section 2 — Authentication & Session

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 2.1 Log out / log in | ✅ PASS | ✅ PASS | — |
| 2.2 Invalid login | ✅ PASS | ✅ PASS | — |
| 2.3 Session persistence | ✅ PASS | ✅ PASS | — |

### Section 3 — File Upload & Validation

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 3.1 Upload Import dialog | ✅ PASS | ✅ PASS | — |
| 3.2 Large file | ✅ PASS | ✅ PASS | — |
| 3.3 Malformed CSV | ⚠️ PARTIAL | ⚠️ PARTIAL | Error message still too technical ("Unsupported content type: text/plain") — dropped from bug list per tester |
| 3.4 Empty CSV | ❌ FAIL | ✅ PASS | Now shows "Invalid file" with clear message |
| 3.5 Files list search & sort | ✅ PASS | ✅ PASS | — |

### Section 4 — DQ Engine

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 4.1 Built-in preset (L01.csv) | ⚠️ PARTIAL | ✅ PASS | 12/100 quarantined (correct). Quality Score 88.0%. |
| 4.2 Edit allowlist | ❌ FAIL | ✅ PASS | Preset customization now affects quarantine count correctly |
| 4.3 Cross-field rule (L13.csv) | ❌ FAIL | ✅ PASS | DQ Report shows human-readable violation names |
| 4.4 Date format (L07.csv) | ⚠️ PARTIAL | ✅ PASS | Issue names shown in DQ Report |
| 4.5 Tax jurisdiction (L14.csv) | ⚠️ PARTIAL | ⚠️ PARTIAL | Download Report CSV still missing Total/Clean/Quarantined row counts |

### Section 5 — Custom Rules

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 5.1 Email format | ⚠️ PARTIAL | ✅ PASS | Built-in rules now show descriptive names |
| 5.2 Renewal date | ⚠️ PARTIAL | ✅ PASS | — |
| 5.3 PII in notes | ⚠️ PARTIAL | ✅ PASS | — |
| 5.4 MRR positive | ⚠️ PARTIAL | ✅ PASS | — |
| 5.5 Phone E.164 | ⚠️ PARTIAL | ✅ PASS | — |
| 5.6 Unsafe prompt rejection | ⚠️ PARTIAL | ✅ PASS | Clear warning shown: "The user prompt contains intent to delete data, which is not a data quality validation rule." |

### Section 6 — Data Augmentation

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 6.1 fiscal_year (A01) | ❌ FAIL | ❌ FAIL | AugmentationStateMachine failed. Error banner low contrast. |
| 6.2 arr_calculated (A04) | ⚠️ PARTIAL | ✅ PASS | — |
| 6.3 Explode tags (A06) | ✅ PASS | ✅ PASS | — |
| 6.4 Group-by sum (A09) | ❌ FAIL | ⚠️ PARTIAL | Works but internal metadata columns in output |
| 6.5 Pivot (A13) | ❌ FAIL | ❌ FAIL | All pivot values 0.0 |
| 6.6 Aug failure handling | ⚠️ PARTIAL | ❌ FAIL | Impossible prompt silently corrupts data instead of failing safely |

### Section 7 — Quarantine Editor

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 7.1 Open editor | ✅ PASS | ✅ PASS | — |
| 7.2 Single cell edit | ✅ PASS | ✅ PASS | — |
| 7.3 Concurrent edits | ➡️ SKIP | ➡️ SKIP | Blocked by Bug #3 |
| 7.4 Find & Replace | ✅ PASS | ✅ PASS | — |
| 7.5 Bulk Fix | ❌ FAIL | ✅ PASS | Row checkboxes, bulk apply, and mark-as-fixed all working |
| 7.6 Network blip recovery | ➡️ SKIP | ➡️ SKIP | Blocked by Bug #3 |
| 7.7 Approve & reprocess | ✅ PASS | ✅ PASS | — |

### Section 8 — Connectors

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 8.1 Salesforce OAuth connect | ⚠️ PARTIAL | ✅ PASS | First connect + reconnect both work |
| 8.2 Salesforce import | ❌ FAIL | ✅ PASS | Import succeeds |
| 8.3 Salesforce export | ➡️ SKIP | ✅ PASS | Export round-trip works |
| 8.4 Google Drive OAuth | ⚠️ PARTIAL | ✅ PASS | First connect + reconnect both work |
| 8.5 QuickBooks connect | ✅ PASS | ✅ PASS | — |
| 8.6 Disconnect connector | ✅ PASS | ✅ PASS | — |

### Section 9 — DQ Jobs

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 9.1 Create job | ✅ PASS | ✅ PASS | — |
| 9.2 Run job | ⚠️ PARTIAL | ✅ PASS | Job runs end-to-end successfully |
| 9.3 Edit schedule | ✅ PASS | ✅ PASS | — |
| 9.4 Delete job | ✅ PASS | ✅ PASS | — |
| Run History | ❌ FAIL | ✅ PASS | Run history loads with timestamps, status, duration |

### Section 10 — Dashboard

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 10.1 Dashboard loads | ✅ PASS | ✅ PASS | — |
| 10.2 🚨 Top DQ Issues — short names | ⚠️ PARTIAL | ✅ PASS | Human-readable names only, no raw codes visible |
| 10.3 Trends chart | ✅ PASS | ✅ PASS | — |
| 10.4 Processing Summary tile | ✅ PASS | ✅ PASS | — |

### Section 11 — Downloads

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 11.1 Clean CSV | ❌ FAIL | ✅ PASS | Downloads correctly |
| 11.2 Quarantine report | ❌ FAIL | ✅ PASS | Downloads correctly |
| 11.3 DQ Summary | ❌ FAIL | ⚠️ PARTIAL | CSV format correct, rule breakdown populated, but row count fields blank |

### Section 12 — Delete

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 12.1 Mid-upload delete | ✅ PASS | ✅ PASS | — |
| 12.2 Post-DQ delete | ✅ PASS | ✅ PASS | — |
| 12.3 Delete during quarantine | ➡️ SKIP | ➡️ SKIP | Blocked by Bug #3 |
| 12.4 Member cannot delete | ➡️ SKIP | ➡️ SKIP | Blocked by Bug #3 |

### Section 13 — Edge Cases

| Test | Original | Re-Test | Notes |
|---|---|---|---|
| 13.1 Friendly errors on 500s | ✅ PASS | ✅ PASS | — |
| 13.2 Browser back/forward | ⚠️ PARTIAL | ✅ PASS | Forward navigation now reopens file detail |
| 13.3 Dark mode | ✅ PASS | ✅ PASS | — |
| 13.4 Mobile responsive | ✅ PASS | ✅ PASS | — |

---

## What's Working Well (Post Re-Test)

- All connector OAuth flows (first connect + reconnect) — Salesforce, Google Drive, QuickBooks
- All connector imports — Salesforce, QuickBooks, Zoho Books, Snowflake
- Full job pipeline — create, run, edit schedule, delete, run history
- All file downloads — Clean CSV, Quarantine Report, DQ Summary (partial)
- DQ engine — correct quarantine counts, human-readable issue names, accurate quality scores
- Custom rule LLM — descriptive labels, unsafe prompt refusal working
- Bulk Fix in Quarantine Editor — fully implemented
- Dashboard — no raw codes, all tiles accurate
- Empty CSV detection — "Invalid file" with clear message
- Browser navigation — back/forward both work

## What Still Needs Fixing Before Demo

1. **Bug #3** — Invite flow broken: account stays Pending, second user cannot fully activate. Blocks 5 multi-user test scenarios.
2. **Bug N1** — Augmentation silently corrupts source column data (critical data integrity issue).
3. **Bug #12 (A01)** — ONE_TO_ONE augmentation (fiscal_year) fails with internal error.
4. **Bug #12 (A13)** — MANY_TO_MANY pivot augmentation produces all 0.0 values.
5. **Bug N2** — Internal metadata columns in augmentation output downloads.
6. **Bug #5** — DQ Summary CSV missing row count fields (Total/Clean/Quarantined blank).
7. **Bug #22** — No password eye icon on invite activation screen.
8. **Bug N3** — Augmentation error banner has extremely low contrast/unreadable.

## Sections Requiring Re-Test After Fixes

| Section | Blocker | What's Needed |
|---|---|---|
| §1 (1.4) | Bug #3 invite flow | Fix account activation → Active status |
| §7 (7.3, 7.6) | Bug #3 invite flow | Fix account activation → retest concurrent edits + network blip |
| §12 (12.3, 12.4) | Bug #3 invite flow | Fix account activation → retest delete permissions |
| §6 (6.1, 6.5, 6.6) | Bugs #12 + N1 | Fix augmentation engine → retest A01, A13, impossible prompt |

---

*Original report: 18 May 2026 | Re-test: 19 May 2026 | Tester: Kishore Murthi | Environment: rightrev.vercel.app*
