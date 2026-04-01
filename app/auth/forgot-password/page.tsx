"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail, ArrowLeft, Lock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cognitoApi } from "@/modules/auth/api/cognito-client"

type Step = "email" | "reset"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await cognitoApi.forgotPassword(email)
      setStep("reset")
    } catch (err: any) {
      setError(err.message || "Failed to send reset code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setIsLoading(true)
    try {
      await cognitoApi.confirmForgotPassword(email, code, newPassword)
      setSuccess(true)
      setTimeout(() => router.replace("/auth/login"), 2000)
    } catch (err: any) {
      setError(err.message || "Failed to reset password")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Password reset successful</h1>
          <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div>
          <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "email"
              ? "Enter your email and we'll send you a reset code"
              : `Enter the code sent to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send reset code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reset Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="Enter the code from your email"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? "Resetting..." : "Reset password"}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("email")}>
              Use a different email
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
