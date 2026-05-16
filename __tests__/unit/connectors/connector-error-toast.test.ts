/**
 * Unit tests for modules/connectors/utils/connector-error-toast.ts
 * :: mapConnectorErrorToToast
 *
 * Covers all 7 error modes + fallback:
 *   Mode 1 — Non-ApiError / network failure
 *   Mode 1b — AbortError → timeout toast
 *   Mode 2 — CONNECTOR_REAUTH_REQUIRED / action="reconnect"
 *   Mode 3 — CONNECTOR_RATE_LIMITED / 429
 *   Mode 4 — CONNECTOR_SCHEMA_DRIFT
 *   Mode 5 — CONNECTOR_TIMEOUT / 504
 *   Mode 6 — CONNECTOR_SERVER_ERROR / 5xx
 *   Mode 7 — CONNECTOR_ENV_MISMATCH
 *   Fallback — unknown ApiError
 *
 * Verifies stable dedup IDs: connector-<provider>-<code-slug>
 */

import { mapConnectorErrorToToast } from "@/modules/connectors/utils/connector-error-toast"
import { ApiError } from "@/modules/shared/api-error"

function apiErr(
  status: number,
  message: string,
  opts: { code?: string; action?: string; provider?: string; raw?: unknown } = {},
): ApiError {
  return new ApiError({
    status,
    message,
    code: opts.code ?? null,
    action: (opts.action ?? null) as never,
    provider: opts.provider ?? null,
    raw: opts.raw ?? null,
  })
}

// ── Mode 1: non-ApiError ──────────────────────────────────────────────────────

describe("Mode 1 — non-ApiError", () => {
  it("plain Error maps to generic error toast without action", () => {
    const result = mapConnectorErrorToToast(new Error("something broke"))
    expect(result.severity).toBe("error")
    expect(result.action).toBeNull()
    expect(result.message).toBe("something broke")
    expect(result.toastId).toBe("connector-unknown-error")
  })

  it("AbortError maps to TIMEOUT toast with retry action", () => {
    const err = new DOMException("The operation was aborted", "AbortError")
    const result = mapConnectorErrorToToast(err, "quickbooks")
    expect(result.severity).toBe("warning")
    expect(result.action).toBe("retry")
    expect(result.message).toMatch(/QuickBooks/)
    expect(result.toastId).toBe("connector-quickbooks-connector-timeout")
  })
})

// ── Mode 2: CONNECTOR_REAUTH_REQUIRED ────────────────────────────────────────

describe("Mode 2 — CONNECTOR_REAUTH_REQUIRED", () => {
  it("CONNECTOR_REAUTH_REQUIRED code → reconnect toast", () => {
    const result = mapConnectorErrorToToast(
      apiErr(401, "refresh expired", { code: "CONNECTOR_REAUTH_REQUIRED", provider: "zohobooks" }),
    )
    expect(result.action).toBe("reconnect")
    expect(result.actionLabel).toBe("Reconnect")
    expect(result.message).toMatch(/Zoho Books/)
    expect(result.toastId).toBe("connector-zohobooks-connector-reauth-required")
    expect(result.severity).toBe("error")
  })

  it("action=reconnect without specific code also triggers Mode 2", () => {
    const result = mapConnectorErrorToToast(
      apiErr(401, "session gone", { action: "reconnect", provider: "quickbooks" }),
    )
    expect(result.action).toBe("reconnect")
    expect(result.message).toMatch(/QuickBooks/)
  })

  it("ConnectionExpiredError (silent refresh) → info toast with no action", () => {
    const result = mapConnectorErrorToToast(
      apiErr(401, "expired", { code: "ConnectionExpiredError", action: "reconnect", provider: "googledrive" }),
    )
    expect(result.severity).toBe("info")
    expect(result.action).toBeNull()
    expect(result.toastId).toBe("connector-googledrive-connection-expired-error")
  })
})

// ── Mode 3: CONNECTOR_RATE_LIMITED ───────────────────────────────────────────

describe("Mode 3 — CONNECTOR_RATE_LIMITED", () => {
  it("CONNECTOR_RATE_LIMITED → warning toast with retry", () => {
    const result = mapConnectorErrorToToast(
      apiErr(429, "too many requests", { code: "CONNECTOR_RATE_LIMITED", provider: "snowflake" }),
    )
    expect(result.severity).toBe("warning")
    expect(result.action).toBe("retry")
    expect(result.message).toMatch(/Snowflake/)
    expect(result.toastId).toBe("connector-snowflake-connector-rate-limited")
  })

  it("HTTP 429 without code still triggers rate-limit toast", () => {
    const result = mapConnectorErrorToToast(
      apiErr(429, "slow down", { provider: "quickbooks" }),
    )
    expect(result.severity).toBe("warning")
    expect(result.retryAfterSeconds).toBeNull()
  })

  it("retry_after_seconds from raw is surfaced in countdown message", () => {
    const result = mapConnectorErrorToToast(
      apiErr(429, "too fast", {
        code: "CONNECTOR_RATE_LIMITED",
        provider: "zohobooks",
        raw: { retry_after_seconds: 30 },
      }),
    )
    expect(result.retryAfterSeconds).toBe(30)
    expect(result.message).toContain("30s")
  })
})

