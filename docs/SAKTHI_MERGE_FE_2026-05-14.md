# Frontend merge brief for Sakthi — Kiran's session 2026-05-14

**Branch:** `feature/kiran-jobs-fe`
**Pushed commits (3):**

```
7956478  test(e2e/cardinality): selector fixes for multi-card add source/destination
d5f7d0c  fix(jobs/wizard): stale-closure trap in handleMappingNext — "Name required" false-positive
3199035  test(jobs/e2e): playwright cardinality scaffolding + token-injection auth
```

**Companion backend changes:** `feature/kiran-jobs` on `cleanflowai_aws` (see `docs/SAKTHI_MERGE_2026-05-14.md` in that repo). The wizard fix here is dependent on backend hotfix #23 — `CreateJobRequest` DTO accepting `pipeline_steps[]` — which is what makes the wizard's submission payload actually reach `_sync_unified` correctly.

---

## 1. The real bug — `handleMappingNext` stale closure (commit `d5f7d0c`)

### Symptom

End-to-end through the wizard:
1. Open `/jobs/create`
2. Pick Source (Zoho/Customers) + Destination (QBO/Customers)
3. Type a job name (visible in the input)
4. Leave Frequency as the default "Every hour"
5. Click **Next →** to advance to Field Mapping
6. Click **Auto-map (AI)** — succeeds, 26 fields mapped
7. Click **Create Job** in the footer
8. Red toast appears: **"Name required"**

Reproduces 100% via `e2e/jobs/cardinality-final.spec.ts` CARD-1. The Job Name input has the typed value visible AND `inputValue()` returns the string in the DOM, but the wizard's React state for `d.name` is empty when the click handler reads it.

### Root cause

`modules/jobs/components/job-creation-stepper.tsx` line 74 (pre-fix):

```tsx
const handleMappingNext = useCallback(() => {
    if (advancedDQ) {
        setCurrentStep("dq")
    } else {
        void handleCreateDirect()
    }
// eslint-disable-next-line react-hooks/exhaustive-deps   ← red flag
}, [advancedDQ])
```

