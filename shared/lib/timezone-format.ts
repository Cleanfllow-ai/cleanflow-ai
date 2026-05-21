/**
 * timezone-format.ts
 *
 * Friendly short-label format for IANA timezone identifiers.
 *
 * Non-technical users don't recognise the IANA database id
 * (`Asia/Calcutta`, `America/Los_Angeles`) — they know the local
 * abbreviation + UTC offset. This helper renders both so the timeline
 * label is self-documenting.
 *
 * Example:
 *   formatTimezoneShort("Asia/Calcutta")        -> "IST · UTC+5:30"
 *   formatTimezoneShort("America/Los_Angeles")  -> "PST · UTC-08:00"
 *   formatTimezoneShort("Europe/London")        -> "GMT · UTC+00:00"
 *
 * Falls back to the raw IANA id on any error so we never crash the
 * Timeline header.
 */
export function formatTimezoneShort(iana: string | null | undefined): string {
  if (!iana) return ""
  try {
    const now = new Date()

    // Short timezone abbreviation (e.g. "IST", "PST", "GMT").
    // We pull this from the formatted parts rather than the locale
    // string so we get just the zone token.
    const shortName = (() => {
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: iana,
          timeZoneName: "short",
        }).formatToParts(now)
        const tzPart = parts.find((p) => p.type === "timeZoneName")
        return tzPart?.value || ""
      } catch {
        return ""
      }
    })()

    // UTC offset in `±HH:MM` form. `longOffset` returns e.g. "GMT+05:30",
    // which we trim to "+05:30" / "-08:00".
    const offset = (() => {
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: iana,
          timeZoneName: "longOffset",
        }).formatToParts(now)
        const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || ""
        // longOffset yields "GMT", "GMT+05:30", "GMT-08:00", "UTC", etc.
        const match = tzPart.match(/([+-]\d{1,2}(?::\d{2})?)/)
        if (match) return `UTC${match[1]}`
        if (tzPart === "GMT" || tzPart === "UTC") return "UTC+00:00"
        return ""
      } catch {
        return ""
      }
    })()

    if (shortName && offset) {
      // If Intl returned the IANA id back as the short name (some
      // browsers do this for less common zones), prefer offset-only.
      if (shortName.includes("/") || /^GMT[+-]?/.test(shortName)) {
        return offset
      }
      return `${shortName} · ${offset}`
    }
    if (offset) return offset
    if (shortName) return shortName
    return iana
  } catch {
    return iana
  }
}
