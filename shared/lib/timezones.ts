/**
 * Curated list of IANA timezones grouped by region for the user-preference
 * dropdown in the Admin → Organization tab. Intentionally small (~20 zones)
 * — we don't dump the full IANA tz database. Add more as customer demand
 * arrives; do NOT introduce a runtime dependency for this.
 */

export interface TimezoneOption {
  /** IANA name persisted to localStorage (e.g. "Asia/Kolkata"). */
  value: string;
  /** Human label shown in the dropdown. */
  label: string;
}

export interface TimezoneGroup {
  region: string;
  zones: TimezoneOption[];
}

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    region: "UTC",
    zones: [{ value: "UTC", label: "UTC (Coordinated Universal Time)" }],
  },
  {
    region: "Asia",
    zones: [
      { value: "Asia/Kolkata", label: "India Standard Time (Kolkata)" },
      { value: "Asia/Dubai", label: "Gulf Standard Time (Dubai)" },
      { value: "Asia/Singapore", label: "Singapore Time" },
      { value: "Asia/Tokyo", label: "Japan Standard Time (Tokyo)" },
      { value: "Asia/Shanghai", label: "China Standard Time (Shanghai)" },
    ],
  },
  {
    region: "Europe",
    zones: [
      { value: "Europe/London", label: "United Kingdom (London)" },
      { value: "Europe/Berlin", label: "Central European Time (Berlin)" },
      { value: "Europe/Paris", label: "Central European Time (Paris)" },
      { value: "Europe/Madrid", label: "Central European Time (Madrid)" },
      { value: "Europe/Moscow", label: "Moscow Standard Time" },
    ],
  },
  {
    region: "Americas",
    zones: [
      { value: "America/New_York", label: "Eastern Time (New York)" },
      { value: "America/Chicago", label: "Central Time (Chicago)" },
      { value: "America/Denver", label: "Mountain Time (Denver)" },
      { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
      { value: "America/Toronto", label: "Eastern Time (Toronto)" },
      { value: "America/Sao_Paulo", label: "Brasília Time (São Paulo)" },
    ],
  },
  {
    region: "Oceania",
    zones: [
      { value: "Australia/Sydney", label: "Australian Eastern Time (Sydney)" },
      { value: "Australia/Perth", label: "Australian Western Time (Perth)" },
      { value: "Pacific/Auckland", label: "New Zealand Time (Auckland)" },
    ],
  },
];

/** Flattened list of all curated zones (handy for validation). */
export const ALL_TIMEZONES: TimezoneOption[] = TIMEZONE_GROUPS.flatMap(
  (g) => g.zones,
);
