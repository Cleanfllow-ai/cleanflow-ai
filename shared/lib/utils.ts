import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * localStorage key for the user's chosen IANA timezone.
 * UI-only: not synced to the backend.
 */
export const TIMEZONE_STORAGE_KEY = "cleanflowai.timezone";

/**
 * Flag indicating the user manually picked a timezone in the UI.
 * When set, refreshTimezoneOnLogin() will NOT clobber it with the browser's
 * detected zone — respects the user's explicit choice (e.g., they're
 * physically in India but want to see NYC time for a US-team workflow).
 */
export const TIMEZONE_MANUAL_FLAG_KEY = "cleanflowai.timezone.manual";

/** Default fallback when no preference is stored and the browser API is unavailable (SSR). */
const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Detect the browser's current IANA timezone from the OS via Intl.
 * No permissions, no GPS, no network calls — just reads what the OS reports.
 */
export function detectBrowserTimezone(): string {
  if (typeof window === "undefined") return DEFAULT_TIMEZONE;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Read the user's preferred IANA timezone from localStorage. If nothing is
 * stored yet, detect the browser's zone via Intl, persist it, and return it.
 * Returns DEFAULT_TIMEZONE during SSR (no `window`).
 */
export function getUserTimezone(): string {
  if (typeof window === "undefined") return DEFAULT_TIMEZONE;
  try {
    const stored = window.localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored && stored.trim().length > 0) return stored;
    const detected = detectBrowserTimezone();
    try {
      window.localStorage.setItem(TIMEZONE_STORAGE_KEY, detected);
    } catch {
      /* localStorage may be unavailable (private mode, quota) — use detected anyway */
    }
    return detected;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Persist the user's preferred IANA timezone AND mark it as manually chosen.
 * Subsequent refreshTimezoneOnLogin() calls will respect this and not clobber.
 * No-op on SSR.
 */
export function setUserTimezone(tz: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
    window.localStorage.setItem(TIMEZONE_MANUAL_FLAG_KEY, "true");
  } catch {
    /* ignore */
  }
}

/**
 * Re-detect the browser timezone and update the stored preference IF the user
 * has not manually overridden it. Called from the post-login flow so a user
 * who travels (e.g., India → US) sees times rendered in their new local zone
 * on next login, without needing to visit the settings page.
 *
 * Returns the timezone now in effect after the refresh.
 */
export function refreshTimezoneOnLogin(): string {
  if (typeof window === "undefined") return DEFAULT_TIMEZONE;
  try {
    const manual = window.localStorage.getItem(TIMEZONE_MANUAL_FLAG_KEY);
    if (manual === "true") {
      // User picked one explicitly — respect it.
      return getUserTimezone();
    }
    const detected = detectBrowserTimezone();
    try {
      window.localStorage.setItem(TIMEZONE_STORAGE_KEY, detected);
    } catch {
      /* ignore */
    }
    return detected;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Format an ISO date string (or Date) in the user's preferred IANA timezone.
 * Falls back to Asia/Kolkata if no preference is stored.
 *
 * - `opts.dateOnly === true` → "DD MMM YYYY"
 * - otherwise → "DD MMM YYYY, hh:mm AM/PM"
 *
 * Bare timestamps without an explicit zone are treated as UTC (mirrors the
 * legacy `formatToIST` behaviour the rest of the app relied on).
 */
export function formatToUserTZ(
  value: string | Date | undefined | null,
  opts?: { dateOnly?: boolean },
): string {
  if (value === undefined || value === null) return "N/A";
  try {
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else {
      const trimmed = value.trim();
      if (!trimmed) return "N/A";
      const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
      const normalized = hasZone ? trimmed : `${trimmed}Z`;
      date = new Date(normalized);
    }
    if (Number.isNaN(date.getTime())) {
      return typeof value === "string" ? value : "N/A";
    }

    const tz = getUserTimezone();
    const baseOpts: Intl.DateTimeFormatOptions = {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      year: "numeric",
    };
    if (!opts?.dateOnly) {
      baseOpts.hour = "2-digit";
      baseOpts.minute = "2-digit";
      baseOpts.hour12 = true;
    }
    return new Intl.DateTimeFormat("en-IN", baseOpts).format(date);
  } catch {
    return typeof value === "string" ? value : "N/A";
  }
}

/**
 * @deprecated Use `formatToUserTZ` instead. This is now a thin alias that
 * honours the user's localStorage timezone preference (falling back to
 * Asia/Kolkata when nothing is stored). Kept for backwards compatibility
 * with the many existing call sites.
 */
export function formatToIST(dateString: string | undefined | null) {
  return formatToUserTZ(dateString);
}
