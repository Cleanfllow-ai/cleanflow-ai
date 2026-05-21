"use client";

/**
 * useFilesStatePersistence
 * ────────────────────────
 * Bug #3 (P1, 2026-05-21): /files filter / sort / search / status state was
 * lost across navigation. The URL already mirrors `q=` / `status=` / `sort=` /
 * `dir=`, but a cold mount from a different page (Dashboard → /files via the
 * sidebar) has no query string — so the user lost their last filter every
 * time. This hook mirrors the URL state to `localStorage` and re-hydrates on
 * cold mount when the URL is empty.
 *
 * Contract
 * ────────
 *   - On every URL change (after hydration), persist `{q, status, sort, dir}`
 *     to `localStorage` under STORAGE_KEY.
 *   - On cold mount when *none* of `q/status/sort/dir` are present in the
 *     URL, read the persisted snapshot and replace the URL with it. We only
 *     hydrate if at least one persisted value is non-default so we don't
 *     pollute the back-stack with a no-op redirect.
 *   - This hook is purely a side-effect; it does not own the actual filter
 *     state (that still lives in `useFilesPage`). The page reads its initial
 *     values from `searchParams` already, so a URL replace before that read
 *     completes is what does the hydration.
 *
 * Why localStorage (not sessionStorage)
 * ─────────────────────────────────────
 * Power users want their filter to survive closing the tab and coming back
 * the next day. sessionStorage would lose state on tab close which defeats
 * the whole point of this bug fix.
 */

import { useEffect, useRef } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

const STORAGE_KEY = "cleanflowai.files.viewState";
const TRACKED_PARAMS = ["q", "status", "sort", "dir"] as const;

interface PersistedState {
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
}

function safeGetStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Storage access can throw in private/Lockdown modes — soft-fail rather
    // than crash the page over a UX nicety.
    return null;
  }
}

function readPersistedState(): PersistedState | null {
  const storage = safeGetStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Whitelist the four keys we own; ignore anything else a third party
    // might have stashed in this key (defence in depth).
    const out: PersistedState = {};
    for (const key of TRACKED_PARAMS) {
      const v = parsed[key];
      if (typeof v === "string" && v.length > 0) out[key] = v;
    }
    return out;
  } catch {
    return null;
  }
}

function writePersistedState(state: PersistedState) {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // QuotaExceeded etc. — soft-fail.
  }
}

export function useFilesStatePersistence() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hydratedRef = useRef(false);

  // ── 1. Cold-mount hydration ──────────────────────────────────────
  // Only runs once. If the URL already carries any tracked param, treat the
  // URL as the source of truth (we'd rather respect a deep-link a teammate
  // shared than silently overwrite it with the local user's last view).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const hasUrlState = TRACKED_PARAMS.some((k) => searchParams.get(k));
    if (hasUrlState) return;

    const persisted = readPersistedState();
    if (!persisted) return;

    const next = new URLSearchParams();
    let writeCount = 0;
    for (const key of TRACKED_PARAMS) {
      const v = persisted[key];
      if (v) {
        next.set(key, v);
        writeCount += 1;
      }
    }
    if (writeCount === 0) return;
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // ── 2. Write-through ─────────────────────────────────────────────
  // After hydration, every URL change persists the latest snapshot. Skip
  // the very first render so we don't immediately overwrite localStorage
  // with an empty snapshot before the URL has had a chance to populate.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const snapshot: PersistedState = {};
    for (const key of TRACKED_PARAMS) {
      const v = searchParams.get(key);
      if (v) snapshot[key] = v;
    }
    writePersistedState(snapshot);
  }, [searchParams]);
}
