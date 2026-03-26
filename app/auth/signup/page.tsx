"use client"

import Image from "next/image"
import React from "react"
import { SignUpForm } from "@/modules/auth"

export default function SignUpPage() {
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
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-[2.75rem] font-bold leading-[1.1] text-white tracking-tight">
                  Get started
                  <br />
                  <span className="text-white/70">in minutes.</span>
                </h1>
                <p className="text-[15px] text-white/60 leading-relaxed max-w-sm">
                  Connect any data source, apply intelligent transformations, and export clean datasets — all from one platform.
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-5 pt-2">
                {[
                  { step: "01", title: "Connect your data", desc: "Upload files or integrate with third-party systems" },
                  { step: "02", title: "Transform & validate", desc: "AI-powered profiling and quality rules engine" },
                  { step: "03", title: "Deliver with confidence", desc: "Route clean data to any destination or format" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-white/60 font-mono">{item.step}</span>
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[13px] font-medium text-white/90">{item.title}</p>
                      <p className="text-[11px] text-white/50 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
            <p className="text-[11px] text-white/40 tracking-wide">Profile &middot; Validate &middot; Transform &middot; Export</p>
          </div>
        </div>
      </div>

      {/* Right Side — Signup Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-[440px]">
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
            <SignUpForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
