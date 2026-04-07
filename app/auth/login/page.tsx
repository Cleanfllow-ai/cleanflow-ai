"use client"

import Image from "next/image"
import React from "react"
import { LoginForm } from "@/modules/auth"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side — Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0f1729]">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#162244]/80 via-[#0f1729] to-[#0a1628]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.07] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/[0.05] rounded-full blur-[100px]" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 h-full w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <Image src="/images/infiniqon-logo-light.png" alt="CleanFlowAI" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <span className="font-semibold text-[15px] text-white tracking-tight">CleanFlowAI</span>
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/50 font-medium">Data Quality Platform</p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="space-y-6">
              <div className="space-y-4">
                <h1 className="text-[2.75rem] font-bold leading-[1.1] text-white tracking-tight">
                  Enterprise-grade
                  <br />
                  <span className="text-white/70">data quality.</span>
                </h1>
                <p className="text-[15px] text-white/60 leading-relaxed max-w-sm">
                  Profile, validate, transform, and export your data with confidence. Built for teams that demand precision.
                </p>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <p className="text-2xl font-bold text-white">AI-Powered</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Smart Profiling</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div>
                  <p className="text-2xl font-bold text-white">99.9%</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Uptime SLA</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div>
                  <p className="text-2xl font-bold text-white">SOC 2</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Compliant</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
            <p className="text-[11px] text-white/40 tracking-wide">Profile &middot; Validate &middot; Transform &middot; Export</p>
          </div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-[400px]">
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
            <LoginForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
