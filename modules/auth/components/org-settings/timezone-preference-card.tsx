"use client";

import { useEffect, useState } from "react";
import { Clock, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatToUserTZ,
  getUserTimezone,
  setUserTimezone,
} from "@/shared/lib/utils";
import { TIMEZONE_GROUPS } from "@/shared/lib/timezones";

/**
 * User-level timezone preference. UI-only — value is persisted to
 * localStorage under `cleanflowai.timezone` and consumed by `formatToUserTZ`
 * (and the legacy `formatToIST` alias) at render time. No backend call.
 */
export function TimezonePreferenceCard() {
  // `null` until the client mounts — avoids SSR/CSR hydration mismatch
  // since localStorage and Intl.DateTimeFormat are browser-only.
  const [tz, setTz] = useState<string | null>(null);
  const [previewTick, setPreviewTick] = useState(0);

  useEffect(() => {
    setTz(getUserTimezone());
  }, []);

  // Refresh the preview clock once a minute so users see it ticking.
  useEffect(() => {
    const id = window.setInterval(() => setPreviewTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const handleChange = (value: string) => {
    setTz(value);
    setUserTimezone(value);
    toast.success(`Timezone updated to ${value}.`);
  };

  // Avoid rendering the controlled Select with `value=""` on the first paint —
  // shadcn's Select treats empty string as "no selection" and logs warnings.
  if (tz === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Display Preferences
          </CardTitle>
          <CardDescription>
            Loading your timezone preference&hellip;
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Display Preferences
        </CardTitle>
        <CardDescription>
          Choose the timezone used to render dates and times across the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong>Browser-only setting.</strong> Your timezone is detected
            from this device on each login and stored locally in this browser.
            Changing it here only affects this browser — sign in from another
            device and it&apos;ll use that device&apos;s timezone.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user-timezone">Timezone</Label>
            <Select value={tz} onValueChange={handleChange}>
              <SelectTrigger id="user-timezone" aria-label="Select timezone">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {TIMEZONE_GROUPS.map((group) => (
                  <SelectGroup key={group.region}>
                    <SelectLabel>{group.region}</SelectLabel>
                    {group.zones.map((z) => (
                      <SelectItem key={z.value} value={z.value}>
                        {z.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Current time preview</Label>
            <div
              key={previewTick}
              className="h-9 px-3 flex items-center rounded-md border bg-muted/40 font-mono text-sm"
            >
              {formatToUserTZ(new Date())}
            </div>
            <p className="text-xs text-muted-foreground">
              IANA zone:{" "}
              <span className="font-mono text-foreground">{tz}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
