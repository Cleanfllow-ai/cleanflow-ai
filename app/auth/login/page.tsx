"use client"

import Image from "next/image"
import React from "react"
import { LoginForm } from "@/modules/auth"

export default function LoginPage() {
  return (
    <div className="auth-light min-h-screen flex bg-background">
      {/* Left Side — Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#164234]">
        {/* RightRev logo mark repeating pattern */}
        <div
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
          style={{
            backgroundImage: "url('/images/patterrr-spaced.svg')",
            backgroundSize: "23px auto",
            backgroundRepeat: "repeat",
            filter: "brightness(0) invert(1)",
            opacity: 0.06,
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 h-full w-full">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12">
              <Image src="/images/rightrev-logo.png" alt="RightRev" width={48} height={48} className="object-contain" />
            </div>
            <div>
              <span className="font-semibold text-[20px] text-white tracking-tight">RightRev</span>
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/50 font-medium">Data Quality Platform</p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="space-y-6">
              <div className="space-y-4">
                <h1 className="text-[2.75rem] font-bold leading-[1.1] tracking-tight">
                  <span className="text-shine">
                    Enterprise-grade
                    <br />
                    data quality.
                  </span>
                </h1>
                <p className="text-[15px] text-white/60 leading-relaxed max-w-sm">
                  Profile, validate, transform, and export your data with confidence. Built for teams that demand precision.
                </p>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 pt-4">
                <div>
                  <p className="text-xl font-bold text-white">AI-Powered</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Smart Profiling</p>
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
