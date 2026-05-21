/**
 * formatWelcomeName — dashboard-private helper that renders a friendly
 * first-name-ish label for the welcome header.
 *
 * Why this lives here (not in shared/lib): the dashboard welcome line has
 * different requirements from the sidebar avatar (which uses
 * shared/lib/user-display formatUserDisplayName + "Demo User NN" pattern).
 * The dashboard wants a more human-sounding label parsed from the email
 * local-part (e.g. "battletest-user01" -> "Battletest User"), with the
 * Cognito display-name claim winning when it's a real name (i.e. not just
 * the buildUserFromPayload fallback that copies email-local-part).
 *
 * Rules:
 *   1. If `displayName` is set AND it is not just the email-local-part
 *      fallback (i.e. it contains a space — Cognito names always have
 *      first+last), use the first whitespace-token.
 *   2. Else, parse the email local-part:
 *        - split on `-`, `.`, `_`, and trailing/embedded digit runs
 *        - drop empty tokens
 *        - title-case each token
 *        - join with a single space
 *      Examples:
 *        battletest-user01 -> "Battletest User"
 *        john.doe          -> "John Doe"
 *        jane_smith42      -> "Jane Smith"
 *        bob               -> "Bob"
 *   3. If nothing usable, fall back to "there" so the greeting still reads.
 */

const titleCase = (token: string): string =>
  token.length === 0 ? "" : token[0].toUpperCase() + token.slice(1).toLowerCase()

export function formatWelcomeName(
  email?: string | null,
  displayName?: string | null,
): string {
  const trimmedName = (displayName || "").trim()
  // A real Cognito `name` claim almost always contains a space (first +
  // last). buildUserFromPayload's fallback copies the email local-part —
  // for "battletest-user01@…" that's "battletest-user01", which is exactly
  // what we're trying to avoid. So we only honour `name` if it doesn't
  // look like an email local-part (no @, no -, no _, no trailing digits).
  if (trimmedName && /\s/.test(trimmedName)) {
    return trimmedName.split(/\s+/)[0]
  }
  // Single-word `name` that *isn't* the email-local-part fallback gets
  // through too — most paying users have at least a first name set.
  if (
    trimmedName &&
    !/[._-]/.test(trimmedName) &&
    !/\d/.test(trimmedName) &&
    trimmedName.length > 0
  ) {
    return titleCase(trimmedName)
  }

  const trimmedEmail = (email || "").trim()
  if (!trimmedEmail) return "there"

  const local = trimmedEmail.split("@")[0] || ""
  if (!local) return "there"

  // Split on -, ., _, and digit runs. Filter out empty tokens.
  const tokens = local
    .split(/[-._]|\d+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map(titleCase)

  if (tokens.length === 0) return "there"
  return tokens.join(" ")
}
