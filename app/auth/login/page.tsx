"use client"

import { LoginForm } from "@/modules/auth"
import Image from "next/image"
import React from "react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-[#041a0f] text-white">
      {/* Left Side — Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#042012]">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#05281d]/90 via-[#082a1f]/90 to-[#062417]/95" />
        <div className="absolute top-0 right-0 w-[520px] h-[520px] bg-[#1ec76c]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[420px] h-[420px] bg-[#18b762]/10 rounded-full blur-[100px]" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 h-full w-full">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12">
              <Image src="/images/rightrev-logo.png" alt="RightRev" width={48} height={48} className="object-contain" />
            </div>
            <div>
              <span className="font-semibold text-[18px] text-white tracking-tight">RightRev</span>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/60 font-medium">Data Quality Platform</p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="space-y-6">
              <div className="space-y-4">
                <h1 className="text-[2.75rem] font-bold leading-[1.1] text-white tracking-tight">
                  Enterprise-grade
                  <br />
                  <span className="text-[#90f7b5]">data quality.</span>
                </h1>
                <p className="text-[15px] text-[#d9f9da]/80 leading-relaxed max-w-sm">
                  Profile, validate, transform, and export your data with confidence. Built for teams that demand precision.
                </p>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 pt-4 text-[#d9f9da]/90">
                <div>
                  <p className="text-xl font-bold text-white">AI-Powered</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Smart Recognition</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div>
                  <p className="text-xl font-bold text-white">99.9%</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Uptime SLA</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div>
                  <p className="text-xl font-bold text-white">30+ Rules</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Auto Validation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-white/[0.08]">
            <p className="text-[11px] text-white/40 tracking-wide">Profile · Validate · Transform · Export</p>
          </div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-16 bg-[#03160e]">
        <div className="w-full max-w-[420px] bg-[#0c2617]/95 shadow-[0_40px_120px_rgba(0,0,0,0.18)] rounded-[32px] p-8">
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
            <LoginForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
