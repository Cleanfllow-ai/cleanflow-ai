"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingDots, LoadingSpinner } from "@/components/ui/loading"
import { AnimatePresence, motion } from "framer-motion"
import { Check, CheckCircle, Copy, Eye, EyeOff, Lock, Mail, Shield, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import Link from "next/link"

import { useLoginForm } from "./use-login-form"

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginForm() {
  const f = useLoginForm()

  if (!f.mounted) return null

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        {/* Mobile-only logo */}
        <div className="flex justify-center mb-6 lg:hidden">
          <div className="relative w-14 h-14">
            <Image src="/images/rightrev-logo.png" alt="CleanFlowAI" width={56} height={56} className="object-contain" />
          </div>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="text-sm text-white/60 mt-1">Enter your credentials to continue</p>
      </div>

      <form onSubmit={f.handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-white/60 uppercase tracking-wider">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 h-4 w-4" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
              required
              className="pl-10 h-11 bg-white/5 border border-green-600/40 text-white placeholder:text-white/40 focus:bg-[#082a18] focus:border-[#69C04B] transition-colors"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-medium text-white/60 uppercase tracking-wider">Password</Label>
            <Link href="/auth/forgot-password" className="text-xs text-[#69C04B] hover:text-white transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 h-4 w-4" />
            <Input
              id="password"
              type={f.showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
              required
              className="pl-10 pr-10 h-11 bg-white/5 border border-green-600/40 text-white placeholder:text-white/40 focus:bg-[#082a18] focus:border-[#69C04B] transition-colors"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
              onClick={() => f.setShowPassword(!f.showPassword)}
            >
              {f.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center space-x-2">
          <input id="remember" type="checkbox" className="h-3.5 w-3.5 rounded border-green-500 text-[#69C04B] focus:ring-[#7fea95]" />
          <Label htmlFor="remember" className="text-sm text-white/60 cursor-pointer">Remember me</Label>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {f.error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertDescription className="text-destructive text-sm">{f.error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
          {f.success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Alert className="bg-green-500/5 border-green-500/20">
                <AlertDescription className="text-green-600 dark:text-green-400 flex items-center gap-2 text-sm">
                  {f.isVerifying ? (
                    <><LoadingSpinner size="sm" /><span>Verifying credentials...</span><LoadingDots /></>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /><span>{f.success}</span></>
                  )}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-11 font-medium transition-all bg-[#69C04B] hover:bg-[#5db040] text-[#164234] font-semibold"
          disabled={f.isLoading || f.isVerifying}
        >
          {f.isLoading ? (
            <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Signing in...</span>
          ) : f.isVerifying ? (
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Redirecting...</span>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {/* Sign up link */}
      <p className="text-center text-sm text-white/60 mt-8">
        Don&apos;t have an account?{" "}
        <Link href={`/auth/signup${f.searchParamsString ? `?${f.searchParamsString}` : ''}`} className="text-[#69C04B] hover:text-white font-medium transition-colors">
          Create account
        </Link>
      </p>

      {/* New Password Modal (for invited users) */}
      <Dialog open={f.showNewPasswordModal} onOpenChange={f.handleCloseNewPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="relative">
            <button onClick={f.handleCloseNewPasswordModal} className="absolute right-0 top-0 opacity-70 ring-offset-transparent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#7fea95]/40 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[#1a4931] data-[state=open]:text-white/60">
              <Check className="h-4 w-4 sr-only" />
            </button>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-[#1f5c39]/20 p-3"><Lock className="w-6 h-6 text-[#69C04B]" /></div>
            </div>
            <DialogTitle className="text-center text-xl">Set Your Password</DialogTitle>
            <DialogDescription className="text-center">
              Welcome! Since this is your first time logging in, please set a permanent password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium text-white/60 uppercase tracking-wider">New Password</Label>
              <Input id="new-password" type="password" placeholder="Enter new password" value={f.newPassword} onChange={(e) => f.setNewPassword(e.target.value)} autoFocus disabled={f.isSettingPassword} className="h-11 bg-white/5 border border-green-600/40 text-white placeholder:text-white/40 focus:border-[#69C04B]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-new-password" className="text-xs font-medium text-white/60 uppercase tracking-wider">Confirm Password</Label>
              <Input id="confirm-new-password" type="password" placeholder="Confirm new password" value={f.confirmNewPassword} onChange={(e) => f.setConfirmNewPassword(e.target.value)} disabled={f.isSettingPassword} className="h-11 bg-white/5 border border-green-600/40 text-white placeholder:text-white/40 focus:border-[#69C04B]" />
            </div>
            {f.error && (
              <Alert variant="destructive"><AlertDescription>{f.error}</AlertDescription></Alert>
            )}
            <Button onClick={f.handleSetNewPassword} className="w-full h-11 bg-[#69C04B] hover:bg-[#5db040] text-[#164234] font-semibold" disabled={f.isSettingPassword || !f.newPassword || !f.confirmNewPassword}>
              {f.isSettingPassword ? (
                <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Setting password...</span>
              ) : (
                "Set Password & Continue"
              )}
            </Button>
            <Button variant="ghost" onClick={f.handleCloseNewPasswordModal} className="w-full text-white/60 hover:text-white" disabled={f.isSettingPassword}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Modal */}
      <Dialog open={f.showMfaModal} onOpenChange={f.handleCloseMfaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-[#1f5c39]/20 p-3"><Shield className="w-6 h-6 text-[#69C04B]" /></div>
            </div>
            <DialogTitle className="text-center text-xl">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center leading-relaxed text-white/60">
              Enter the 6-digit code from your authenticator app
              <br />
              <span className="font-medium text-green-100 break-all">{f.maskEmail(f.email)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="text-xs font-medium text-white/60 uppercase tracking-wider">Verification Code</Label>
              <Input
                id="mfa-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                value={f.mfaCode}
                onChange={(e) => { f.setMfaCode(e.target.value.replace(/\D/g, '')) }}
                className="h-12 text-center text-2xl tracking-widest font-mono"
                disabled={f.isVerifyingMfa || f.isVerifying} autoFocus
              />
            </div>
            {f.mfaError && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertDescription className="text-destructive">{f.mfaError}</AlertDescription>
              </Alert>
            )}
            <Button onClick={f.handleVerifyMfa} className="w-full h-11 bg-[#69C04B] hover:bg-[#5db040] text-[#164234] font-semibold" disabled={f.mfaCode.length !== 6 || f.isVerifyingMfa || f.isVerifying}>
              {f.isVerifyingMfa ? (
                <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Verifying...</span>
              ) : f.isVerifying ? (
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Verified! Redirecting...</span>
              ) : (
                "Verify Code"
              )}
            </Button>
            <p className="text-center text-xs text-white/60 leading-relaxed">
              Open your authenticator app (Google Authenticator, Authy, etc.) to get the code
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Setup Modal */}
      <Dialog open={f.showMfaSetupModal} onOpenChange={f.handleCloseMfaSetupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-[#1f5c39]/20 p-3"><Smartphone className="w-6 h-6 text-[#69C04B]" /></div>
            </div>
            <DialogTitle className="text-center text-xl">Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center">Scan the QR code with your authenticator app to enable 2FA</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {f.mfaSetupStep === 'qr' && (
              <>
                <div className="flex justify-center p-4 bg-[#092d20] rounded-lg border border-green-700/30">
                  {f.qrCodeDataUrl ? (
                    <img src={f.qrCodeDataUrl} alt="MFA QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-[#0c3020] rounded">
                      <div className="text-center text-sm text-white/60">
                        <Smartphone className="w-10 h-10 mx-auto mb-2 text-white/50" />
                        <p>Scan QR code in your</p>
                        <p>authenticator app</p>
                      </div>
                    </div>
                  )}
                </div>

                {f.secretCode && f.secretCode !== 'Please complete setup to get your secret code' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">Can't scan? Enter this code manually:</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2.5 bg-[#0c3020] rounded text-xs font-mono text-green-100 break-all">{f.secretCode}</code>
                      <Button variant="outline" size="icon" onClick={f.handleCopySecret} className="shrink-0 h-9 w-9 text-white/60 border-green-600 hover:bg-[#143d28]">
                        {f.copiedSecret ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}

                <Button onClick={() => f.setMfaSetupStep('verify')} className="w-full h-11 bg-[#69C04B] hover:bg-[#5db040] text-[#164234] font-semibold">I&apos;ve scanned the QR code</Button>
              </>
            )}

            {f.mfaSetupStep === 'verify' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="setup-mfa-code" className="text-xs font-medium text-white/60 uppercase tracking-wider">Enter 6-digit code</Label>
                  <Input
                    id="setup-mfa-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                    value={f.setupMfaCode}
                    onChange={(e) => { f.setSetupMfaCode(e.target.value.replace(/\D/g, '')) }}
                    className="h-12 text-center text-2xl tracking-widest font-mono"
                    disabled={f.isVerifyingMfa || f.isVerifying} autoFocus
                  />
                </div>

                {f.mfaError && (
                  <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                    <AlertDescription className="text-destructive">{f.mfaError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => f.setMfaSetupStep('qr')} className="flex-1 h-11 border-green-600 text-white/60 hover:bg-[#143d28]" disabled={f.isVerifyingMfa || f.isVerifying}>Back</Button>
                  <Button onClick={f.handleVerifySetupMfa} className="flex-1 h-11 bg-[#69C04B] hover:bg-[#5db040] text-[#164234] font-semibold" disabled={f.setupMfaCode.length !== 6 || f.isVerifyingMfa || f.isVerifying}>
                    {f.isVerifyingMfa ? (
                      <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Verifying...</span>
                    ) : f.isVerifying ? (
                      <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Success!</span>
                    ) : (
                      "Verify & Enable"
                    )}
                  </Button>
                </div>
              </>
            )}

            <p className="text-center text-xs text-white/60">Supported: Google Authenticator, Authy, Microsoft Authenticator</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
