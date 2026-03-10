# CleanFlowAI — UI/UX Redesign Specification

**Last updated:** 2026-03-10
**Branch:** `tweak/sakthi_catalogiteams`
**Author:** Design review session

---

## 1. Application Overview

**CleanFlowAI** is an enterprise data quality and transformation platform. Its core loop:

```
Import data → Profile & analyze → Apply DQ rules → Remediate issues → Export to ERP
```

Users are data engineers and operations teams who process CSV/Excel/ERP data daily. The primary job-to-be-done is: *"How clean is my data, and what do I do about the problems?"*

---

## 2. Design Philosophy

| Principle | Application |
|-----------|-------------|
| **Hierarchy first** | Every page must answer: "What is this page?" before asking "What do you want to do?" → pages need headers + KPIs before tables and forms |
| **Reduce before adding** | Remove redundant columns, duplicate displays, and verbose descriptions before adding new UI |
| **Size matches content** | Dialogs, panels, and modals should be sized to their content — oversized containers create hierarchy confusion |
| **Active state clarity** | Navigation active state should be immediately obvious — border + background + icon color, not just background alone |
| **Empty states are CTAs** | Every empty state should tell users what to do next, not just that nothing exists |

---

## 3. Global Elements

### 3.1 Sidebar Navigation

**Route:** All authenticated pages
**File:** `shared/layout/app-sidebar.tsx`

#### Before
```
╔══════════════════════════╗
║  CleanFlowAI             ║
╠══════════════════════════╣
║ ■ Dashboard              ║
║   Monitor performance,   ║  ← 2-line description adds clutter
║   analytics, activity    ║
║ ■ Catalog Items          ║  ← confusing name
║   Manage file uploads,   ║
║   workflows, exports     ║
╚══════════════════════════╝
```

#### After
```
╔══════════════════════════╗
║  CleanFlowAI             ║
╠══════════════════════════╣
║ ▎■ Dashboard             ║  ← left border active indicator
║                          ║  ← single line, no description
║   Data Catalog           ║  ← clearer name
║   Jobs                   ║  ← not "Create Jobs"
║   Admin                  ║
╠══════════════════════════╣
║ [A] Ada Lovelace         ║  ← initials avatar + name/email
║    ada@company.com       ║
║  ☀ Light Mode            ║
║  ? Help                  ║
║  ↩ Logout                ║
╚══════════════════════════╝
```

#### Changes Made
- [x] Renamed "Catalog Items" → "Data Catalog"
- [x] Renamed "Create Jobs" → "Jobs"
- [x] Shortened nav descriptions to single concise line
- [x] Added avatar initials circle to user section
- [x] Theme + logout visible in collapsed state
- [ ] **STRUCTURAL**: Remove description sub-text from nav items in expanded state — icon + name only

#### Justification
Nav descriptions only help users on their first visit. After that, they're visual noise that makes each nav item taller, reducing the scannable area. The icon and name are sufficient affordance. Tooltips serve the same purpose on hover if needed.

---

## 4. Dashboard Page

**Route:** `/dashboard`
**File:** `app/dashboard/page.tsx`

### 4.1 Page Header

**File:** `modules/dashboard/components/dashboard-header.tsx`

#### Changes Made
- [x] Personalized greeting: "Welcome back, [first name]"
- [x] Show current date as subtitle
- [x] Rename "Export" → "Export Report"

### 4.2 KPI Cards Row ← NEW STRUCTURAL ADDITION

**File:** `modules/dashboard/components/dashboard-kpi-cards.tsx` (new)

#### Before
Charts are the first element users see. No at-a-glance summary numbers.

#### After
```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Total Files│ │  Avg Score │ │ Processed  │ │ Quarantined│
│    24      │ │   91.4%    │ │    18      │ │    342 rows│
└────────────┘ └────────────┘ └────────────┘ └────────────┘
[Charts appear below]
```

#### Justification
KPI cards answer "how am I doing overall?" in one second. Charts answer "why" and "what trend" — they're secondary. Placing charts first forces users to parse visual data before they know the context. The 4 stats chosen map directly to the platform's core concerns: volume, quality, completion, and risk.

**Stats:**
- Total Files — scope indicator
- Avg DQ Score — primary quality metric
- Files Processed (DQ_FIXED) — completion rate
- Quarantined Rows — risk/attention metric

### 4.3 Chart Layout

**File:** `modules/dashboard/components/dq-charts.tsx`
No structural changes — charts remain in their 3-col + 1-col layout.

---

## 5. Data Catalog Page

**Route:** `/files`
**File:** `app/files/page.tsx`

### 5.1 Page Header ← NEW STRUCTURAL ADDITION

**File:** `modules/files/page/files-page-header.tsx` (new)

#### Before
Page starts directly with the search bar. No title, no context.

#### After
```
Data Catalog                         [Import]
24 files · 18 processed · 3 failed · 342 quarantined rows
─────────────────────────────────────────────────────────
[Search...] [Filter ▾] [×]     12 files  [Import] [↺] [⋮]
```

#### Justification
Every data-dense page needs an orienting H1. Without it, users opening multiple browser tabs can't identify the page at a glance. The inline stats strip (N files · N processed · N failed) gives a health summary without requiring table interaction. The "Import" CTA is surfaced at the header level since it's the primary entry action.

