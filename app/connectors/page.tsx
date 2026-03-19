"use client"

import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { ConnectorsHub } from "@/modules/connectors/components/connectors-hub"

export default function ConnectorsPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <ConnectorsHub />
      </MainLayout>
    </AuthGuard>
  )
}