// ── Mode 4: CONNECTOR_SCHEMA_DRIFT ───────────────────────────────────────────

describe("Mode 4 — CONNECTOR_SCHEMA_DRIFT", () => {
  it("maps to open_mapping action toast", () => {
    const result = mapConnectorErrorToToast(
      apiErr(422, "field renamed", { code: "CONNECTOR_SCHEMA_DRIFT", provider: "quickbooks" }),
    )
    expect(result.action).toBe("open_mapping")
    expect(result.actionLabel).toBe("Open Mapping")
    expect(result.severity).toBe("error")
    expect(result.toastId).toBe("connector-quickbooks-connector-schema-drift")
  })
})

// ── Mode 5: CONNECTOR_TIMEOUT ─────────────────────────────────────────────────

describe("Mode 5 — CONNECTOR_TIMEOUT", () => {
  it("CONNECTOR_TIMEOUT code → retry toast", () => {
    const result = mapConnectorErrorToToast(
      apiErr(504, "gateway timeout", { code: "CONNECTOR_TIMEOUT", provider: "snowflake" }),
    )
    expect(result.action).toBe("retry")
    expect(result.severity).toBe("warning")
    expect(result.toastId).toBe("connector-snowflake-connector-timeout")
  })

  it("HTTP 504 without code also triggers timeout toast", () => {
    const result = mapConnectorErrorToToast(
      apiErr(504, "timed out", { provider: "quickbooks" }),
    )
    expect(result.action).toBe("retry")
  })
})

// ── Mode 6: CONNECTOR_SERVER_ERROR ───────────────────────────────────────────

describe("Mode 6 — CONNECTOR_SERVER_ERROR", () => {
  it("CONNECTOR_SERVER_ERROR code → retry toast", () => {
    const result = mapConnectorErrorToToast(
      apiErr(500, "upstream error", { code: "CONNECTOR_SERVER_ERROR", provider: "zohobooks" }),
    )
    expect(result.action).toBe("retry")
    expect(result.severity).toBe("error")
    expect(result.toastId).toBe("connector-zohobooks-connector-server-error")
  })

  it("HTTP 502 without code triggers server-error toast", () => {
    const result = mapConnectorErrorToToast(
      apiErr(502, "bad gateway", { provider: "quickbooks" }),
    )
    expect(result.action).toBe("retry")
    expect(result.severity).toBe("error")
  })

  it("legacy ProviderAPIError class code is handled", () => {
    const result = mapConnectorErrorToToast(
      apiErr(502, "provider error", { code: "ProviderAPIError", provider: "snowflake" }),
    )
    expect(result.action).toBe("retry")
  })
})

// ── Mode 7: CONNECTOR_ENV_MISMATCH ───────────────────────────────────────────

describe("Mode 7 — CONNECTOR_ENV_MISMATCH", () => {
  it("maps sandbox/production mismatch to reconnect with env details", () => {
    const result = mapConnectorErrorToToast(
      apiErr(400, "env mismatch", {
        code: "CONNECTOR_ENV_MISMATCH",
        provider: "quickbooks",
        raw: { expected: "production", actual: "sandbox" },
      }),
    )
    expect(result.action).toBe("reconnect")
    expect(result.message).toContain("production")
    expect(result.message).toContain("sandbox")
    expect(result.toastId).toBe("connector-quickbooks-connector-env-mismatch")
  })
})

// ── Stable dedup IDs ─────────────────────────────────────────────────────────

describe("stable dedup IDs", () => {
  it("toastId follows connector-<provider>-<code-slug> pattern", () => {
    const result = mapConnectorErrorToToast(
      apiErr(401, "expired", { code: "CONNECTOR_REAUTH_REQUIRED", provider: "zohobooks" }),
    )
    expect(result.toastId).toMatch(/^connector-[a-z]+-[a-z-]+$/)
  })

  it("unknown provider falls back to 'unknown' in toastId", () => {
    const result = mapConnectorErrorToToast(
      apiErr(500, "error", { code: "CONNECTOR_SERVER_ERROR" }),
    )
    expect(result.toastId).toBe("connector-unknown-connector-server-error")
  })
})

// ── Provider name formatting ─────────────────────────────────────────────────

describe("provider name formatting", () => {
  it("quickbooks displays as QuickBooks in message", () => {
    const result = mapConnectorErrorToToast(
      apiErr(401, "x", { code: "CONNECTOR_REAUTH_REQUIRED", provider: "quickbooks" }),
    )
    expect(result.message).toContain("QuickBooks")
  })

  it("googledrive displays as Google Drive", () => {
    const result = mapConnectorErrorToToast(
      apiErr(401, "x", { code: "CONNECTOR_REAUTH_REQUIRED", provider: "googledrive" }),
    )
    expect(result.message).toContain("Google Drive")
  })

  it("snowflake displays as Snowflake", () => {
    const result = mapConnectorErrorToToast(
      apiErr(401, "x", { code: "CONNECTOR_REAUTH_REQUIRED", provider: "snowflake" }),
    )
    expect(result.message).toContain("Snowflake")
  })
})
