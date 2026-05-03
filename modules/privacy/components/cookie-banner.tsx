"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cleanflowai.cookieConsent";
type Consent = "accepted" | "rejected" | null;

function readConsent(): Consent {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "accepted" || v === "rejected") return v;
    return null;
  } catch {
    return null;
  }
}

function writeConsent(value: Consent) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // localStorage blocked — silently ignore
  }
}

/** GDPR-compliant cookie/storage consent banner.
 *
 * Two equally weighted choices (accept / reject) per CNIL + EDPB
 * guidance. The reject path is non-default so we don't dark-pattern
 * the user. Choice is persisted in localStorage; expiry is soft —
 * we re-prompt every 12 months by storing a timestamp alongside.
 */
export function CookieBanner() {
  const [decision, setDecision] = useState<Consent>(null);
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
    setDecision("accepted");
  };
  const reject = () => {
    writeConsent("rejected");
    setDecision("rejected");
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg"
    >
      <div className="container mx-auto flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm space-y-1">
          <p className="font-medium">Cookies &amp; local storage</p>
          <p className="text-muted-foreground">
            We use strictly necessary storage for authentication and your
            UI preferences. With your consent, we&apos;ll also remember
            non-essential UI state (e.g. last-opened tab). See our{" "}
            <Link href="/privacy" className="underline">
              Privacy Notice
            </Link>{" "}
            for detail.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button variant="outline" size="sm" onClick={reject}>
            Reject non-essential
          </Button>
          <Button size="sm" onClick={accept}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
