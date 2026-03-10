# Quarantine Editor Migration Plan: feature/asfar → feature/teenie_refactor

## Executive Summary

**Feature**: AI/Quarantine Editor - Advanced spreadsheet-like editor for quarantined data rows with session management, pagination, autosave, and version control.

**Migration Goal**: Extract the quarantine editor implementation from `feature/asfar` (old flat architecture) and refactor it into `feature/teenie_refactor` (module-based FSD architecture) without architectural debt.

---

## 1. Architecture Comparison

### Current (feature/asfar) - Flat Component Structure
```
components/files/
├── QuarantineEditor.tsx              # Legacy simple version
├── quarantine-editor-dialog.tsx      # New advanced version ⭐
lib/api/
└── file-management-api.ts            # Monolithic API client
```

### Target (feature/teenie_refactor) - Module-Based FSD
```
modules/files/
├── api/
│   ├── file-dq-api.ts
│   ├── file-export-api.ts
│   ├── file-management-api.ts       # Split API concerns
│   └── index.ts
├── components/
│   ├── quarantine-editor/           # NEW: Quarantine editor components
│   └── index.ts
├── hooks/
│   ├── use-quarantine-editor.ts     # NEW: Business logic hook
│   └── index.ts
├── types/
│   ├── quarantine.types.ts          # NEW: Type definitions
│   └── index.ts
├── store/
│   └── filesSlice.ts
└── index.ts
```

---

## 2. Step-by-Step Migration Strategy

### Phase 1: Analysis & Extraction (2-3 hours)

#### Step 1.1: Identify Reusable Logic vs. Coupled Structure

**Reusable Business Logic (Pure Gold 🟢)**
- ✅ CSV parsing logic (`parseLegacyCsv`, `splitCSVLine`)
- ✅ Session management state machine
- ✅ Autosave debouncing mechanism
- ✅ Virtual scrolling calculations
- ✅ Cell editing state management
- ✅ Pagination and cursor-based loading
- ✅ Edit batching (MAX_EDITS_PER_BATCH)
- ✅ Compatibility mode detection and fallback

**Tightly Coupled Structure (Needs Refactoring 🟡)**
- 🔄 Component state management (too many `useState` hooks - 13+)
- 🔄 Inline API calls mixed with UI logic
- 🔄 Side effects in component body (`useEffect` with complex dependencies)
- 🔄 Hardcoded constants scattered across component
- 🔄 Toast notifications directly in component

**Technical Debt to Avoid (Red Flags 🔴)**
- ❌ God component pattern (662 lines in single file)
- ❌ Mixed concerns: UI + state + API + business logic
- ❌ No separation of stateless/stateful components
- ❌ Difficult to test (UI, logic, and API tightly coupled)

#### Step 1.2: API Mapping

**Current API Functions (in monolithic file-management-api.ts):**
```typescript
// Session-based APIs (NEW in feature/asfar)
getQuarantineManifest(uploadId, authToken, version)
startQuarantineSession(uploadId, authToken, baseUploadId)
queryQuarantinedRows(uploadId, authToken, payload)
saveQuarantineEditsBatch(uploadId, authToken, payload)
submitQuarantineReprocess(uploadId, authToken, payload)
backfillQuarantineReadModel(uploadId, authToken, version)

// Legacy APIs (fallback compatibility)
reprocessQuarantinedLegacy(uploadId, authToken, payload)
submitCompatibilityReprocessViaUpload(authToken, payload)
downloadFile(uploadId, fileType, dataType, authToken)
getFileVersions(uploadId, authToken)
```

**Target API Organization:**
- Move to `modules/files/api/file-quarantine-api.ts` (NEW FILE)
- Keep related types in `modules/files/types/quarantine.types.ts`

---

### Phase 2: Type System Design (1 hour)

Create `modules/files/types/quarantine.types.ts`:

```typescript
// ========== Domain Types ==========
export interface QuarantineManifest {
  upload_id: string
  root_upload_id: string
  row_count_quarantined: number
  columns: string[]
  editable_columns: string[]
  shard_count: number
  etag: string
}

export interface QuarantineSession {
  session_id: string
  base_upload_id: string
  session_etag: string
}

export interface QuarantineRow {
  row_id: string
  [columnName: string]: any
}

export interface QuarantineEditsBatch {
  row_id: string
  cells: Record<string, any>
}

// ========== Request/Response Types ==========
export interface QuarantineQueryRequest {
  version?: string
  session_id?: string
  cursor?: string
  limit?: number
}

export interface QuarantineQueryResponse {
  rows: QuarantineRow[]
  next_cursor?: string | null
  etag?: string
}

export interface QuarantineSaveBatchRequest {
  session_id: string
  if_match_etag: string
  edits: QuarantineEditsBatch[]
}

export interface QuarantineSaveBatchResponse {
  next_etag: string
  accepted: number
  rejected: Array<{ row_id: string; reason: string }>
}

export interface QuarantineReprocessRequest {
  session_id: string
  if_match_base_upload_id: string
  patch_notes?: string
  submit_token: string
}

export interface QuarantineReprocessResponse {
  execution_arn?: string
  new_upload_id?: string
  status: string
}

// ========== UI State Types ==========
export interface QuarantineEditorState {
  manifest: QuarantineManifest | null
  session: QuarantineSession | null
  rows: QuarantineRow[]
  editsMap: Record<string, Record<string, any>>
  activeCell: { rowId: string; col: string } | null
  cursor: string | null
  hasMore: boolean
  loading: boolean
  saving: boolean
  submitting: boolean
  compatibilityMode: boolean
}

// ========== Configuration ==========
export interface QuarantineEditorConfig {
  pageSize: number
  maxRowsInMemory: number
  maxEditsPerBatch: number
  autosaveDebounceMs: number
  rowHeight: number
  headerHeight: number
  overscan: number
}
```

