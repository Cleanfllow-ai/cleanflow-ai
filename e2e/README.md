# CleanFlowAI Playwright E2E Tests

Multi-cardinality jobs feature verification — covers the 10 plan scenarios from `C:\Users\suchi\.claude\plans\listen-up-i-want-spicy-origami.md`.

## Quick start

```bash
# 1. Install browsers (one-time)
npx playwright install chromium

# 2. Set credentials (one-time, do NOT commit)
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3000"   # or your dev URL
$env:PLAYWRIGHT_TEST_EMAIL = "<your-cognito-test-user>"
$env:PLAYWRIGHT_TEST_PASSWORD = "<password>"

# 3. Start the frontend (separate terminal)
npm run dev

# 4. Run tests
npx playwright test                          # full suite
npx playwright test --headed                 # visible browser
npx playwright test --ui                     # interactive runner
npx playwright test e2e/smoke.spec.ts        # just smoke
npx playwright test e2e/jobs/                # cardinality scenarios only
npx playwright show-trace test-results/...   # replay a failure
```

## Connector setup

The cardinality scenarios assume your test org has the following connectors connected via **Settings → Connectors**:
- **QuickBooks Online** (sandbox tenant recommended)
- **Zoho Books** (sandbox / dev org)
- **Snowflake** (warehouse with at least one queryable table)

Optional — Snowflake-specific overrides:
```bash
$env:PLAYWRIGHT_SNOWFLAKE_DB = "ANALYTICS_DB"
$env:PLAYWRIGHT_SNOWFLAKE_SCHEMA = "PUBLIC"
$env:PLAYWRIGHT_SNOWFLAKE_TABLE = "customers"
```

If a connector isn't connected, the scenario that depends on it will SKIP rather than fail — so partial setups still produce useful runs.

## What's covered (10 scenarios from the plan)

| File | Scenario | Status |
|---|---|---|
| `smoke.spec.ts` | Login page renders, no crashes | ✅ Always runs (no auth) |
| `smoke.spec.ts` | Home redirects unauth users | ✅ Always runs |
| `jobs/wizard-cardinality.spec.ts` | 1:1 ERP→ERP, auto-map, save | ⚠️ Needs auth + ZB+QBO |
| `jobs/wizard-cardinality.spec.ts` | 1:N ERP→ERP+Warehouse | ⚠️ Needs auth + QBO+ZB+Snowflake |
| `jobs/wizard-cardinality.spec.ts` | N:1 union (multi-source → single dest) | ⚠️ Needs auth + QBO+ZB+Snowflake |
| `jobs/wizard-cardinality.spec.ts` | M:N blocked at UI | ⚠️ Needs auth + 3 connectors |
| `jobs/wizard-cardinality.spec.ts` | Save mapping → reuse from Settings | ⚠️ Needs auth + ZB+QBO |
| `jobs/wizard-cardinality.spec.ts` | #8 batch action — select N, run | ⚠️ Needs auth + ≥2 jobs |

To-do (not yet written, low value-per-test until 1:1 base case is green):
- 1:1 ERP→Warehouse (manual mapping for warehouse dest)
- 1:1 Warehouse→ERP (warehouse-as-source dynamic schema)
- Migration script `--dry-run` then `--apply` then verify legacy job loads

## Selectors

Tests use `getByRole / getByLabel / getByText` with regex name matching where possible — robust to copy changes. Where exact identification matters, tests use `data-testid` attributes that should be added to the components:

```
data-testid="endpoint-panel-source"
data-testid="endpoint-panel-destination"
data-testid="mapping-panel-{stepId}"
data-testid="confidence-badge-{sourceField}"
```

If your components don't yet have these test IDs, the tests that use them will fail — add them as you go.

## Common failures

| Symptom | Likely cause |
|---|---|
| `setup` skipped with "PLAYWRIGHT_TEST_EMAIL not set" | Set the env vars (Quick start step 2) |
| All tests skip with "Connector not configured" | Connect ZB/QBO/Snowflake via Settings → Connectors first |
| 401 / login loop | Cognito test user expired or password reset required |
| `Wizard mounts to ...` timeout | `npm run dev` not running, or backend deployed differently than `PLAYWRIGHT_BASE_URL` |
| Auto-map produces 0 mappings | Connector returned no fields — check the connector connection itself in Settings |

## Why no GitHub Actions config

Live ZB/QBO/Snowflake calls don't belong in CI. Run locally before EOD push or against a deployed dev env.
