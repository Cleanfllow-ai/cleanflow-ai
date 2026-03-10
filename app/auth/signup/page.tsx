"use client"

import { FileSpreadsheet, Layers, Upload } from "lucide-react"

import Image from "next/image"
import React from "react"
import { SignUpForm } from "@/modules/auth"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 m-2 rounded-3xl border border-slate-200 dark:border-slate-700">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20 dark:opacity-10">
          <div className="absolute top-32 right-20 w-80 h-80 bg-violet-400 rounded-full blur-3xl" />
          <div className="absolute bottom-32 left-10 w-72 h-72 bg-cyan-400 rounded-full blur-3xl" />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          {/* Top - Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative w-12 h-12">
              <Image
                src="/images/infiniqon-logo-light.png"
                alt="CleanFlowAI"
                width={48}
                height={48}
                className="rounded-xl object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-xl text-slate-900 dark:text-white">CleanFlowAI</span>
              <p className="text-xs text-slate-500 dark:text-white/60">Data Platform</p>
            </div>
          </div>

          {/* Middle - Main Content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <h1 className="text-5xl font-bold mb-6 leading-tight text-slate-900 dark:text-white">
                Start Your Data<br />Journey Today
              </h1>
              <p className="text-lg text-slate-600 dark:text-white/70 leading-relaxed max-w-md">
                Connect data from any source, apply powerful transformations, and export clean, structured datasets with ease
              </p>
            </div>

            {/* How It Works */}
            <div className="space-y-4 max-w-md">
              <p className="text-sm font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">How it works</p>
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">1. Connect Your Data</p>
                  <p className="text-sm text-slate-500 dark:text-white/50">Upload files or securely integrate with your source systems</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">2. Transform & Clean</p>
                  <p className="text-sm text-slate-500 dark:text-white/50">Automatically map fields, validate data, and measure quality scores</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">3. Export Anywhere</p>
                  <p className="text-sm text-slate-500 dark:text-white/50">Send and receive files via FTP, HTTP, ERP, and SMTP protocols. Download in CSV, Excel, JSON, and other supported formats</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom - Tagline */}
          <div className="pt-8 border-t border-slate-200 dark:border-white/10">
            <p className="text-sm text-slate-500 dark:text-white/50">Transform • Analyze • Export</p>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
            <SignUpForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
