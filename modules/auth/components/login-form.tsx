"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AnimatePresence, motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
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
      {/* Header Section with Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16">
            <Image
              src="/images/infiniqon-logo-light.png"
              alt="CleanFlowAI"
              width={64}
              height={64}
              className="rounded-xl object-contain"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back</h1>
        <p className="text-muted-foreground">Enter your credentials to access your account</p>
      </div>

      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardContent className="space-y-6 p-0">
          <form onSubmit={f.handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={f.email}
                  onChange={(e) => f.setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 border-input focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="password"
                  type={f.showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={f.password}
                  onChange={(e) => f.setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-12 border-input focus:border-primary focus:ring-2 focus:ring-ring"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                  onClick={() => f.setShowPassword(!f.showPassword)}
                >
                  {f.showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Remember me and Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input id="remember" type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />
                <Label htmlFor="remember" className="text-sm text-muted-foreground">Remember me</Label>
              </div>
              <Link href="/auth/forgot-password" className="text-sm text-accent hover:opacity-90">
                Forgot password?
              </Link>
            </div>

            {/* Alerts */}
            <AnimatePresence>
              {f.error && (
                <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.2 }}>
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-700">{f.error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
              {f.success && (
                <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.2 }}>
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-700 flex items-center gap-2">
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

            {/* Submit Button */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" disabled={f.isLoading || f.isVerifying}>
                <AnimatePresence mode="wait">
                  {f.isLoading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" /><span>Signing in...</span>
                    </motion.div>
                  ) : f.isVerifying ? (
                    <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4" /><span>Success! Redirecting...</span>
                    </motion.div>
                  ) : (
                    <motion.span key="signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Sign in</motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href={`/auth/signup${window.location.search}`} className="text-accent hover:opacity-90 font-medium">Sign up</Link>
          </p>
        </CardContent>
      </Card>

      {/* New Password Modal (for invited users) */}
      <Dialog open={f.showNewPasswordModal} onOpenChange={f.handleCloseNewPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="relative">
            <button onClick={f.handleCloseNewPasswordModal} className="absolute right-0 top-0 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <Check className="h-4 w-4 sr-only" />
            </button>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3"><Lock className="w-8 h-8 text-primary" /></div>
            </div>
            <DialogTitle className="text-center text-2xl">Set Your Password</DialogTitle>
            <DialogDescription className="text-center">
              Welcome! Since this is your first time logging in, please set a permanent password for your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" placeholder="Enter new password" value={f.newPassword} onChange={(e) => f.setNewPassword(e.target.value)} autoFocus disabled={f.isSettingPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm Password</Label>
              <Input id="confirm-new-password" type="password" placeholder="Confirm new password" value={f.confirmNewPassword} onChange={(e) => f.setConfirmNewPassword(e.target.value)} disabled={f.isSettingPassword} />
            </div>
            {f.error && (
              <Alert variant="destructive"><AlertDescription>{f.error}</AlertDescription></Alert>
            )}
            <Button onClick={f.handleSetNewPassword} className="w-full h-12" disabled={f.isSettingPassword || !f.newPassword || !f.confirmNewPassword}>
              {f.isSettingPassword ? (
                <div className="flex items-center space-x-2"><LoadingSpinner size="sm" /><span>Setting password...</span></div>
              ) : (
                'Set Password & Login'
              )}
            </Button>
            <Button variant="ghost" onClick={f.handleCloseNewPasswordModal} className="w-full" disabled={f.isSettingPassword}>Cancel & Back to Login</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Modal */}
      <Dialog open={f.showMfaModal} onOpenChange={f.handleCloseMfaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3"><Shield className="w-8 h-8 text-primary" /></div>
            </div>
            <DialogTitle className="text-center text-2xl">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center">
              Enter the 6-digit code from your authenticator app for{' '}
              <span className="font-medium text-foreground">{f.maskEmail(f.email)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            <div className="space-y-3">
              <Label htmlFor="mfa-code" className="text-sm font-medium">Enter 6-digit code</Label>
              <Input
                id="mfa-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                value={f.mfaCode}
                onChange={(e) => { f.setMfaCode(e.target.value.replace(/\D/g, '')) }}
                className="h-12 text-center text-2xl tracking-widest font-mono mt-2"
                disabled={f.isVerifyingMfa || f.isVerifying} autoFocus
              />
            </div>
            {f.mfaError && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-700">{f.mfaError}</AlertDescription>
              </Alert>
            )}
            <Button onClick={f.handleVerifyMfa} className="w-full h-12" disabled={f.mfaCode.length !== 6 || f.isVerifyingMfa || f.isVerifying}>
              {f.isVerifyingMfa ? (
                <div className="flex items-center space-x-2"><LoadingSpinner size="sm" /><span>Verifying...</span></div>
              ) : f.isVerifying ? (
                <div className="flex items-center space-x-2"><CheckCircle className="w-4 h-4" /><span>Verified! Redirecting...</span></div>
              ) : (
                'Verify Code'
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">Open your authenticator app (Google Authenticator, Authy, etc.) to get the code</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Setup Modal (First-time setup with QR code) */}
      <Dialog open={f.showMfaSetupModal} onOpenChange={f.handleCloseMfaSetupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3"><Smartphone className="w-8 h-8 text-primary" /></div>
            </div>
            <DialogTitle className="text-center text-2xl">Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center">Scan the QR code with your authenticator app to enable 2FA</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Step 1: QR Code */}
            {f.mfaSetupStep === 'qr' && (
              <>
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  {f.qrCodeDataUrl ? (
                    <img src={f.qrCodeDataUrl} alt="MFA QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                      <div className="text-center text-sm text-muted-foreground">
                        <Smartphone className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>Scan QR code in your</p>
                        <p>authenticator app</p>
                      </div>
                    </div>
                  )}
                </div>

                {f.secretCode && f.secretCode !== 'Please complete setup to get your secret code' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Can't scan? Enter this code manually:</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">{f.secretCode}</code>
                      <Button variant="outline" size="icon" onClick={f.handleCopySecret} className="shrink-0">
                        {f.copiedSecret ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                <Button onClick={() => f.setMfaSetupStep('verify')} className="w-full h-12">I've scanned the QR code</Button>
              </>
            )}

            {/* Step 2: Verify code */}
            {f.mfaSetupStep === 'verify' && (
              <>
                <div className="space-y-3">
                  <Label htmlFor="setup-mfa-code" className="text-sm font-medium">Enter the 6-digit code from your authenticator app</Label>
                  <Input
                    id="setup-mfa-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                    value={f.setupMfaCode}
                    onChange={(e) => { f.setSetupMfaCode(e.target.value.replace(/\D/g, '')) }}
                    className="h-12 text-center text-2xl tracking-widest font-mono"
                    disabled={f.isVerifyingMfa || f.isVerifying} autoFocus
                  />
                </div>

                {f.mfaError && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-700">{f.mfaError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => f.setMfaSetupStep('qr')} className="flex-1" disabled={f.isVerifyingMfa || f.isVerifying}>Back</Button>
                  <Button onClick={f.handleVerifySetupMfa} className="flex-1" disabled={f.setupMfaCode.length !== 6 || f.isVerifyingMfa || f.isVerifying}>
                    {f.isVerifyingMfa ? (
                      <div className="flex items-center space-x-2"><LoadingSpinner size="sm" /><span>Verifying...</span></div>
                    ) : f.isVerifying ? (
                      <div className="flex items-center space-x-2"><CheckCircle className="w-4 h-4" /><span>Success!</span></div>
                    ) : (
                      'Verify & Enable'
                    )}
                  </Button>
                </div>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">Supported apps: Google Authenticator, Authy, Microsoft Authenticator</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