`handleMappingNext` is memoized with `[advancedDQ]` only. Its body references `handleCreateDirect`, which is itself a `useCallback` that captures `d.name`, `d.frequency`, `d.cronExpression`. Because `handleMappingNext` is only rebuilt when `advancedDQ` changes (it doesn't, throughout the flow), the closure keeps pointing at the render-1 instance of `handleCreateDirect` — whose closure in turn captured the render-1 state of `d.name`, which is `""`.

The `// eslint-disable-next-line react-hooks/exhaustive-deps` comment was the tell. The exhaustive-deps rule would have flagged exactly this. Suppressing it silenced the warning without addressing the underlying staleness.

### Fix

Two-step:

1. **Move `handleMappingNext` declaration BELOW `handleCreateDirect`.** A simple `useCallback(..., [advancedDQ, handleCreateDirect])` would hit the temporal dead zone (TDZ) because `handleCreateDirect` is still uninitialized at the line where `handleMappingNext` is being declared. Hoisting `handleMappingNext` past `handleCreateDirect` resolves the TDZ.
2. **Drop the eslint-disable** and add `handleCreateDirect` to the dep array.

Diff:

```diff
- const handleMappingNext = useCallback(() => {
-     if (advancedDQ) {
-         setCurrentStep("dq")
-     } else {
-         void handleCreateDirect()
-     }
- // eslint-disable-next-line react-hooks/exhaustive-deps
- }, [advancedDQ])
+ // (handleMappingNext is now declared AFTER handleCreateDirect, near the
+ // end of the handlers block, so handleCreateDirect is in scope and we
+ // can include it in deps without hitting the TDZ.)
```

```diff
  await handleCreateJob(defaultDqConfig)
}, [d.name, d.frequency, d.cronExpression, pipeline.pipelineSteps.length, toast, handleCreateJob])

+ const handleMappingNext = useCallback(() => {
+     if (advancedDQ) {
+         setCurrentStep("dq")
+     } else {
+         void handleCreateDirect()
+     }
+ }, [advancedDQ, handleCreateDirect])
```

### Verification

Before:

```
toasts: ["Name required"]
jobsRequests: []           # POST /jobs never fires
```

After:

```
toasts: ["Job Created pw-c1-829051 has been created and scheduled"]
jobsRequests: [{
    url: ".../prod/jobs",
    method: "POST",
    body: {"name":"pw-c1-829051", "source_provider":"zohobooks", ...,
           "frequency_type":"rate", "frequency_value":"1 hour",
           "pipeline_steps":[{"step_id":"zohobooks::customers::quickbooks::customers", ...}]}
}]
```

The Playwright spec at `e2e/jobs/cardinality-final.spec.ts` CARD-1 covers this regression.

### Why this matters beyond CARD-1

`handleMappingNext` is the **only** path the wizard takes from the Mapping step to actually submit a job (unless the user enables Advanced DQ, which routes through `setCurrentStep("dq")` instead). So with the old code, the **default flow** (Advanced DQ off, click "Create Job" from Mapping step) was guaranteed to fail with "Name required" for any user who types the name AFTER opening the wizard (i.e. every user). Hard to imagine this was ever working in production — likely the QA flow had a remount path (e.g. wizard reopened mid-test, which triggers a re-render and rebuilds the closure) or the wizard test was always invoked with the name pre-filled.

Recommended: audit other `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions for the same shape — they're frequently exactly this bug.

---

## 2. Playwright cardinality scaffolding (commits `3199035` + `7956478`)

### `e2e/auth-direct.setup.ts` — token-injection auth

The existing `e2e/auth.setup.ts` does a full UI login + TOTP challenge per Playwright run. In practice it was timing out about half the time because:

- The MFA dialog renders after a Cognito challenge and the test races with the dialog mount
- TOTP codes have a 30s window; Playwright spawns the python helper to generate the code, but the helper itself is slow on Windows (~3s for `conda run`) so the code can expire mid-flow
- Even when login succeeds, the saved storage state's `authTokens` localStorage entry can fall stale (1h Cognito ID-token TTL) between back-to-back test runs

`auth-direct.setup.ts` sidesteps all of this:

1. A separate Python helper calls `cognito-idp:InitiateAuth` + `RespondToAuthChallenge` directly and writes `e2e/.auth/inject-tokens.json` with `{idToken, accessToken, refreshToken}`
2. The Playwright setup reads that file, navigates to `/`, injects the tokens via `window.localStorage.setItem("authTokens", ...)`, then captures storage state for the rest of the suite

To refresh tokens before running tests:

```python
# (run from /d/Infiniqon/fork using the existing creds at e2e/.auth/creds.json)
import boto3, json, pyotp
cog = boto3.client('cognito-idp', region_name='ap-south-1')
creds = json.load(open('cleanflow-ai/e2e/.auth/creds.json'))
r = cog.initiate_auth(ClientId=creds['client_id'], AuthFlow='USER_PASSWORD_AUTH',
    AuthParameters={'USERNAME': creds['email'], 'PASSWORD': creds['password']})
if r.get('ChallengeName') == 'SOFTWARE_TOKEN_MFA':
    code = pyotp.TOTP(open('cleanflow-ai/e2e/.auth/totp_secret.txt').read().strip()).now()
    r = cog.respond_to_auth_challenge(
        ClientId=creds['client_id'], ChallengeName='SOFTWARE_TOKEN_MFA',
        Session=r['Session'],
        ChallengeResponses={'USERNAME': creds['email'], 'SOFTWARE_TOKEN_MFA_CODE': code})
auth = r['AuthenticationResult']
json.dump({'idToken': auth['IdToken'], 'accessToken': auth['AccessToken'], 'refreshToken': auth['RefreshToken']},
          open('cleanflow-ai/e2e/.auth/inject-tokens.json', 'w'))
```

`playwright.config.ts` was updated to point the `setup` project at `*auth-direct.setup.ts` instead of `*auth.setup.ts`. The original `auth.setup.ts` is still on disk if you want to flip back.

### `e2e/jobs/cardinality-final.spec.ts` — wizard cardinality tests

Three tests; selectors derived from `modules/jobs/components/endpoints-step.tsx` source code:

| Test | Cardinality | Result |
|---|---|---|
| `CARD-1` | 1:1 — Zoho customers → QBO customers, frequency = Every hour | ✅ Job created end-to-end, POST /jobs with full `pipeline_steps` payload, success toast |
| `CARD-2` | 1:N — Zoho customers → QBO customers + Snowflake table | ✅ Job created with 1 pipeline step (Snowflake destination configured at the category+provider level but warehouse/db/schema/table selection is skipped — wizard accepts the partial config) |
| `CARD-3` | N:1 — Zoho customers + QBO customers → Snowflake | ⚠ Wizard correctly detects multi-source mode (2 source cards rendered, logged as `src cards: 2`), but Snowflake destination needs warehouse/db/schema/table dropdowns that the test doesn't yet drive |

Helper functions in the spec that are worth lifting into a shared `helpers.ts` later:

- `dismissBanners(page)` — handles the cookies + privacy banners
- `findCard(page, side, index)` — locates source/destination card by side + position
- `pickCategory(card, "Applications"|"Warehouse"|"Storage")` — maps test alias to actual UI option text
- `pickProvider(card, /name/i)` — opens provider dropdown, picks option
- `pickEntity(card, /^Customers$/i)` — clicks the entity button inside the card
- `fillName(page, name)` — uses `pressSequentially` then dispatches a native input event so React picks it up
- `netCapture(page)` — captures POST `/jobs` requests + 4xx/5xx responses + console errors for assertion

### Limitations / TODOs in the spec

1. **Snowflake warehouse-side picker not driven yet** — once `WarehouseEntityPicker` selectors are stable, CARD-3 can be completed.
2. **Manual mapping (drag-and-drop / dropdown-per-field) not exercised** — CARD-1 uses Auto-map (AI). Manual mapping requires interaction with the `column-mapping-editor`'s per-row Select dropdowns; can be added but high-effort.
3. **Priority order (entity_order, run_mode='custom') not tested** — the Priority dialog from MappingStep isn't opened by these tests. Adding it requires walking through the Priority button → reorder → confirm flow.
4. **Cookies banner sometimes covers the Create Job button** — `dismissBanners()` handles it but timing can race with the wizard mount. If you see `pointer events intercepted` errors, add a `page.waitForTimeout(500)` after `openWizard()`.

---

## 3. Files modified

```
modules/jobs/components/job-creation-stepper.tsx  +19 / -10  (real bug fix)
e2e/auth-direct.setup.ts                          + new file (98 lines)
e2e/jobs/cardinality-final.spec.ts                + new file (~430 lines)
e2e/jobs/cardinality-ui.spec.ts                   + new file (older first-pass spec; can delete)
e2e/jobs/debug-auth.spec.ts                       + new file (debug helper; safe to delete)
e2e/jobs/probe-step1.spec.ts                      + new file (DOM probe utility; safe to delete)
e2e/jobs/schedule-bug-repro.spec.ts               + new file (org-id repro attempt; superseded by cardinality-final)
e2e/.auth/inject-tokens.json                      + new file (gitignored; ephemeral tokens)
playwright.config.ts                              +2 / -2    (setup project regex flipped to auth-direct)
e2e/.artifacts/*.png                              + screenshots (gitignored)
```

Recommended cleanup pre-merge:
- Keep: `auth-direct.setup.ts`, `cardinality-final.spec.ts`, the `job-creation-stepper.tsx` fix, the `playwright.config.ts` flip
- Delete: `cardinality-ui.spec.ts`, `debug-auth.spec.ts`, `probe-step1.spec.ts`, `schedule-bug-repro.spec.ts`

---

## 4. Reproducing the test run locally

```bash
cd cleanflow-ai

# 1. Build prod (dev mode's Fast Refresh interferes with Playwright timing)
npm run build && npm run start &
# wait for it to be up
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ # → 200

# 2. Refresh injected tokens — run the python snippet from §2 above
# (writes e2e/.auth/inject-tokens.json)

# 3. Run
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test e2e/jobs/cardinality-final.spec.ts \
  --project=chromium --reporter=line

# 4. Open the HTML report (auto-opens failures)
npx playwright show-report
```

For one-off debugging:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test e2e/jobs/cardinality-final.spec.ts -g "CARD-1" \
  --project=chromium --headed --debug
```

---

## 5. Open questions / decisions for you

1. **Should the wizard's "Create Job" button ALSO submit even when 2nd dest in 1:N has incomplete config?** Currently it submits with whatever pipeline steps are fully configured and silently drops the rest. CARD-2 in the spec proves this: 2nd destination's category/provider are set but no entity/table picked → the wizard submits a 1-step payload. Acceptable, or do we want to surface "destination 2 incomplete — fix or remove"?
2. **The `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions elsewhere** — there are several across the jobs/files/dq modules. The one fixed here was load-bearing. Worth a half-hour audit.
3. **Auto-map AI button is hidden when more than 1 pair** (per `mapping-panel.tsx:71`). Confirm that's intentional — multi-pair jobs currently force users to manually map every pair, which is a lot of clicks. The user feedback might be to allow per-pair Auto-map.

— Kiran (+ Claude Opus 4.7)
