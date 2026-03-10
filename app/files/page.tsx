"use client";

import { AuthGuard } from "@/modules/auth";
import { MainLayout } from "@/shared/layout/main-layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFilesPage } from "@/modules/files/page/use-files-page";
import { FileExplorerTable } from "@/modules/files/page/file-explorer-table";
import { FilesPageDialogs } from "@/modules/files/page/files-page-dialogs";

export default function FilesPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <FilesPageContent />
      </MainLayout>
    </AuthGuard>
  );
}

function FilesPageContent() {
  const state = useFilesPage();

  return (
    <TooltipProvider>
      <div className="space-y-4 p-3 sm:p-0">
        <FileExplorerTable state={state} />
        <FilesPageDialogs state={state} />
      </div>
    </TooltipProvider>
  );
}
