"use client"

import type React from "react"
import { AppSidebar } from "./app-sidebar"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-sidebar text-sidebar-foreground">
      <AppSidebar />
      <main className="flex-1 overflow-auto bg-background">
        <div className="p-4 sm:p-5 lg:p-6 max-w-[1400px] mx-auto w-full min-h-full flex flex-col">{children}</div>
      </main>
    </div>
  )
}
