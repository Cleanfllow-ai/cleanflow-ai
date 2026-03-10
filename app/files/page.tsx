"use client";

import { Upload, FileText } from "lucide-react";
import { AuthGuard } from "@/modules/auth";
import { MainLayout } from "@/shared/layout/main-layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { useFilesPage } from "@/modules/files/page/use-files-page";
import { UploadSection } from "@/modules/files/page/upload-section";
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
  const { activeSection, setActiveSection, files, filteredFiles } = state;

  return (
    <TooltipProvider>
      <div className="space-y-4 p-3 sm:p-0">
        {/* Segmented Tab Navigation */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border bg-muted p-1 flex-1 sm:flex-none">
            <button
              onClick={() => setActiveSection("upload")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-md px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none",
                activeSection === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden xs:inline">File</span> Upload
            </button>
            <button
              onClick={() => setActiveSection("explorer")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-md px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none",
                activeSection === "explorer"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">File</span> Explorer
              {filteredFiles.length > 0 && (
                <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 sm:px-2 py-0.5 text-xs">
                  {filteredFiles.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* File Upload Section */}
        {activeSection === "upload" && <UploadSection state={state} />}

        {/* File Explorer Section */}
        {activeSection === "explorer" && <FileExplorerTable state={state} />}

        {/* All Dialogs / Modals */}
        <FilesPageDialogs state={state} />
      </div>
    </TooltipProvider>
  );
}
