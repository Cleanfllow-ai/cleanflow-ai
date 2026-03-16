"use client"

import { CheckCircle2, Layers, Upload } from "lucide-react"

import Image from "next/image"
import React from "react"
import { SignUpForm } from "@/modules/auth"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side — Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-[#2a4477] to-[#1a2d4f] dark:from-[#1a2d4f] dark:to-[#111827]">
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 0.5px, transparent 0)',
            backgroundSize: '24px 24px'
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-10 h-full w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9">
              <Image src="/images/infiniqon-logo-light.png" alt="CleanFlowAI" width={36} height={36} className="rounded-lg object-contain" />
            </div>
            <div>
              <span className="font-semibold text-lg text-white">CleanFlowAI</span>
              <p className="text-[10px] uppercase tracking-widest text-white/40">Data Operations Platform</p>
            </div>
          </div>

          {/* Headline + Steps */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="mb-10">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-semibold mb-4">
                Get Started
              </p>
              <h1 className="text-4xl font-bold leading-tight text-white mb-4">
                Start Your Data<br />
                <span className="text-white/90">Journey Today</span>
              </h1>
              <p className="text-base text-white/60 leading-relaxed max-w-md">
                Connect any data source, apply intelligent transformations, and export clean datasets.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              {[
                { step: "01", icon: Upload, title: "Connect Your Data", desc: "Upload files or integrate with ERP systems" },
                { step: "02", icon: Layers, title: "Transform & Clean", desc: "AI-powered profiling and 33+ quality rules" },
                { step: "03", icon: CheckCircle2, title: "Export Anywhere", desc: "FTP, HTTP, ERP, or download in any format" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 group">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/[0.08] border border-white/[0.08] flex items-center justify-center">
                    <span className="text-[11px] font-bold text-white/80 font-mono">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white/90">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="pt-6 border-t border-white/[0.1]">
            <p className="text-[11px] text-white/30">
              Profile &middot; Validate &middot; Transform &middot; Export
            </p>
          </div>
        </div>
      </div>

      {/* Right Side — Signup Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
            <SignUpForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
