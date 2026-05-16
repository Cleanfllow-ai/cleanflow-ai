/**
 * Connector error-handling tests
 *
 * Covers mapConnectorErrorToToast() for all 7 failure modes × 4 providers.
 * Mode 1 (transparent refresh) is tested as a silent/info-level toast.
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

import { ApiError } from '@/modules/shared/api-error'
import {
  mapConnectorErrorToToast,
  ConnectorToast,
} from '@/modules/connectors/utils/connector-error-toast'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeApiError(opts: {
  status: number
  code: string
  action?: string | null
  provider?: string
  message?: string
  raw?: unknown
}): ApiError {
  return new ApiError({
    status: opts.status,
    message: opts.message ?? 'error',
    code: opts.code,
    action: (opts.action as any) ?? null,
    provider: opts.provider ?? null,
    raw: opts.raw ?? null,
  })
}

const PROVIDERS = ['quickbooks', 'zohobooks', 'snowflake', 'googledrive'] as const
type Provider = (typeof PROVIDERS)[number]

const PROVIDER_LABELS: Record<Provider, string> = {
  quickbooks: 'QuickBooks',
  zohobooks: 'Zoho Books',
  snowflake: 'Snowflake',
  googledrive: 'Google Drive',
}

// ─── Mode 1: transparent access-token refresh ───────────────────────────────

describe('Mode 1 — transparent token refresh (ConnectionExpiredError)', () => {
  PROVIDERS.forEach((provider) => {
    it(`${provider}: returns info toast (no action button)`, () => {
      const err = makeApiError({
        status: 401,
        code: 'ConnectionExpiredError',
        action: 'reconnect',
        provider,
      })
      const toast = mapConnectorErrorToToast(err)
      expect(toast.severity).toBe('info')
      expect(toast.actionLabel).toBeNull()
      expect(toast.action).toBeNull()
      expect(toast.toastId).toContain(provider)
    })
  })
})

// ─── Mode 2: CONNECTOR_REAUTH_REQUIRED ──────────────────────────────────────

describe('Mode 2 — CONNECTOR_REAUTH_REQUIRED (refresh token expired)', () => {
  PROVIDERS.forEach((provider) => {
    it(`${provider}: shows Reconnect button with provider name`, () => {
      const err = makeApiError({
        status: 401,
        code: 'CONNECTOR_REAUTH_REQUIRED',
        action: 'reconnect',
        provider,
        message: 'refresh token expired',
      })
      const toast = mapConnectorErrorToToast(err)
      expect(toast.message).toMatch(/Reconnect/i)
      expect(toast.message).toContain(PROVIDER_LABELS[provider])
      expect(toast.action).toBe('reconnect')
      expect(toast.actionLabel).toBe('Reconnect')
      expect(toast.severity).toBe('error')
      expect(toast.toastId).toBe(
        `connector-${provider}-connector-reauth-required`,
      )
    })
  })

  it('happy path: no error thrown by mapConnectorErrorToToast', () => {
    // No error → component would never call mapConnectorErrorToToast
    // Just verify the function doesn't throw on a non-error value
    expect(() => mapConnectorErrorToToast(null, 'quickbooks')).not.toThrow()
  })
})

// ─── Mode 3: CONNECTOR_RATE_LIMITED ─────────────────────────────────────────

describe('Mode 3 — CONNECTOR_RATE_LIMITED (429)', () => {
  PROVIDERS.forEach((provider) => {
    it(`${provider}: shows busy toast with retry_after_seconds`, () => {
      const err = makeApiError({
        status: 429,
        code: 'CONNECTOR_RATE_LIMITED',
        action: 'retry',
        provider,
        raw: { retry_after_seconds: 30 },
      })
      const toast = mapConnectorErrorToToast(err)
      expect(toast.message).toContain(PROVIDER_LABELS[provider])
      expect(toast.message).toContain('busy')
      expect(toast.message).toContain('30s')
      expect(toast.action).toBe('retry')
      expect(toast.actionLabel).toBe('Retry')
      expect(toast.retryAfterSeconds).toBe(30)
      expect(toast.severity).toBe('warning')
    })
  })

  it('legacy RateLimitError code maps to retry toast', () => {
    const err = makeApiError({
      status: 429,
      code: 'RateLimitError',
      action: 'retry',
      provider: 'quickbooks',
    })
    const toast = mapConnectorErrorToToast(err)
    expect(toast.action).toBe('retry')
    expect(toast.toastId).toContain('ratelimiterror')
  })
})

// ─── Mode 4: CONNECTOR_SCHEMA_DRIFT ─────────────────────────────────────────

describe('Mode 4 — CONNECTOR_SCHEMA_DRIFT (entity field renamed/removed)', () => {
  PROVIDERS.forEach((provider) => {
    it(`${provider}: shows "update mapping" toast`, () => {
      const err = makeApiError({
        status: 422,
        code: 'CONNECTOR_SCHEMA_DRIFT',
        action: 'open_mapping',
        provider,
        raw: { missing_fields: ['billing_address', 'currency_code'] },
      })
      const toast = mapConnectorErrorToToast(err)
      expect(toast.message).toContain(PROVIDER_LABELS[provider])
      expect(toast.message).toMatch(/changed.*format|update.*mapping/i)
      expect(toast.action).toBe('open_mapping')
      expect(toast.actionLabel).toBe('Open Mapping')
      expect(toast.severity).toBe('error')
      expect(toast.toastId).toBe(
        `connector-${provider}-connector-schema-drift`,
      )
    })
  })
})

// ─── Mode 5: CONNECTOR_TIMEOUT ───────────────────────────────────────────────

describe('Mode 5 — CONNECTOR_TIMEOUT (network timeout)', () => {
  PROVIDERS.forEach((provider) => {
    it(`${provider}: shows timeout toast with Retry button`, () => {
      const err = makeApiError({
        status: 504,
        code: 'CONNECTOR_TIMEOUT',
        action: 'retry',
        provider,
      })
      const toast = mapConnectorErrorToToast(err)
      expect(toast.message).toContain(PROVIDER_LABELS[provider])
      expect(toast.message).toMatch(/too long|timed? out/i)
      expect(toast.action).toBe('retry')
      expect(toast.actionLabel).toBe('Retry')
      expect(toast.severity).toBe('warning')
      expect(toast.toastId).toBe(
        `connector-${provider}-connector-timeout`,
      )
    })
  })

  it('browser AbortError (non-ApiError) maps to timeout toast', () => {
    const abortErr = new DOMException('The user aborted a request.', 'AbortError')
    const toast = mapConnectorErrorToToast(abortErr, 'quickbooks')
    expect(toast.message).toMatch(/too long/i)
    expect(toast.action).toBe('retry')
    expect(toast.toastId).toContain('connector-timeout')
  })
})

// ─── Mode 6: CONNECTOR_SERVER_ERROR (5xx) ───────────────────────────────────

describe('Mode 6 — CONNECTOR_SERVER_ERROR (provider 5xx)', () => {
  PROVIDERS.forEach((provider) => {
    it(`${provider}: shows "try again later" toast`, () => {
      const err = makeApiError({
        status: 502,
        code: 'CONNECTOR_SERVER_ERROR',
        action: 'retry',
        provider,
      })
      const toast = mapConnectorErrorToToast(err)
      expect(toast.message).toContain(PROVIDER_LABELS[provider])
      expect(toast.message).toMatch(/error|try again/i)
      expect(toast.action).toBe('retry')
      expect(toast.actionLabel).toBe('Retry')
      expect(toast.severity).toBe('error')
    })
  })

  it('legacy ProviderAPIError code maps to server-error toast', () => {
    const err = makeApiError({
      status: 502,
      code: 'ProviderAPIError',
      action: 'retry',
      provider: 'zohobooks',
    })
    const toast = mapConnectorErrorToToast(err)
    expect(toast.action).toBe('retry')
    expect(toast.toastId).toContain('providerapierror')
  })
})

// ─── Mode 7: CONNECTOR_ENV_MISMATCH ─────────────────────────────────────────

describe('Mode 7 — CONNECTOR_ENV_MISMATCH (sandbox vs production)', () => {
  PROVIDERS.forEach((provider) => {
    it(`${provider}: shows env mismatch toast with expected/actual`, () => {
      // The backend serialises `expected` and `actual` as top-level payload fields.
      // The FE ApiError constructor stores the whole payload in `raw`.
      const err = makeApiError({
        status: 400,
        code: 'CONNECTOR_ENV_MISMATCH',
        action: 'reconnect',
        provider,
        // raw mirrors the full backend error payload
        raw: {
          code: 'CONNECTOR_ENV_MISMATCH',
          action: 'reconnect',
          provider,
          error: 'env mismatch',
          expected: 'production',
          actual: 'sandbox',
        },
      })
      const toast = mapConnectorErrorToToast(err)
      expect(toast.message).toContain('production')
      expect(toast.message).toContain('sandbox')
      expect(toast.action).toBe('reconnect')
      expect(toast.actionLabel).toBe('Reconnect')
      expect(toast.severity).toBe('error')
      expect(toast.toastId).toBe(
        `connector-${provider}-connector-env-mismatch`,
      )
    })
  })
})

// ─── Fallback ────────────────────────────────────────────────────────────────

describe('Fallback — unknown error codes', () => {
  it('unknown ApiError returns generic error toast', () => {
    const err = makeApiError({
      status: 400,
      code: 'SomeUnknownError',
      message: 'something broke',
      provider: 'quickbooks',
    })
    const toast = mapConnectorErrorToToast(err)
    expect(toast.severity).toBe('error')
    expect(toast.toastId).toContain('quickbooks')
  })

  it('non-ApiError unknown error returns generic toast', () => {
    const toast = mapConnectorErrorToToast(new Error('network failure'), 'snowflake')
    expect(toast.severity).toBe('error')
    expect(toast.message).toContain('network failure')
  })
})

// ─── Provider label interpolation ────────────────────────────────────────────

describe('Provider label interpolation', () => {
  it('uses friendly label in toast message', () => {
    const err = makeApiError({
      status: 401,
      code: 'CONNECTOR_REAUTH_REQUIRED',
      action: 'reconnect',
      provider: 'googledrive',
    })
    const toast = mapConnectorErrorToToast(err)
    expect(toast.message).toContain('Google Drive')
    expect(toast.message).not.toContain('googledrive')
  })

  it('handles unknown provider gracefully', () => {
    const err = makeApiError({
      status: 401,
      code: 'CONNECTOR_REAUTH_REQUIRED',
      action: 'reconnect',
      provider: 'myerp',
    })
    const toast = mapConnectorErrorToToast(err)
    expect(toast.message).toContain('Myerp')
  })
})
