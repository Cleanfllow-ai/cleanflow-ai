import "./globals.css"

import { Inter, IBM_Plex_Mono } from "next/font/google"
import { AuthProvider } from "@/modules/auth"
import { CookieBanner } from "@/modules/privacy/components/cookie-banner"
import { FilePreloader } from "@/modules/files/components/file-preloader"
import type { Metadata } from "next"
import type React from "react"
import { ReduxProvider } from "@/shared/providers/redux-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
})

export const metadata: Metadata = {
  title: "CleanFlowAI - Data Quality Platform",
  description: "Enterprise data quality, transformation, and ERP integration platform",
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon_io/favicon.ico' },
      { url: '/favicon_io/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon_io/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon_io/apple-touch-icon.png' },
    ],
    other: [
      { rel: 'android-chrome-192x192', url: '/favicon_io/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/favicon_io/android-chrome-512x512.png' },
    ],
  },
  manifest: '/favicon_io/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
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