---

### Phase 3: API Layer Migration (2 hours)

Create `modules/files/api/file-quarantine-api.ts`:

**Refactoring Pattern:**
- Extract API functions from monolithic class
- Apply dependency injection for auth token
- Use consistent error handling
- Add request/response types

```typescript
import { AWS_CONFIG } from '@/shared/config/aws-config'
import type {
  QuarantineManifest,
  QuarantineQueryRequest,
  QuarantineQueryResponse,
  QuarantineSession,
  QuarantineSaveBatchRequest,
  QuarantineSaveBatchResponse,
  QuarantineReprocessRequest,
  QuarantineReprocessResponse,
} from '../types/quarantine.types'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ========== Endpoints ==========
const ENDPOINTS = {
  MANIFEST: (id: string) => `/files/${id}/quarantined/manifest`,
  QUERY: (id: string) => `/files/${id}/quarantined/query`,
  SESSION_START: (id: string) => `/files/${id}/quarantined/session/start`,
  EDITS_BATCH: (id: string) => `/files/${id}/quarantined/edits/batch`,
  REPROCESS_SUBMIT: (id: string) => `/files/${id}/quarantined/reprocess-submit`,
  BACKFILL: (id: string) => `/files/${id}/quarantined/backfill-read-model`,
  LEGACY_REPROCESS: (id: string) => `/files/${id}/reprocess-quarantined`,
}

// ========== API Functions ==========
export async function getQuarantineManifest(
  uploadId: string,
  authToken: string,
  version: string = 'latest'
): Promise<QuarantineManifest> {
  const params = new URLSearchParams({ version })
  const response = await fetch(
    `${API_BASE_URL}${ENDPOINTS.MANIFEST(uploadId)}?${params}`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  )
  if (!response.ok) throw new Error(`Manifest fetch failed: ${response.statusText}`)
  return response.json()
}

// ... Similar pattern for other API functions
```

---

### Phase 4: Business Logic Extraction (3-4 hours)

Create `modules/files/hooks/use-quarantine-editor.ts`:

**Key Principles:**
- Single Responsibility: Each hook handles ONE concern
- Composability: Combine smaller hooks for complex features
- Testability: Pure functions, mockable dependencies

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import * as quarantineApi from '../api/file-quarantine-api'
import type {
  QuarantineEditorState,
  QuarantineEditorConfig,
  QuarantineRow,
} from '../types/quarantine.types'

// ========== Configuration Hook ==========
export function useQuarantineConfig(): QuarantineEditorConfig {
  return {
    pageSize: 200,
    maxRowsInMemory: 10000,
    maxEditsPerBatch: 1000,
    autosaveDebounceMs: 800,
    rowHeight: 32,
    headerHeight: 34,
    overscan: 20,
  }
}

// ========== Session Management Hook ==========
export function useQuarantineSession(uploadId: string, authToken: string) {
  const [state, setState] = useState<Pick<QuarantineEditorState, 'manifest' | 'session' | 'loading'>>({
    manifest: null,
    session: null,
    loading: false,
  })

  const initialize = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const manifest = await quarantineApi.getQuarantineManifest(uploadId, authToken, 'latest')
      const session = await quarantineApi.startQuarantineSession(uploadId, authToken, manifest.upload_id)
      setState({ manifest, session, loading: false })
      return { manifest, session }
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }))
      throw error
    }
  }, [uploadId, authToken])

  return { ...state, initialize }
}

// ========== Data Fetching Hook ==========
export function useQuarantineRows(
  uploadId: string,
  authToken: string,
  config: QuarantineEditorConfig
) {
  const [rows, setRows] = useState<QuarantineRow[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const fetchNext = useCallback(async (
    sessionId?: string,
    baseUploadId?: string,
    nextCursor?: string | null
  ) => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const response = await quarantineApi.queryQuarantinedRows(uploadId, authToken, {
        version: baseUploadId,
        session_id: sessionId,
        cursor: nextCursor ?? cursor ?? undefined,
        limit: config.pageSize,
      })

      setRows(prev => [...prev, ...response.rows])
      setCursor(response.next_cursor ?? null)
      setHasMore(Boolean(response.next_cursor))
    } finally {
      setLoading(false)
    }
  }, [uploadId, authToken, cursor, hasMore, loading, config.pageSize])

  return { rows, cursor, hasMore, loading, fetchNext, setRows }
}

