"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle, Eye, EyeOff, Lock, Mail, Shield, Smartphone, Copy, Check } from "lucide-react"
import { LoadingDots, LoadingSpinner } from "@/components/ui/loading"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
          <div className="relative w-10 h-10">
            <Image src="/images/infiniqon-logo-light.png" alt="CleanFlowAI" width={40} height={40} className="object-contain" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
      </div>

      <form onSubmit={f.handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
              required
              className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
            <Link href="/auth/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
            <Input
              id="password"
              type={f.showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
              required
              className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              onClick={() => f.setShowPassword(!f.showPassword)}
            >
              {f.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center space-x-2">
          <input id="remember" type="checkbox" className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring" />
          <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Remember me</Label>
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
          className="w-full h-11 font-medium transition-all"
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
      <p className="text-center text-sm text-muted-foreground mt-8">
        Don&apos;t have an account?{" "}
        <Link href={`/auth/signup${f.searchParamsString ? `?${f.searchParamsString}` : ''}`} className="text-primary hover:text-primary/80 font-medium transition-colors">
          Create account
        </Link>
      </p>

      {/* New Password Modal (for invited users) */}
      <Dialog open={f.showNewPasswordModal} onOpenChange={f.handleCloseNewPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="relative">
            <button onClick={f.handleCloseNewPasswordModal} className="absolute right-0 top-0 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <Check className="h-4 w-4 sr-only" />
            </button>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3"><Lock className="w-6 h-6 text-primary" /></div>
            </div>
            <DialogTitle className="text-center text-xl">Set Your Password</DialogTitle>
            <DialogDescription className="text-center">
              Welcome! Since this is your first time logging in, please set a permanent password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Password</Label>
              <Input id="new-password" type="password" placeholder="Enter new password" value={f.newPassword} onChange={(e) => f.setNewPassword(e.target.value)} autoFocus disabled={f.isSettingPassword} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-new-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
              <Input id="confirm-new-password" type="password" placeholder="Confirm new password" value={f.confirmNewPassword} onChange={(e) => f.setConfirmNewPassword(e.target.value)} disabled={f.isSettingPassword} className="h-11" />
            </div>
            {f.error && (
              <Alert variant="destructive"><AlertDescription>{f.error}</AlertDescription></Alert>
            )}
            <Button onClick={f.handleSetNewPassword} className="w-full h-11" disabled={f.isSettingPassword || !f.newPassword || !f.confirmNewPassword}>
              {f.isSettingPassword ? (
                <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Setting password...</span>
              ) : (
                "Set Password & Continue"
              )}
            </Button>
            <Button variant="ghost" onClick={f.handleCloseNewPasswordModal} className="w-full text-muted-foreground" disabled={f.isSettingPassword}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Modal */}
      <Dialog open={f.showMfaModal} onOpenChange={f.handleCloseMfaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3"><Shield className="w-6 h-6 text-primary" /></div>
            </div>
            <DialogTitle className="text-center text-xl">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center leading-relaxed">
              Enter the 6-digit code from your authenticator app
              <br />
              <span className="font-medium text-foreground break-all">{f.maskEmail(f.email)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verification Code</Label>
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
            <Button onClick={f.handleVerifyMfa} className="w-full h-11" disabled={f.mfaCode.length !== 6 || f.isVerifyingMfa || f.isVerifying}>
              {f.isVerifyingMfa ? (
                <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Verifying...</span>
              ) : f.isVerifying ? (
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Verified! Redirecting...</span>
              ) : (
                "Verify Code"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground leading-relaxed">
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
              <div className="rounded-full bg-primary/10 p-3"><Smartphone className="w-6 h-6 text-primary" /></div>
            </div>
            <DialogTitle className="text-center text-xl">Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center">Scan the QR code with your authenticator app to enable 2FA</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {f.mfaSetupStep === 'qr' && (
              <>
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  {f.qrCodeDataUrl ? (
                    <img src={f.qrCodeDataUrl} alt="MFA QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
                      <div className="text-center text-sm text-muted-foreground">
                        <Smartphone className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                        <p>Scan QR code in your</p>
                        <p>authenticator app</p>
                      </div>
                    </div>
                  )}
                </div>

                {f.secretCode && f.secretCode !== 'Please complete setup to get your secret code' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Can&apos;t scan? Enter this code manually:</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2.5 bg-muted rounded text-xs font-mono break-all">{f.secretCode}</code>
                      <Button variant="outline" size="icon" onClick={f.handleCopySecret} className="shrink-0 h-9 w-9">
                        {f.copiedSecret ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}

                <Button onClick={() => f.setMfaSetupStep('verify')} className="w-full h-11">I&apos;ve scanned the QR code</Button>
              </>
            )}

            {f.mfaSetupStep === 'verify' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="setup-mfa-code" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Enter 6-digit code</Label>
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
                  <Button variant="outline" onClick={() => f.setMfaSetupStep('qr')} className="flex-1 h-11" disabled={f.isVerifyingMfa || f.isVerifying}>Back</Button>
                  <Button onClick={f.handleVerifySetupMfa} className="flex-1 h-11" disabled={f.setupMfaCode.length !== 6 || f.isVerifyingMfa || f.isVerifying}>
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

            <p className="text-center text-xs text-muted-foreground">Supported: Google Authenticator, Authy, Microsoft Authenticator</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
