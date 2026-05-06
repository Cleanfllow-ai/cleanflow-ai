"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
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
          This is a personal preference stored in your browser only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user-timezone">Timezone</Label>
            <Select value={tz} onValueChange={handleChange}>
              <SelectTrigger id="user-timezone">
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