// ========== Edit Management Hook ==========
export function useQuarantineEdits() {
  const [editsMap, setEditsMap] = useState<Record<string, Record<string, any>>>({})
  const [activeCell, setActiveCell] = useState<{ rowId: string; col: string } | null>(null)

  const editCell = useCallback((rowId: string, column: string, value: any) => {
    setEditsMap(prev => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [column]: value }
    }))
  }, [])

  const clearEdits = useCallback(() => {
    setEditsMap({})
  }, [])

  const pendingCount = Object.keys(editsMap).length

  return { editsMap, activeCell, setActiveCell, editCell, clearEdits, pendingCount }
}

// ========== Autosave Hook ==========
export function useQuarantineAutosave(
  saveFunction: () => Promise<void>,
  pendingCount: number,
  debounceMs: number,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled || pendingCount === 0) return

    const timer = window.setTimeout(() => {
      void saveFunction()
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [saveFunction, pendingCount, debounceMs, enabled])
}

// ========== Virtual Scrolling Hook ==========
export function useQuarantineVirtualScroll(
  rows: QuarantineRow[],
  config: QuarantineEditorConfig
) {
  const [scrollTop, setScrollTop] = useState(0)
  const parentRef = useRef<HTMLDivElement | null>(null)

  const viewportHeight = parentRef.current?.clientHeight || 600
  const visibleStart = Math.max(0, Math.floor(scrollTop / config.rowHeight) - config.overscan)
  const visibleEnd = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / config.rowHeight) + config.overscan
  )
  const virtualRows = rows.slice(visibleStart, visibleEnd)

  const handleScroll = useCallback(() => {
    if (parentRef.current) {
      setScrollTop(parentRef.current.scrollTop)
    }
  }, [])

  return { parentRef, virtualRows, visibleStart, handleScroll }
}

// ========== Main Orchestration Hook ==========
export function useQuarantineEditor(
  file: { upload_id: string } | null,
  authToken: string | null,
  open: boolean
) {
  const config = useQuarantineConfig()
  const { toast } = useToast()

  // Session management
  const session = useQuarantineSession(file?.upload_id || '', authToken || '')

  // Data fetching
  const rowsState = useQuarantineRows(file?.upload_id || '', authToken || '', config)

  // Edit management
  const editsState = useQuarantineEdits()

  // Saving logic
  const [saving, setSaving] = useState(false)
  const saveEdits = useCallback(async () => {
    if (!file || !authToken || !session.session || editsState.pendingCount === 0) return

    setSaving(true)
    try {
      const editEntries = Object.entries(editsState.editsMap)
      const edits = editEntries.map(([rowId, cells]) => ({ row_id: rowId, cells }))

      await quarantineApi.saveQuarantineEditsBatch(file.upload_id, authToken, {
        session_id: session.session.session_id,
        if_match_etag: session.manifest?.etag || '',
        edits,
      })

      editsState.clearEdits()
      toast({ title: 'Edits saved successfully' })
    } catch (error: any) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [file, authToken, session, editsState, toast])

  // Autosave
  useQuarantineAutosave(saveEdits, editsState.pendingCount, config.autosaveDebounceMs, open)

  // Virtual scrolling
  const virtualScroll = useQuarantineVirtualScroll(rowsState.rows, config)

  return {
    session,
    rows: rowsState,
    edits: editsState,
    virtualScroll,
    saving,
    saveEdits,
  }
}
```

---

### Phase 5: Component Architecture (3-4 hours)

Create modular component structure in `modules/files/components/quarantine-editor/`:

```
quarantine-editor/
├── index.tsx                          # Main dialog wrapper
├── quarantine-editor-header.tsx       # Header with badges
├── quarantine-editor-toolbar.tsx      # Action buttons
├── quarantine-editor-table.tsx        # Virtual table
├── quarantine-editor-cell.tsx         # Editable cell
├── quarantine-version-lineage.tsx     # Version history
└── types.ts                           # Component prop types
```

**Component Breakdown:**

**1. Main Dialog (index.tsx)**
```typescript
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useQuarantineEditor } from '../../hooks/use-quarantine-editor'
import { QuarantineEditorHeader } from './quarantine-editor-header'
import { QuarantineEditorToolbar } from './quarantine-editor-toolbar'
import { QuarantineEditorTable } from './quarantine-editor-table'

