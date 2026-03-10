"use client";

import { Suspense } from "react";
import { InviteSetPasswordForm } from "@/modules/auth";

export default function InviteSetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>}>
        <InviteSetPasswordForm />
      </Suspense>
    </div>
  );
}
