import { redirect } from "next/navigation"

/**
 * Canonical redirect: /connectors -> /admin?tab=connectors
 *
 * The Connectors UI is rendered as a tab inside the OrganizationSettings
 * component (see modules/auth/components/organization-settings.tsx). Several
 * places in the app push to /connectors directly:
 *   - modules/auth/providers/auth-provider.tsx (reconnect / connect handlers)
 *   - any future sidebar/header link
 *
 * Without this page, those pushes hit a 404 because Next.js App Router only
 * resolves /connectors when a page.tsx exists at app/connectors/page.tsx.
 * This file makes /connectors a real route that immediately forwards to the
 * actual UI, preserving any qs (?reconnect=..., ?connect=...) so the deep
 * link continues to work.
 *
 * TODO (OPTION B follow-up): promote ConnectorsHub to a first-class route
 * under app/connectors/ and keep /admin?tab=connectors as a back-compat
 * redirect. Tracked in commit message for `fix(fe): /connectors 404`.
 */
export default async function ConnectorsRedirectPage({
  searchParams,
}: {
  // Next.js 15 promoted `searchParams` to a Promise — sync types fail the
  // type-check step of `next build` (PageProps requires Promise<any>).
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Forward all incoming query params on /admin so callers like
  // ?reconnect=quickbooks or ?connect=zohobooks continue to work end-to-end.
  // Always inject tab=connectors so OrganizationSettings opens on the right
  // tab regardless of what the caller passed.
  const resolved = (await searchParams) ?? {}
  const params = new URLSearchParams()
  params.set("tab", "connectors")
  for (const [key, value] of Object.entries(resolved)) {
    if (key === "tab") continue
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== undefined) params.append(key, v)
      }
    } else if (value !== undefined) {
      params.append(key, value)
    }
  }
  redirect(`/admin?${params.toString()}`)
}
