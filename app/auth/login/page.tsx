"use client"

import { Activity, Database, GitBranch, Shield } from "lucide-react"

import Image from "next/image"
import React from "react"
import { LoginForm } from "@/modules/auth"

export default function LoginPage() {
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
              <p className="text-[10px] uppercase tracking-widest text-white/40">Data Quality Platform</p>
            </div>
          </div>

          {/* Headline */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <h1 className="text-4xl font-bold leading-tight text-white mb-4">
              Transform Data,<br />Empower Decisions
            </h1>
            <p className="text-base text-white/60 leading-relaxed max-w-sm">
              Profile, validate, transform, and export — all from a single platform built for data teams.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8">
              {[
                { icon: Activity, label: "Data Profiling" },
                { icon: Shield, label: "Quality Engine" },
                { icon: GitBranch, label: "Version Control" },
                { icon: Database, label: "ERP Integration" },
              ].map((feat) => (
                <div key={feat.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.08] border border-white/[0.08]">
                  <feat.icon className="w-4 h-4 text-white/60" />
                  <span className="text-[13px] font-medium text-white/80">{feat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.1]">
            <p className="text-[11px] text-white/30">Profile · Validate · Transform · Export</p>
          </div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
            <LoginForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
