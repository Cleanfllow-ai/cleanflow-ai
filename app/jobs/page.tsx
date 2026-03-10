"use client"

import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { JobsList } from "@/modules/jobs"

export default function JobsPage() {
    return (
        <AuthGuard>
            <MainLayout>
                <JobsList />
            </MainLayout>
        </AuthGuard>
    )
}
