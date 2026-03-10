"use client";

import { CreateOrganizationForm } from "@/modules/auth";
import { Suspense } from "react";

export default function CreateOrganizationPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
            <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>}>
                <CreateOrganizationForm />
            </Suspense>
        </div>
    );
}

// export default function CreateOrganizationPage() {
//   return (
//     <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
//       <CreateOrganizationContent />
//     </Suspense>
//   );
// }
