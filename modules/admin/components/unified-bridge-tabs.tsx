"use client"

/**
 * unified-bridge-tabs — top-level tab switcher for /admin/unified-bridge.
 *
 *   [Structured]   [Unstructured]
 *
 * The Structured tab embeds the existing UnifiedBridgeImport (FTP / TCP / HTTP /
 * ERP connectors). The Unstructured tab embeds the new
 * UnstructuredImportWizard.
 *
 * The active tab is persisted in the URL via `?tab=`, so deep links like
 * `/admin/unified-bridge?tab=unstructured` open straight to the right view.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileQuestion, Layers, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UnifiedBridgeImport from "@/modules/unified-bridge/components/unified-bridge-import"
import { UnstructuredImportWizard } from "@/modules/unstructured"

type BridgeTab = "structured" | "unstructured"

const VALID_TABS: BridgeTab[] = ["structured", "unstructured"]

function isValidTab(v: string | null | undefined): v is BridgeTab {
  return typeof v === "string" && (VALID_TABS as string[]).includes(v)
}

function UnifiedBridgeTabsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get("tab")
  const initial: BridgeTab = isValidTab(urlTab) ? urlTab : "structured"
  const [active, setActive] = useState<BridgeTab>(initial)

  useEffect(() => {
    if (isValidTab(urlTab) && urlTab !== active) {
      setActive(urlTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab])

  const handleTabChange = useCallback(
    (next: string) => {
      if (!isValidTab(next)) return
      setActive(next)
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      params.set("tab", next)
      router.replace(`/admin/unified-bridge?${params.toString()}`)
    },
    [router, searchParams],
  )

  const noopNotify = useMemo(
    () => (_message: string, _type: "success" | "error") => {
      // The admin route doesn't surface toasts yet; downstream wiring TBD.
    },
    [],
  )

  return (
    <Tabs
      value={active}
      onValueChange={handleTabChange}
      className="w-full"
      data-testid="unified-bridge-tabs"
    >
      <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
        <TabsTrigger
          value="structured"
          data-testid="unified-bridge-tab-structured"
          className="flex items-center gap-2"
        >
          <Layers className="h-4 w-4" />
          Structured
        </TabsTrigger>
        <TabsTrigger
          value="unstructured"
          data-testid="unified-bridge-tab-unstructured"
          className="flex items-center gap-2"
        >
          <FileQuestion className="h-4 w-4" />
          Unstructured
        </TabsTrigger>
      </TabsList>

      <TabsContent value="structured" className="mt-0">
        <UnifiedBridgeImport mode="source" onNotification={noopNotify} />
      </TabsContent>

      <TabsContent
        value="unstructured"
        data-testid="unified-bridge-tab-content-unstructured"
        className="mt-0"
      >
        <UnstructuredImportWizard />
      </TabsContent>
    </Tabs>
  )
}

export default function UnifiedBridgeTabs() {
  // useSearchParams() requires a Suspense boundary in app-router pages.
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading…
        </div>
      }
    >
      <UnifiedBridgeTabsInner />
    </Suspense>
  )
}
