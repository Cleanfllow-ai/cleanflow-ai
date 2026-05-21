"use client"

import { Suspense } from "react"
import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { OrganizationSettings } from "@/modules/auth"

// /admin supports deep-linking to a specific tab via ?tab=organization |
// members | permissions | services | connectors | approvals.  When the
// query param is omitted (or unknown) OrganizationSettings falls back to
// the "organization" tab.  Bidirectional sync (URL <-> active tab) lives
// in modules/auth/components/organization-settings.tsx.
//
// Suspense boundary is required because OrganizationSettings calls
// useSearchParams() during render — Next.js needs the boundary so the
// page can be statically rendered and hydrated without bailout warnings.
export default function AdminPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="w-full max-w-5xl mx-auto">
          <Suspense fallback={null}>
            <OrganizationSettings />
          </Suspense>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
