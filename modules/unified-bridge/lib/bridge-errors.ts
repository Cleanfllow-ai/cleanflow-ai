/**
 * Centralized error + payload helpers for unified-bridge ingestion forms.
 *
 * Purpose:
 *   - Classify ingest failures (auth, timeout, DNS, blocked-host, partial,
 *     too-large, unsupported-type, 5xx) into user-friendly strings instead of
 *     leaking raw "FTP ingestion failed: Forbidden" messages.
 *   - Provide a redactor for any payload we might log so secrets
 *     (password, private_key, token, secret_key, api_key, cookie,
 *     client_secret, key_passphrase) never reach console / Sentry / logs.
 *   - Provide an `ingestWithTimeout` helper so a hung BE never leaves
 *     "Ingesting..." spinning forever.
 *
 * No network calls and no React imports here — pure utility module.
 */

export type ClassifiedErrorKind =
  | "auth"          // 401 / 403 / bad creds
  | "timeout"       // socket / HTTP timeout
  | "dns"           // unresolvable / blocked host
  | "blocked"       // private / internal address rejected
  | "not_found"     // 404 / FTP 550 / remote path missing
  | "partial"       // partial transfer
  | "too_large"     // file exceeds plan tier
  | "unsupported"   // file extension not supported
  | "validation"    // 400 bad request
  | "server"        // 5xx
  | "network"       // ECONNREFUSED, reset, generic connection
  | "unknown";

export interface ClassifiedError {
  kind: ClassifiedErrorKind;
  /** User-facing message — never leaks raw exception strings. */
  message: string;
  /** Original raw error message, retained for dev tooltips / Sentry tags. */
  raw: string;
}

const SECRET_KEYS = new Set([
  "password",
  "private_key",
  "key_passphrase",
  "token",
  "auth_token",
  "secret_key",
  "client_secret",
  "api_key",
  "cookie",
  "bearer_token",
  "ssh_private_key",
  "ssh_key",
  "client_key",
  "ca_cert",
  "authorization",
]);

/**
 * Recursively strip secret-bearing fields from any value safe for logging.
 * Replaces the value with the literal string "[redacted]" so the shape is
 * preserved (helpful when sending sanitized payloads to error reporting).
 */
export function redactSecrets<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k.toLowerCase())) {
        out[k] = v ? "[redacted]" : v;
      } else if (typeof v === "object" && v !== null) {
        out[k] = redactSecrets(v);
      } else {
        out[k] = v;
      }
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Classify an ingest error from `fileManagementAPI.*` (or any fetch wrapper
 * that throws Error with a message containing the BE's `error` field).
 *
 * Pattern: we never trust the user to read the raw exception. We surface
 * actionable copy ("Authentication failed — check username/password") and
 * stash the original under `.raw` for dev tooling.
 */
export function classifyIngestError(err: unknown): ClassifiedError {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unknown error";
  const lower = raw.toLowerCase();

  // Order matters — most specific matches first.
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("authentication failed") ||
    lower.includes("auth failed") ||
    lower.includes("invalid credentials")
  ) {
    return {
      kind: "auth",
      message:
        "Authentication failed — check your username, password, token, or key.",
      raw,
    };
  }
  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("etimedout")
  ) {
    return {
      kind: "timeout",
      message:
        "Connection timed out. The remote server didn't respond in time — check the host/port or try again.",
      raw,
    };
  }
  if (
    lower.includes("cannot resolve hostname") ||
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("no addresses resolved")
  ) {
    return {
      kind: "dns",
      message:
        "Cannot resolve hostname. Check that the host is spelled correctly and is reachable from the public internet.",
      raw,
    };
  }
  if (
    lower.includes("private/internal") ||
    lower.includes("blocked address") ||
    lower.includes("blocked network") ||
    lower.includes("blockedhost")
  ) {
    return {
      kind: "blocked",
      message:
        "Cannot connect to private or internal addresses (security policy). Use a publicly reachable host.",
      raw,
    };
  }
  if (
    lower.includes("not found") ||
    lower.includes("not accessible") ||
    lower.includes("550") ||
    lower.includes("no such file")
  ) {
    return {
      kind: "not_found",
      message:
        "Remote file not found or permission denied. Verify the remote path exists and the account has read access.",
      raw,
    };
  }
  if (
    lower.includes("partial") ||
    lower.includes("transfer aborted") ||
    lower.includes("transfer truncated") ||
    lower.includes("interrupted at")
  ) {
    return {
      kind: "partial",
      message:
        "Transfer was interrupted mid-stream. Some bytes arrived but the file is incomplete — please retry.",
      raw,
    };
  }
  if (
    lower.includes("exceeds") &&
    (lower.includes("plan limit") || lower.includes("mb"))
  ) {
    return {
      kind: "too_large",
      message:
        "File exceeds your plan's size limit. Upgrade your plan or split the file before ingesting.",
      raw,
    };
  }
  if (
    lower.includes("not supported") ||
    lower.includes("file type") ||
    lower.includes("unsupported")
  ) {
    return {
      kind: "unsupported",
      message: "File type not supported. Use CSV, Excel (.xlsx/.xls), or JSON.",
      raw,
    };
  }
  if (
    lower.includes("400") ||
    lower.includes("bad request") ||
    lower.includes("invalid") ||
    lower.includes("required")
  ) {
    return {
      kind: "validation",
      message: raw, // 400 messages from BE are already user-readable
      raw,
    };
  }
  if (
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504") ||
    lower.includes("internal server error")
  ) {
    return {
      kind: "server",
      message:
        "The server hit an unexpected error. Please retry in a moment — if it persists, contact support.",
      raw,
    };
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("connection")
  ) {
    return {
      kind: "network",
      message:
        "Network error reaching the server. Check connectivity and try again.",
      raw,
    };
  }
  return {
    kind: "unknown",
    message: raw || "Ingestion failed for an unknown reason.",
    raw,
  };
}

/**
 * Wrap an async ingest call with a client-side timeout so a hung BE never
 * leaves the UI spinning forever.
 *
 * On timeout, throws an Error tagged "timeout" that `classifyIngestError`
 * will recognise.
 */
export async function withClientTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(ms / 1000)}s (client-side cap)`,
        ),
      );
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Hostname validation. Accepts: DNS hostnames, IPv4 literals, IPv6 in brackets. */
export function isValidHost(host: string): boolean {
  if (!host || host.length > 253) return false;
  const trimmed = host.trim();
  if (!trimmed) return false;
  // IPv6 in brackets
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return true;
  // IPv4
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(trimmed)) {
    return trimmed.split(".").every((o) => {
      const n = Number(o);
      return n >= 0 && n <= 255;
    });
  }
  // DNS hostname: labels of [a-z0-9-], not starting/ending with hyphen, max 63 chars
  const hostnameRegex =
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(trimmed);
}

/** Port validation: integer in [1, 65535]. */
export function isValidPort(port: number | string): boolean {
  const n = typeof port === "string" ? Number(port) : port;
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}
