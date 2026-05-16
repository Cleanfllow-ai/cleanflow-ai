"use client"

import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { AugmentationPage } from "@/modules/augmentation"

export default function Page() {
    return (
        <AuthGuard>
            <MainLayout>
                <AugmentationPage />
            </MainLayout>
        </AuthGuard>
    )
}