### 5.2 File Explorer Table

**File:** `modules/files/page/file-explorer-table.tsx`

#### 5.2.1 Score + Quality Column Merge ← STRUCTURAL

#### Before
| Score | Data Quality | ... |
|-------|-------------|-----|
| 94.2% | Excellent   | ... |
| 72.1% | Good        | ... |

Both columns display the same `dq_score` value in different formats. Redundant.

#### After
| Quality | ... |
|---------|-----|
| 94.2%   | ... |
| Excellent |   |

Single column: percentage badge + label text below.

**Impact:** Removes `"quality"` from default `visibleColumns`. The `"score"` column now renders both.

#### 5.2.2 Filter Reset Button
- [x] Changed from `Filter` icon → `X` icon

#### 5.2.3 File Count
- [x] Added "N files" / "N of M" count in toolbar

#### 5.2.4 Empty State
- [x] Added contextual message + Import CTA when no files

#### 5.2.5 Ingestion Type Column
- [x] Removed from default visible columns (data was randomly generated from `upload_id` hash, not real ingestion metadata)

### 5.3 Import File Dialog

**File:** `modules/processing/components/WizardDialog.tsx`

#### Before
`max-w-5xl h-[90vh]` — dialog occupies 90% viewport height for a single drag-drop upload form.

#### After
`mode="new"` uses `max-w-xl` with auto-height. The Processing Wizard (`mode="existing"`) retains the large format since it has 5 steps and needs vertical space.

#### Justification
UI affordance principle: container size signals complexity. A massive dialog for a simple drag-drop communicates that something complex is happening. A right-sized dialog feels fast and purposeful.

---

## 6. Jobs Page

**Route:** `/jobs`
**File:** `modules/jobs/components/jobs-list.tsx`

### 6.1 Page Header
- [x] Renamed "Create Jobs" → "Scheduled Jobs"
- [x] "Create Job" button renamed "New Job"

### 6.2 Summary Stats Strip ← STRUCTURAL
- [x] Added Total / Active / Paused / Failed count row below header
- Color-coded dot indicators per status

---

## 7. Admin Page

**Route:** `/admin`
**Status:** No structural changes in this sprint. Tabs-based layout is appropriate for settings.

---

## 8. Implementation Status

| Change | Type | Status | File(s) |
|--------|------|--------|---------|
| Rename nav: "Data Catalog" / "Jobs" | Cosmetic | ✅ Done | `app-sidebar.tsx` |
| Shorter nav descriptions | Cosmetic | ✅ Done | `app-sidebar.tsx` |
| Avatar initials in user section | Cosmetic | ✅ Done | `app-sidebar.tsx` |
| Theme/logout in collapsed sidebar | Cosmetic | ✅ Done | `app-sidebar.tsx` |
| **Remove nav description text** | **Structural** | ✅ Done | `app-sidebar.tsx` |
| Dashboard personalized greeting + date | Cosmetic | ✅ Done | `dashboard-header.tsx` |
| Export → Export Report | Cosmetic | ✅ Done | `dashboard-header.tsx` |
| **Dashboard KPI cards row** | **Structural** | ✅ Done | `dashboard-kpi-cards.tsx` (new) |
| **Data Catalog page header + stats** | **Structural** | ✅ Done | `files-page-header.tsx` (new) |
| Filter reset: Filter icon → X icon | Cosmetic | ✅ Done | `file-explorer-table.tsx` |
| File count in toolbar | Cosmetic | ✅ Done | `file-explorer-table.tsx` |
| Better empty state with CTA | Cosmetic | ✅ Done | `file-explorer-table.tsx` |
| Remove Ingestion Type from defaults | Data integrity | ✅ Done | `use-files-page.tsx` |
| **Merge Score + Quality → one column** | **Structural** | ✅ Done | `file-explorer-table.tsx` |
| **Import dialog right-sized** | **Structural** | ✅ Done | `WizardDialog.tsx` |
| Jobs "Scheduled Jobs" rename | Cosmetic | ✅ Done | `jobs-list.tsx` |
| **Jobs summary stats strip** | **Structural** | ✅ Done | `jobs-list.tsx` |
| Import wizard: no auto-advance | Behavioral | ✅ Done | `SourceStep.tsx` |

---

## 9. Remaining Backlog (Not Yet Implemented)

| Priority | Change | Rationale |
|----------|--------|-----------|
| Medium | Quarantine editor: add keyboard shortcut cheatsheet | Power users work fast; discoverability of shortcuts improves efficiency |
| Medium | File detail dialog: sticky header with file name + score while scrolling tabs | Context is lost when scrolling deep into DQ report |
| Low | Dashboard: "Needs Attention" banner links directly to filtered file view | Currently links to `/files?tab=explorer&status=attention` which doesn't work cleanly |
| Low | Processing wizard: step names in dialog header (not just stepper) | "Process: filename.csv · Step 2 of 5" gives more context than step dots alone |
| Low | Mobile: bottom navigation bar instead of hamburger | Mobile users need persistent nav access, not a menu to open |
