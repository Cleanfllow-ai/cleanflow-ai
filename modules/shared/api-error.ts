/**
 * Typed API error model for cleanflowai backend responses.
 *
 * The backend now returns structured error envelopes:
 *   { "error": "Google Drive session expired",
 *     "code":  "ConnectionExpiredError",
 *     "provider": "googledrive",
 *     "action": "reconnect" }
 *
 * `ApiError` preserves these fields so the UI can render actionable toasts
 * (Reconnect button, Sign-in button, validation hints, …) instead of a flat
 * "HTTP 401" string.
 */

export type ApiErrorAction =
    | "reconnect"
    | "connect"
    | "retry"
    | "signin"
    | "open_mapping"
    | "request_new_invite"
    | "cancel"
    | null

export interface ApiErrorOpts {
    status: number
    message: string
    code?: string | null
    action?: ApiErrorAction
    provider?: string | null
    fields?: Record<string, string> | null
    raw?: unknown
}

export class ApiError extends Error {
    public readonly status: number
    public readonly code: string | null
    public readonly action: ApiErrorAction
    public readonly provider: string | null
    public readonly fields: Record<string, string> | null
    public readonly raw: unknown

    constructor(opts: ApiErrorOpts) {
        super(opts.message)
        this.name = "ApiError"
        this.status = opts.status
        this.code = opts.code ?? null
        this.action = opts.action ?? null
        this.provider = opts.provider ?? null
        this.fields = opts.fields ?? null
        this.raw = opts.raw

        // Restore prototype chain for `instanceof` to work after transpile
        Object.setPrototypeOf(this, ApiError.prototype)
    }
}

/**
 * Type-narrowing helper that callers can use to branch on `ApiError`
 * without dealing with the `unknown` plumbing.
 */
export function isApiError(err: unknown): err is ApiError {
    return err instanceof ApiError
}

/**
 * Build an `ApiError` from a `fetch` `Response` and its parsed JSON body.
 *
 * Rules:
 *   - message       = body.error || body.message || `HTTP <status>`
 *   - code          = body.code (else null)
 *   - action        = body.action (else inferred for 401/no code → "signin")
 *   - provider      = body.provider (else null)
 *   - fields        = body.fields (validation map, else null)
 *
 * If the backend already supplies an explicit `action` we trust it (e.g.
 * 401 + ConnectionExpiredError → "reconnect"); we only fall back to
 * "signin" when the response is 401 *and* the backend didn't tag the
 * error with any code/action at all.
 */
export function parseApiError(response: Response, body: unknown): ApiError {
    const safeBody: Record<string, unknown> =
        body && typeof body === "object" && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : {}

    const fallback =
        typeof body === "string" && body.length > 0
            ? body
            : `HTTP ${response.status}`

    const message =
        (typeof safeBody.error === "string" && safeBody.error) ||
        (typeof safeBody.message === "string" && safeBody.message) ||
        fallback

    const code =
        typeof safeBody.code === "string" && safeBody.code.length > 0
            ? safeBody.code
            : null

    const provider =
        typeof safeBody.provider === "string" && safeBody.provider.length > 0
            ? safeBody.provider
            : null

    const fields =
        safeBody.fields &&
        typeof safeBody.fields === "object" &&
        !Array.isArray(safeBody.fields)
            ? Object.fromEntries(
                  Object.entries(safeBody.fields as Record<string, unknown>).map(
                      ([k, v]) => [k, typeof v === "string" ? v : String(v)]
                  )
              )
            : null

    let action: ApiErrorAction = null
    const rawAction = safeBody.action
    if (
        rawAction === "reconnect" ||
        rawAction === "connect" ||
        rawAction === "retry" ||
        rawAction === "signin" ||
        rawAction === "open_mapping" ||
        rawAction === "request_new_invite" ||
        rawAction === "cancel"
    ) {
        action = rawAction
    } else if (response.status === 401 && code === null) {
        // 401 with no explicit code/action → treat as "session expired, sign in"
        action = "signin"
    }

    return new ApiError({
        status: response.status,
        message,
        code,
        action,
        provider,
        fields,
        raw: body,
    })
}
