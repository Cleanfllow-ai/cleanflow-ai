/**
 * formatUserDisplayName — render-time helper that turns a raw user identity
 * into a friendly display name, with special handling for battle-test demo
 * accounts so the demo UI doesn't show "battletest-user01@rightrev.demo"
 * everywhere a real customer would see their own name.
 *
 * Order of preference:
 *   1. If a real Cognito `name` claim exists → use it as-is.
 *   2. If the email matches the battletest demo pattern → "Demo User NN".
 *   3. Otherwise → the email itself.
 *
 * Persona feedback (Wave 4): Marcus + Jagan flagged the raw demo email
 * leaking into the sidebar avatar / file-detail audit / activity feed.
 * For paying users their real display-name flows through unchanged because
 * Cognito populates the `name` claim for self-registered users.
 */

// Match any battletest-user## (1-3 digits) at any battletest demo domain.
// We deliberately do NOT pin the domain so dev / asfar / austin all map to
// the same friendly label.
const DEMO_EMAIL_RE = /^battletest-user(\d{1,3})@/i

export function formatUserDisplayName(
  email: string | null | undefined,
  name?: string | null | undefined,
): string {
  // Real Cognito display name wins — but only if it isn't just a fallback
  // copy of the email-local-part of a battletest account. buildUserFromPayload
  // sets name = email.split("@")[0] when Cognito has no `name` claim, so for
  // demo users `name` is "battletest-user01" which is just as ugly.
  const trimmedName = (name || "").trim()
  const trimmedEmail = (email || "").trim()

  if (trimmedName && !/^battletest-user\d{1,3}$/i.test(trimmedName)) {
    return trimmedName
  }

  if (trimmedEmail) {
    const match = trimmedEmail.match(DEMO_EMAIL_RE)
    if (match) {
      // Pad single-digit slot to 2 digits ("Demo User 01" reads better than
      // "Demo User 1") but leave 3-digit indices alone.
      const idx = match[1]
      const padded = idx.length === 1 ? `0${idx}` : idx
      return `Demo User ${padded}`
    }
    return trimmedEmail
  }

  // Last-resort fallback so the UI never renders "" or "undefined".
  return trimmedName || "User"
}

/**
 * Variant for surfaces (audit rows, activity feeds) that ONLY have the email
 * and want to hide the raw demo email. Returns the friendly form for demo
 * users, otherwise the email unchanged.
 */
export function formatUserEmailForDisplay(
  email: string | null | undefined,
): string {
  const trimmed = (email || "").trim()
  if (!trimmed) return ""
  const match = trimmed.match(DEMO_EMAIL_RE)
  if (match) {
    const idx = match[1]
    const padded = idx.length === 1 ? `0${idx}` : idx
    return `Demo User ${padded}`
  }
  return trimmed
}

/** True if the supplied email is a battletest demo identity. */
export function isDemoUserEmail(email: string | null | undefined): boolean {
  const trimmed = (email || "").trim()
  return !!trimmed && DEMO_EMAIL_RE.test(trimmed)
}