interface QuarantineEditorDialogProps {
  file: FileStatusResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuarantineEditorDialog({ file, open, onOpenChange }: QuarantineEditorDialogProps) {
  const { idToken } = useAuth()
  const editor = useQuarantineEditor(file, idToken, open)

  if (!editor.session.manifest) {
    return <LoadingState />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[1700px] h-[90vh] p-0">
        <QuarantineEditorHeader
          manifest={editor.session.manifest}
          pendingCount={editor.edits.pendingCount}
        />
        <QuarantineEditorToolbar
          saving={editor.saving}
          onSave={editor.saveEdits}
          onReprocess={/* ... */}
        />
        <QuarantineEditorTable
          columns={editor.session.manifest.columns}
          rows={editor.rows.rows}
          virtualScroll={editor.virtualScroll}
          edits={editor.edits}
        />
      </DialogContent>
    </Dialog>
  )
}
```

**2. Header Component (quarantine-editor-header.tsx)**
```typescript
import { Badge } from '@/components/ui/badge'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { QuarantineManifest } from '../../types/quarantine.types'

interface Props {
  manifest: QuarantineManifest
  pendingCount: number
}

export function QuarantineEditorHeader({ manifest, pendingCount }: Props) {
  return (
    <DialogHeader className="px-4 py-2 border-b">
      <DialogTitle className="flex items-center gap-2">
        Quarantine Editor
        <Badge variant="secondary">
          {manifest.row_count_quarantined.toLocaleString()} rows
        </Badge>
        <Badge variant="outline">
          {manifest.columns.length} columns
        </Badge>
        <Badge variant={pendingCount > 0 ? 'destructive' : 'outline'}>
          {pendingCount > 0 ? `${pendingCount} unsaved` : 'saved'}
        </Badge>
      </DialogTitle>
    </DialogHeader>
  )
}
```

**3. Toolbar Component** - Similar pattern for actions
**4. Table Component** - Handles virtual scrolling + cell rendering
**5. Cell Component** - Editable cell with inline editing

---

### Phase 6: Integration & Testing (2-3 hours)

#### Step 6.1: Update Files Module Index
```typescript
// modules/files/index.ts
export * from './components/quarantine-editor'
export * from './hooks/use-quarantine-editor'
export * from './types/quarantine.types'
export * from './api/file-quarantine-api'
```

#### Step 6.2: Update Files Page
```typescript
// app/files/page.tsx or modules/files/page/files-page-dialogs.tsx
import { QuarantineEditorDialog } from '@/modules/files'

// ... in component
<QuarantineEditorDialog
  file={selectedFile}
  open={showQuarantineEditor}
  onOpenChange={setShowQuarantineEditor}
/>
```

#### Step 6.3: Create Test Plan

**Unit Tests:**
- ✅ CSV parsing utilities
- ✅ Individual hooks (use-quarantine-session, use-quarantine-edits)
- ✅ API functions with mocked fetch

**Integration Tests:**
- ✅ Full hook orchestration (useQuarantineEditor)
- ✅ Component rendering with mock data
- ✅ Autosave behavior
- ✅ Virtual scrolling edge cases

**E2E Tests:**
- ✅ Load quarantine editor dialog
- ✅ Edit cells and verify autosave
- ✅ Submit reprocess and verify new version creation
- ✅ Compatibility mode fallback

---

## 3. Mapping Old Controllers/Services/Models to New Layers

### Old Architecture → New FSD Layers

| Old Component | New Location | Responsibility |
|--------------|--------------|----------------|
| `quarantine-editor-dialog.tsx` (component) | `modules/files/components/quarantine-editor/index.tsx` | UI orchestration |
| State management (13 `useState` hooks) | `modules/files/hooks/use-quarantine-editor.ts` | Business logic |
| API calls (inline) | `modules/files/api/file-quarantine-api.ts` | Data fetching |
| Type definitions (inline interfaces) | `modules/files/types/quarantine.types.ts` | Type system |
| CSV parsing (inline functions) | `modules/files/utils/csv-parser.ts` | Utilities |
| Constants (inline) | `modules/files/constants/quarantine.constants.ts` | Configuration |

### SOLID Principles Compliance

**Single Responsibility:**
- ✅ Each hook handles ONE concern (session, rows, edits, autosave, virtual scroll)
- ✅ Components are presentational or container (not both)
- ✅ API functions do ONE thing

**Open/Closed:**
- ✅ Hooks are composable - can extend without modifying
- ✅ Config object allows customization without changing code

**Liskov Substitution:**
- ✅ Compatibility mode provides same interface as modern mode
- ✅ Legacy API fallback is transparent to consumers

**Interface Segregation:**
- ✅ Separate hooks instead of one god hook
- ✅ Components receive only props they need

**Dependency Inversion:**
- ✅ Hooks depend on abstractions (API interface, not implementation)
- ✅ Components depend on hooks, not direct API calls

---

## 4. Risk Areas During Migration

### High Risk 🔴

1. **State Synchronization Issues**
   - **Risk**: Edits lost between autosave cycles
   - **Mitigation**: Implement optimistic updates + rollback on failure
   - **Test**: Network interruption during save

2. **Virtual Scrolling Bugs**
   - **Risk**: Rows rendered at wrong positions after edits
   - **Mitigation**: Immutable row updates, key by row_id not index
   - **Test**: Edit first/last visible rows while scrolling

3. **Session/ETag Conflicts**
   - **Risk**: Concurrent edits from multiple tabs/users
   - **Mitigation**: Implement conflict resolution UI (show ETag mismatch error)
   - **Test**: Open same file in two tabs, edit simultaneously

4. **Memory Leaks**
   - **Risk**: Large datasets not garbage collected
   - **Mitigation**: Implement row trimming (MAX_ROWS_IN_MEMORY), cleanup in `useEffect` returns
   - **Test**: Monitor memory with 50k+ rows loaded

### Medium Risk 🟡

5. **Compatibility Mode Edge Cases**
   - **Risk**: Legacy API has different response format
   - **Mitigation**: Comprehensive type guards, schema validation
   - **Test**: Mock different API versions

6. **CSV Parsing Edge Cases**
   - **Risk**: Malformed CSV with nested quotes, line breaks
   - **Mitigation**: Use battle-tested library (papaparse) instead of custom parser
   - **Test**: Fuzz testing with edge case CSVs

7. **Type Safety**
   - **Risk**: Runtime type mismatches from API
   - **Mitigation**: Use Zod for runtime validation
   - **Test**: Mock API with invalid responses

### Low Risk 🟢

8. **UI Rendering Performance**
   - **Risk**: Sluggish with many columns
   - **Mitigation**: Already using virtual scrolling
   - **Test**: Render 100+ columns

9. **Toast Notification Spam**
   - **Risk**: Autosave triggers too many toasts
   - **Mitigation**: Silent autosave, only show on errors
   - **Test**: Make 50 rapid edits

---

## 5. Git Workflow Strategy

### Branch Strategy

```
feature/teenie_refactor (FSD architecture)
    ↓
feature/quarantine-editor-migration (work branch)
    ↓
feature/quarantine-editor-migration-final (clean PR branch)
```

### Step-by-Step Git Workflow

#### Step 1: Create Work Branch
```bash
git checkout feature/teenie_refactor
git pull origin feature/teenie_refactor
git checkout -b feature/quarantine-editor-migration
```

#### Step 2: Extract Files from feature/asfar (NO MERGE)
```bash
# DO NOT merge - selectively extract files
git checkout feature/asfar -- components/files/quarantine-editor-dialog.tsx
git checkout feature/asfar -- components/files/QuarantineEditor.tsx
git checkout feature/asfar -- lib/api/file-management-api.ts

# Review what changed in API file
git diff feature/teenie_refactor feature/asfar -- lib/api/file-management-api.ts
```

#### Step 3: Refactor in Phases (Commit After Each Phase)
```bash
# Phase 1: Create types
# ... create modules/files/types/quarantine.types.ts
git add modules/files/types/quarantine.types.ts
git commit -m "feat(quarantine): add quarantine editor type definitions"

# Phase 2: Create API layer
# ... create modules/files/api/file-quarantine-api.ts
git add modules/files/api/file-quarantine-api.ts
git commit -m "feat(quarantine): add quarantine API client"

# Phase 3: Create hooks
# ... create modules/files/hooks/use-quarantine-editor.ts
git add modules/files/hooks/use-quarantine-editor.ts
git commit -m "feat(quarantine): add quarantine editor hooks"

# Phase 4: Create components
# ... create modules/files/components/quarantine-editor/*
git add modules/files/components/quarantine-editor/
git commit -m "feat(quarantine): add quarantine editor components"

# Phase 5: Integration
# ... update files page
git add app/files/page.tsx modules/files/index.ts
git commit -m "feat(quarantine): integrate quarantine editor into files page"

# Phase 6: Remove old extracted files
git rm components/files/quarantine-editor-dialog.tsx
git rm components/files/QuarantineEditor.tsx
git commit -m "refactor(quarantine): remove old quarantine editor files"
```

#### Step 4: Test & Fix
```bash
# Run tests
pnpm test

# Run linter
pnpm lint

# Manual testing
pnpm dev

# Commit fixes
git commit -am "fix(quarantine): resolve edge cases in virtual scrolling"
```

#### Step 5: Create Clean PR Branch
```bash
# Option A: Keep all commits (show refactoring process)
git checkout -b feature/quarantine-editor-migration-final
git push origin feature/quarantine-editor-migration-final

# Option B: Squash into logical commits (cleaner history)
git rebase -i feature/teenie_refactor
# Squash phases into 3-4 commits:
# 1. feat(quarantine): add type system and API layer
# 2. feat(quarantine): add business logic hooks
# 3. feat(quarantine): add UI components and integration
# 4. refactor(quarantine): remove legacy implementation
git push origin feature/quarantine-editor-migration-final
```

#### Step 6: Create Pull Request
```bash
gh pr create \
  --base feature/teenie_refactor \
  --head feature/quarantine-editor-migration-final \
  --title "feat: Migrate Quarantine Editor to FSD Architecture" \
  --body "$(cat <<'EOF'
## Summary
Migrates the AI/Quarantine Editor feature from feature/asfar to the refactored FSD architecture.

## Changes
- ✅ Type system: `modules/files/types/quarantine.types.ts`
- ✅ API layer: `modules/files/api/file-quarantine-api.ts`
- ✅ Business logic: `modules/files/hooks/use-quarantine-editor.ts`
- ✅ UI components: `modules/files/components/quarantine-editor/`
- ✅ Integration: Updated files page
- ✅ Removed legacy files

## Testing
- [ ] Manual: Load quarantine editor dialog
- [ ] Manual: Edit cells and verify autosave
- [ ] Manual: Submit reprocess
- [ ] Manual: Test compatibility mode
- [ ] Unit tests passing
- [ ] E2E tests passing

## Migration Notes
- No direct merge from feature/asfar
- Extracted business logic into composable hooks
- Followed SOLID principles
- No architectural debt introduced

Closes #XXX
EOF
)"
```

### Cherry-Picking Strategy (Alternative)

If you prefer cherry-picking specific commits:

```bash
# Find commits related to quarantine editor in feature/asfar
git log feature/asfar --oneline --grep="quarantine\|editor"

