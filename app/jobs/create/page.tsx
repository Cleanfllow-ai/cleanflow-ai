"use client"

import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { JobCreationStepper } from "@/modules/jobs/components/job-creation-stepper"

export default function CreateJobPage() {
    return (
        <AuthGuard>
            <MainLayout>
                <JobCreationStepper />
            </MainLayout>
        </AuthGuard>
    )
}
