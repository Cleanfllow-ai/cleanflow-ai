"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cleanflowai.cookieConsent";
/** Re-prompt cadence — 12 months per CNIL/EDPB guidance. */
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

type ConsentChoice = "accepted" | "rejected";
type StoredConsent = { value: ConsentChoice; ts: number } | null;

function readConsent(): StoredConsent {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Backwards-compat: the previous schema was a bare "accepted" / "rejected"
    // string. Treat it as a fresh decision (ts = now) so we don't re-prompt
    // users who already chose, but rotate it forward into the new shape on
    // next write.
    if (raw === "accepted" || raw === "rejected") {
      return { value: raw, ts: Date.now() };
    }
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed.value === "accepted" || parsed.value === "rejected") &&
      typeof parsed.ts === "number"
    ) {
      // Expired? Treat as if never decided so we re-prompt.
      if (Date.now() - parsed.ts > CONSENT_TTL_MS) return null;
      return { value: parsed.value, ts: parsed.ts };
    }
    return null;
  } catch {
    return null;
  }
}

function writeConsent(value: ConsentChoice) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ value, ts: Date.now() }),
    );
  } catch {
    // localStorage blocked (Safari private mode, quota) — silently ignore.
    // The banner will re-appear next session, which is acceptable degradation.
  }
}

/** GDPR-compliant cookie/storage consent banner.
 *
 * Two equally weighted choices (accept / reject) per CNIL + EDPB
 * guidance. The reject path is non-default so we don't dark-pattern
 * the user. Choice is persisted in localStorage with a timestamp and
 * we re-prompt every 12 months (CONSENT_TTL_MS).
 *
 * A11y: this is a non-blocking page region (NOT a modal dialog) so we
 * use role="region" with aria-label instead of role="dialog". Using
 * role="dialog" without focus trapping is an a11y anti-pattern and
 * causes screen-readers to announce the banner as modal when it isn't.
 */
export function CookieBanner() {
  const [decision, setDecision] = useState<StoredConsent>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDecision(readConsent());
    setHydrated(true);
  }, []);

  if (!hydrated || decision !== null) {
    return null;
  }

  const accept = () => {
    writeConsent("accepted");
    setDecision({ value: "accepted", ts: Date.now() });
  };
  const reject = () => {
    writeConsent("rejected");
    setDecision({ value: "rejected", ts: Date.now() });
  };

  return (
    <section
      role="region"
      aria-label="Cookie consent"
      data-testid="cookie-banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg"
    >
      <div className="container mx-auto flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm space-y-1">
          <p className="font-medium" id="cookie-banner-title">
            Cookies &amp; local storage
          </p>
          <p
            className="text-muted-foreground"
            id="cookie-banner-description"
          >
            We use strictly necessary storage for authentication and your
            UI preferences. With your consent, we&apos;ll also remember
            non-essential UI state (e.g. last-opened tab). See our{" "}
            <Link href="/privacy" className="underline">
              Privacy Notice
            </Link>{" "}
            for detail.
          </p>
        </div>
        <div
          className="flex items-center gap-2 self-end md:self-auto"
          role="group"
          aria-label="Cookie consent choices"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={reject}
            aria-label="Reject non-essential cookies"
          >
            Reject non-essential
          </Button>
          <Button
            size="sm"
            onClick={accept}
            aria-label="Accept all cookies"
          >
            Accept all
          </Button>
        </div>
      </div>
    </section>
  );
}