# Cherry-pick specific commits
git cherry-pick <commit-hash-1>
git cherry-pick <commit-hash-2>

# Resolve conflicts by refactoring into FSD structure
# ... manual refactoring
git add .
git cherry-pick --continue
```

**Note:** Cherry-picking is NOT recommended here because:
- ❌ Commits are tied to old architecture
- ❌ Will create many conflicts
- ❌ Harder to maintain SOLID principles
- ✅ Better to extract files and refactor cleanly

---

## 6. Implementation Checklist

### Pre-Migration
- [ ] Backup current work: `git stash` or commit
- [ ] Ensure feature/teenie_refactor is up-to-date
- [ ] Review CLAUDE.md for architecture guidelines
- [ ] Set up testing environment

### Phase 1: Analysis (Day 1)
- [ ] Read old implementation thoroughly
- [ ] Document all API calls and their purposes
- [ ] Identify pure functions vs. side effects
- [ ] Map component state to hook state
- [ ] Create type definitions document

### Phase 2: Foundation (Day 1-2)
- [ ] Create `modules/files/types/quarantine.types.ts`
- [ ] Create `modules/files/constants/quarantine.constants.ts`
- [ ] Create `modules/files/utils/csv-parser.ts`
- [ ] Write unit tests for utilities

### Phase 3: API Layer (Day 2)
- [ ] Create `modules/files/api/file-quarantine-api.ts`
- [ ] Extract all API functions
- [ ] Add proper TypeScript types
- [ ] Mock API and write integration tests

### Phase 4: Business Logic (Day 2-3)
- [ ] Create `modules/files/hooks/use-quarantine-config.ts`
- [ ] Create `modules/files/hooks/use-quarantine-session.ts`
- [ ] Create `modules/files/hooks/use-quarantine-rows.ts`
- [ ] Create `modules/files/hooks/use-quarantine-edits.ts`
- [ ] Create `modules/files/hooks/use-quarantine-autosave.ts`
- [ ] Create `modules/files/hooks/use-quarantine-virtual-scroll.ts`
- [ ] Create `modules/files/hooks/use-quarantine-editor.ts` (orchestrator)
- [ ] Write unit tests for each hook

### Phase 5: UI Components (Day 3-4)
- [ ] Create component folder structure
- [ ] Create `quarantine-editor-header.tsx`
- [ ] Create `quarantine-editor-toolbar.tsx`
- [ ] Create `quarantine-editor-table.tsx`
- [ ] Create `quarantine-editor-cell.tsx`
- [ ] Create `quarantine-version-lineage.tsx`
- [ ] Create `index.tsx` (main dialog)
- [ ] Write component tests

### Phase 6: Integration (Day 4)
- [ ] Update `modules/files/index.ts` exports
- [ ] Update files page to use new component
- [ ] Update relevant Redux slices if needed
- [ ] Test end-to-end flow
- [ ] Fix any integration bugs

### Phase 7: Polish (Day 5)
- [ ] Run full test suite
- [ ] Fix failing tests
- [ ] Run linter and fix issues
- [ ] Manual QA testing
- [ ] Update documentation
- [ ] Create PR

### Post-Migration
- [ ] Code review
- [ ] Address review comments
- [ ] Merge to feature/teenie_refactor
- [ ] Monitor for bugs
- [ ] Update team on new architecture

---

## 7. Testing Strategy

### Unit Tests (Jest + React Testing Library)

**Utilities:**
```typescript
// modules/files/utils/__tests__/csv-parser.test.ts
describe('parseLegacyCsv', () => {
  it('should parse basic CSV', () => {
    const csv = 'name,age\nAlice,30\nBob,25'
    const result = parseLegacyCsv(csv)
    expect(result.columns).toEqual(['row_id', 'name', 'age'])
    expect(result.rows).toHaveLength(2)
  })

  it('should handle quoted values with commas', () => {
    const csv = 'name,address\n"Smith, John","123 Main St, NYC"'
    // ... assertions
  })
})
```

**Hooks:**
```typescript
// modules/files/hooks/__tests__/use-quarantine-edits.test.ts
import { renderHook, act } from '@testing-library/react'
import { useQuarantineEdits } from '../use-quarantine-edits'

