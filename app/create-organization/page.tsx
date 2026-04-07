"use client";

import { CreateOrganizationForm } from "@/modules/auth";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

export default function CreateOrganizationPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <Suspense fallback={<Loader2 className="h-6 w-6 text-primary animate-spin" />}>
                <CreateOrganizationForm />
            </Suspense>
        </div>
    );
}
