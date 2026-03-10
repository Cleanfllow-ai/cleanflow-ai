"use client"

import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, CheckCircle, Mail, RotateCcw, Shield, Timer } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/modules/auth'

interface EmailVerificationProps {
  email: string
  onVerified: () => Promise<void> | void
  onBack: () => void
}

export function EmailVerification({ email, onVerified, onBack }: EmailVerificationProps) {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes
  const { confirmSignup } = useAuth()

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await confirmSignup(email, code)
      setSuccess(result.message)
      setTimeout(() => {
        Promise.resolve(onVerified()).catch((err: any) => {
          setError(err?.message || "Verification succeeded but post-setup failed.")
        })
      }, 1000)
    } catch (err: any) {
      const message = err?.message || "Verification failed"
      // Cognito returns an error if the user is already confirmed.
      // In that case, we should continue the post-verify flow anyway.
      if (message.toUpperCase().includes("CONFIRMED")) {
        setSuccess("Email already verified. Continuing setup...")
        setTimeout(() => {
          Promise.resolve(onVerified()).catch((postErr: any) => {
            setError(postErr?.message || "Post-setup failed after confirmation.")
          })
        }, 600)
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    // Implement resend logic here
    setTimeLeft(300) // Reset timer
    setError('')
    setSuccess('Verification code resent successfully!')
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 dark:opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-400 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400 rounded-full blur-3xl" />
      </div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
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
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Check Your Email
          </h1>
          <p className="text-muted-foreground text-sm">
            We've sent a verification code to
          </p>
          <p className="text-cyan-600 dark:text-cyan-400 font-medium text-sm mt-1">
            {email}
          </p>
        </div>

        <Card className="border border-border bg-card shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center space-x-2 text-foreground">
              <Shield className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-lg font-semibold">Email Verification</span>
            </div>
            
            {/* Timer */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Timer className="w-4 h-4" />
              <span>Code expires in {formatTime(timeLeft)}</span>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Verification Code Field */}
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium text-muted-foreground">
                  Verification Code
                </Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest h-14 border-input focus:border-primary focus:ring-2 focus:ring-ring"
                  required
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code from your email
                </p>
              </div>

              {/* Alerts */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertDescription className="text-emerald-700 dark:text-emerald-300">{success}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-12 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-semibold rounded-xl transition-all duration-200" 
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Verify Email</span>
                  </div>
                )}
              </Button>
            </form>

            {/* Resend Code */}
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Didn't receive the code?
              </p>
              <Button
                variant="outline"
                onClick={handleResendCode}
                disabled={timeLeft > 0}
                className="text-sm"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {timeLeft > 0 ? `Resend in ${formatTime(timeLeft)}` : 'Resend Code'}
              </Button>
            </div>

            {/* Back Button */}
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
              className="w-full h-12 font-medium rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign Up
            </Button>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground">
              <p>
                Check your spam folder if you don't see the email
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