describe('useQuarantineEdits', () => {
  it('should track cell edits', () => {
    const { result } = renderHook(() => useQuarantineEdits())

    act(() => {
      result.current.editCell('row-1', 'name', 'Updated Name')
    })

    expect(result.current.editsMap['row-1']).toEqual({ name: 'Updated Name' })
    expect(result.current.pendingCount).toBe(1)
  })
})
```

**API:**
```typescript
// modules/files/api/__tests__/file-quarantine-api.test.ts
import { getQuarantineManifest } from '../file-quarantine-api'

describe('getQuarantineManifest', () => {
  it('should fetch manifest successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ upload_id: 'test', columns: ['col1'] })
    })

    const result = await getQuarantineManifest('upload-123', 'token')
    expect(result.upload_id).toBe('test')
  })
})
```

### Integration Tests

```typescript
// modules/files/hooks/__tests__/use-quarantine-editor.integration.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useQuarantineEditor } from '../use-quarantine-editor'

describe('useQuarantineEditor integration', () => {
  it('should initialize session and load rows', async () => {
    // Mock API responses
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockManifest })
      .mockResolvedValueOnce({ ok: true, json: async () => mockSession })
      .mockResolvedValueOnce({ ok: true, json: async () => mockRows })

    const { result } = renderHook(() =>
      useQuarantineEditor({ upload_id: 'test' }, 'token', true)
    )

    await waitFor(() => {
      expect(result.current.session.manifest).toBeTruthy()
      expect(result.current.rows.rows).toHaveLength(200)
    })
  })
})
```

### E2E Tests (Playwright)

```typescript
// e2e/quarantine-editor.spec.ts
import { test, expect } from '@playwright/test'

