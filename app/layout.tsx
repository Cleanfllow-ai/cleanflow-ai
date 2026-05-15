import "./globals.css"

import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google"
import { AuthProvider } from "@/modules/auth"
import { CookieBanner } from "@/modules/privacy/components/cookie-banner"
import { FilePreloader } from "@/modules/files/components/file-preloader"
import type { Metadata } from "next"
import type React from "react"
import { ReduxProvider } from "@/shared/providers/redux-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-barlow",
})

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "CleanFlowAI - Data Quality Platform",
  description: "Enterprise data quality, transformation, and ERP integration platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        <ReduxProvider>
          <AuthProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
              {children}
              <FilePreloader />
              <CookieBanner />
            </ThemeProvider>
          </AuthProvider>
        </ReduxProvider>
        <Toaster />
      </body>
    </html>
  )
}
