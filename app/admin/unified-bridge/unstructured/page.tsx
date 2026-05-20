"use client"

/**
 * /admin/unified-bridge/unstructured — direct deep link to the Unstructured tab.
 *
 * For SEO / deep-link friendliness we redirect to the canonical
 * `/admin/unified-bridge?tab=unstructured` URL on mount. This route exists so
 * external systems that want a stable path can link here without knowing the
 * query-string convention.
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"

export default function UnstructuredAliasPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/unified-bridge?tab=unstructured")
  }, [router])

  return (
    <AuthGuard>
      <MainLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Opening Unstructured tab…
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