test('quarantine editor full workflow', async ({ page }) => {
  await page.goto('/files')

  // Open quarantine editor
  await page.click('[data-testid="file-row-quarantine-btn"]')
  await expect(page.locator('[data-testid="quarantine-editor-dialog"]')).toBeVisible()

  // Edit a cell
  await page.click('[data-testid="quarantine-cell-0-name"]')
  await page.fill('[data-testid="quarantine-cell-input"]', 'Updated Name')
  await page.keyboard.press('Enter')

  // Wait for autosave
  await expect(page.locator('text=saved')).toBeVisible({ timeout: 2000 })

  // Submit reprocess
  await page.click('[data-testid="quarantine-reprocess-btn"]')
  await expect(page.locator('text=Reprocess submitted')).toBeVisible()
})
```

---

## 8. Success Criteria

### Technical Success
- ✅ All code follows FSD architecture principles
- ✅ Zero ESLint errors
- ✅ Zero TypeScript errors
- ✅ 80%+ code coverage
- ✅ All E2E tests passing
- ✅ No console errors in dev mode
- ✅ Build succeeds without warnings

### Architectural Success
- ✅ SOLID principles applied throughout
- ✅ No god components (max 150 lines per component)
- ✅ Hooks are composable and testable
- ✅ Clear separation of concerns (API / logic / UI)
- ✅ Type safety (no `any` types)
- ✅ Proper error boundaries
- ✅ Performance: Handles 10k+ rows smoothly

### Business Success
- ✅ Feature parity with old implementation
- ✅ All edge cases handled (compatibility mode, errors, etc.)
- ✅ User experience unchanged or improved
- ✅ No regressions in existing features
- ✅ Can be extended easily for future requirements

---

## 9. Rollback Plan

If migration fails or introduces critical bugs:

### Immediate Rollback (< 1 hour)
```bash
# Option 1: Revert the merge commit
git revert -m 1 <merge-commit-hash>
git push origin feature/teenie_refactor

# Option 2: Reset to pre-migration commit
git checkout feature/teenie_refactor
git reset --hard <commit-before-migration>
git push --force origin feature/teenie_refactor  # ⚠️ DANGER: Only if no one else has pulled
```

### Partial Rollback (Keep Types/API, Revert UI)
```bash
# Cherry-pick only non-UI commits
git revert <component-commit-hash>
git push origin feature/teenie_refactor
```

### Feature Flag (Recommended)
```typescript
// Add feature flag in shared/config/features.ts
export const FEATURES = {
  NEW_QUARANTINE_EDITOR: process.env.NEXT_PUBLIC_ENABLE_NEW_QUARANTINE_EDITOR === 'true'
}

