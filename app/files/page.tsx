"use client";

import { useCallback } from "react";
import { AuthGuard } from "@/modules/auth";
import { MainLayout } from "@/shared/layout/main-layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFilesPage } from "@/modules/files/page/use-files-page";
import { FileExplorerTable } from "@/modules/files/page/file-explorer-table";
import { FilesPageDialogs } from "@/modules/files/page/files-page-dialogs";
import { FilesPageHeader } from "@/modules/files/page/files-page-header";
import { UploadManagerProvider } from "@/modules/files/context/upload-manager";

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

  const handleUploadComplete = useCallback(() => {
    state.handleManualRefresh();
  }, [state.handleManualRefresh]);

  return (
    <UploadManagerProvider onUploadComplete={handleUploadComplete}>
      <TooltipProvider>
        <div className="space-y-4 p-3 sm:p-0">
          <FilesPageHeader files={state.files} />
          <FileExplorerTable state={state} />
          <FilesPageDialogs state={state} />
        </div>
      </TooltipProvider>
    </UploadManagerProvider>
  );
}
