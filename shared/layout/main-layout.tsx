"use client"

import { AppSidebar } from "./app-sidebar"
import type React from "react"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 lg:p-6 xl:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  )
}