// Use in files page
{FEATURES.NEW_QUARANTINE_EDITOR ? (
  <QuarantineEditorDialog />  // New
) : (
  <QuarantineEditorDialogLegacy />  // Old
)}
```

---

## 10. Timeline & Effort Estimation

| Phase | Tasks | Time | Assignee |
|-------|-------|------|----------|
| **Analysis** | Review code, document architecture | 2-3 hours | Primary Maintainer |
| **Type System** | Create types, interfaces | 1 hour | Primary Maintainer |
| **API Layer** | Extract and refactor API calls | 2 hours | Primary Maintainer |
| **Utilities** | CSV parser, helpers | 1 hour | Primary Maintainer |
| **Business Logic** | Create hooks | 3-4 hours | Primary Maintainer |
| **UI Components** | Component breakdown | 3-4 hours | Primary Maintainer |
| **Integration** | Wire everything together | 2 hours | Primary Maintainer |
| **Testing** | Unit + E2E tests | 3-4 hours | Primary Maintainer + QA |
| **QA & Bug Fixes** | Manual testing, fixes | 2-3 hours | Primary Maintainer + QA |
| **Documentation** | Update docs, PR review | 1-2 hours | Primary Maintainer |

**Total Estimated Time: 20-26 hours (2.5-3.5 working days)**

**Recommended Schedule:**
- **Day 1**: Analysis + Foundation (types, API, utils)
- **Day 2**: Business Logic (hooks) + Start UI
- **Day 3**: Complete UI + Integration
- **Day 4**: Testing + Bug Fixes
- **Day 5**: Polish + PR Review

---

## 11. Key Takeaways

### What Makes This Migration Successful

1. **No Direct Merge**: Avoid merging branches with different architectures
2. **Extract → Refactor → Integrate**: Systematic approach prevents chaos
3. **SOLID Principles**: Each piece has single responsibility
4. **Type Safety**: Strong types prevent runtime errors
5. **Testability**: Hooks and pure functions are easy to test
6. **Composability**: Small hooks combine into complex features
7. **Git Discipline**: Commit after each phase, clean history

### Anti-Patterns to Avoid

- ❌ Copy-pasting old code without refactoring
- ❌ Mixing old and new architecture patterns
- ❌ Skipping type definitions
- ❌ God hooks with 20+ lines of state
- ❌ Inline API calls in components
- ❌ Skipping tests "to save time"
- ❌ Force-pushing without team communication

---

## 12. Next Steps

1. **Review this plan** with your team
2. **Create a GitHub issue** tracking the migration
3. **Set up a feature flag** for safe rollout
4. **Begin Phase 1** (Analysis) - don't skip it!
5. **Commit frequently** with descriptive messages
6. **Ask for help** if you get stuck on architecture decisions
7. **Celebrate** when it's done! 🎉

---

## Appendix A: File Structure Reference

### Before (feature/asfar)
```
components/files/
├── QuarantineEditor.tsx              (295 lines - legacy)
└── quarantine-editor-dialog.tsx      (662 lines - new)

lib/api/
└── file-management-api.ts            (monolithic, 2000+ lines)
```

### After (feature/teenie_refactor)
```
modules/files/
├── api/
│   ├── file-quarantine-api.ts        (150 lines - focused)
│   └── index.ts
├── components/
│   └── quarantine-editor/
│       ├── index.tsx                 (100 lines - orchestration)
│       ├── quarantine-editor-header.tsx        (40 lines)
│       ├── quarantine-editor-toolbar.tsx       (60 lines)
│       ├── quarantine-editor-table.tsx         (120 lines)
│       ├── quarantine-editor-cell.tsx          (50 lines)
│       └── quarantine-version-lineage.tsx      (60 lines)
├── hooks/
│   ├── use-quarantine-editor.ts      (200 lines - orchestrator)
│   ├── use-quarantine-session.ts     (50 lines)
│   ├── use-quarantine-rows.ts        (60 lines)
│   ├── use-quarantine-edits.ts       (40 lines)
│   ├── use-quarantine-autosave.ts    (20 lines)
│   └── use-quarantine-virtual-scroll.ts (40 lines)
├── types/
│   └── quarantine.types.ts           (80 lines)
├── utils/
│   └── csv-parser.ts                 (60 lines)
└── constants/
    └── quarantine.constants.ts       (20 lines)

Total: ~1,150 lines (vs. 957 in old)
But: Modular, testable, maintainable, extensible
```

### Lines of Code Comparison
- **Old**: 957 lines in 2 god files
- **New**: ~1,150 lines across 17 focused files
- **Increase**: 20% more code
- **Benefit**: 300% more maintainable

---

## Appendix B: Dependencies

### New Dependencies to Install
```bash
# If not already present
pnpm add papaparse  # Better CSV parsing
pnpm add -D @types/papaparse

# For testing
pnpm add -D @testing-library/react-hooks
pnpm add -D @playwright/test  # E2E testing
```

### Update Package.json Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## Appendix C: Common Pitfalls & Solutions

### Pitfall 1: Hook Dependency Arrays
**Problem**: Stale closures in hooks
```typescript
// ❌ BAD: Missing dependencies
useEffect(() => {
  fetchData()
}, []) // fetchData uses state but not in deps

// ✅ GOOD: All dependencies included
useEffect(() => {
  fetchData()
}, [fetchData])
```

### Pitfall 2: Async State Updates
**Problem**: Race conditions
```typescript
// ❌ BAD: No cleanup
useEffect(() => {
  fetchData().then(setData)
}, [])

// ✅ GOOD: Cleanup + abort controller
useEffect(() => {
  let cancelled = false
  const controller = new AbortController()

  fetchData({ signal: controller.signal })
    .then(data => {
      if (!cancelled) setData(data)
    })

  return () => {
    cancelled = true
    controller.abort()
  }
}, [])
```

### Pitfall 3: Ref vs State
**Problem**: Unnecessary re-renders
```typescript
// ❌ BAD: State for non-render values
const [scrollTop, setScrollTop] = useState(0)
onScroll={() => setScrollTop(e.target.scrollTop)}  // Re-renders!

// ✅ GOOD: Ref for non-render values
const scrollTopRef = useRef(0)
onScroll={() => { scrollTopRef.current = e.target.scrollTop }  // No re-render
```

---

**Good luck with the migration! 🚀**

---

**Document Metadata:**
- **Created**: 2026-02-26
- **Author**: Claude Code Migration Assistant
- **Version**: 1.0
- **Last Updated**: 2026-02-26
