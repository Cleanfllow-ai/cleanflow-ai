"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { InviteSetPasswordForm } from "@/modules/auth";

export default function InviteSetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 text-primary animate-spin" />}>
        <InviteSetPasswordForm />
      </Suspense>
    </div>
  );
}
