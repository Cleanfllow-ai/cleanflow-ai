"use client"

import { Microscope, Zap, GitBranch, Tag } from "lucide-react"

import Image from "next/image"
import React from "react"
import { LoginForm } from "@/modules/auth"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 m-2 rounded-3xl border border-slate-200 dark:border-slate-700">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20 dark:opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400 rounded-full blur-3xl" />
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
                Transform Data,<br />Empower Decisions
              </h1>
              <p className="text-lg text-slate-600 dark:text-white/70 leading-relaxed max-w-md">
                Access your dashboard and continue transforming your data with our powerful platform.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <Microscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">Data Profiling</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">Analyze & Understand</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">Data Modernization</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">Transform & Optimize</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">Data Lineage</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">Track & Trace Origins</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">Metadata Management</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">Organize & Catalog</p>
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

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
            <LoginForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
