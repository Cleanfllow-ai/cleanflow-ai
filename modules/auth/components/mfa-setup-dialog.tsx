"use client"

import { useState } from 'react'
import { Shield, Copy, Check, QrCode } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/modules/auth/providers/auth-provider"

interface MfaSetupDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function MfaSetupDialog({ open, onOpenChange, onSuccess }: MfaSetupDialogProps) {
    const [step, setStep] = useState<'intro' | 'qr' | 'verify'>('intro')
    const [secretCode, setSecretCode] = useState('')
    const [qrCodeUrl, setQrCodeUrl] = useState('')
    const [verificationCode, setVerificationCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)

    const { accessToken, setupMfa, confirmMfaSetup } = useAuth()

    const handleStartSetup = async () => {
        if (!accessToken) {
            setError('Please log in first')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const result = await setupMfa(accessToken)
            setSecretCode(result.secretCode)
            setQrCodeUrl(result.qrCodeUrl)
            setStep('qr')
        } catch (err: any) {
            setError(err.message || 'Failed to start MFA setup')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCopySecret = async () => {
        try {
            await navigator.clipboard.writeText(secretCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const handleVerify = async () => {
        if (!accessToken) {
            setError('Please log in first')
            return
        }

        if (verificationCode.length !== 6 || !/^\d{6}$/.test(verificationCode)) {
            setError('Please enter a valid 6-digit code')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            await confirmMfaSetup(accessToken, verificationCode)
            onSuccess?.()
            onOpenChange(false)
            // Reset state
            setStep('intro')
            setSecretCode('')
            setQrCodeUrl('')
            setVerificationCode('')
        } catch (err: any) {
            setError(err.message || 'Failed to verify code')
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        onOpenChange(false)
        // Reset state after a delay
        setTimeout(() => {
            setStep('intro')
            setSecretCode('')
            setQrCodeUrl('')
            setVerificationCode('')
            setError('')
        }, 300)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="rounded-full bg-primary/10 p-3">
                            <Shield className="w-8 h-8 text-primary" />
                        </div>
                    </div>
                    <DialogTitle className="text-center text-2xl">
                        {step === 'intro' && 'Enable Two-Factor Authentication'}
                        {step === 'qr' && 'Scan QR Code'}
                        {step === 'verify' && 'Verify Setup'}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {step === 'intro' && 'Add an extra layer of security to your account'}
                        {step === 'qr' && 'Scan this QR code with your authenticator app'}
                        {step === 'verify' && 'Enter the code from your authenticator app'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-6">
                    {/* Step 1: Introduction */}
                    {step === 'intro' && (
                        <>
                            <div className="space-y-3 text-sm text-muted-foreground">
                                <p>
                                    Two-factor authentication (2FA) adds an extra layer of security to your account.
                                    You'll need to enter a code from your authenticator app each time you log in.
                                </p>
                                <p>
                                    <strong>Supported apps:</strong> Google Authenticator, Authy, Microsoft Authenticator, 1Password, and more.
                                </p>
                            </div>

                            {error && (
                                <Alert variant="destructive" className="bg-red-50 border-red-200">
                                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                onClick={handleStartSetup}
                                className="w-full h-12"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex items-center space-x-2">
                                        <LoadingSpinner size="sm" />
                                        <span>Setting up...</span>
                                    </div>
                                ) : (
                                    'Get Started'
                                )}
                            </Button>
                        </>
                    )}

                    {/* Step 2: QR Code */}
                    {step === 'qr' && (
                        <>
                            {/* QR Code Display */}
                            <div className="flex flex-col items-center space-y-4">
                                <div className="p-4 bg-white rounded-lg border shadow-sm">
                                    {/* Simple QR code placeholder - in production, use a QR code library */}
                                    <div className="flex items-center justify-center w-48 h-48 bg-gray-100 rounded">
                                        <div className="text-center">
                                            <QrCode className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                                            <p className="text-xs text-gray-500">
                                                Use a QR code library to display
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Manual entry option */}
                                <div className="w-full space-y-2">
                                    <Label className="text-sm text-muted-foreground">
                                        Or enter the code manually:
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 p-3 bg-gray-100 rounded text-sm font-mono break-all">
                                            {secretCode}
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleCopySecret}
                                            className="shrink-0"
                                        >
                                            {copied ? (
                                                <Check className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Button
                                onClick={() => setStep('verify')}
                                className="w-full h-12"
                            >
                                I've Scanned the Code
                            </Button>
                        </>
                    )}

                    {/* Step 3: Verify */}
                    {step === 'verify' && (
                        <>
                            <div className="space-y-3">
                                <Label htmlFor="verify-code" className="text-sm font-medium">
                                    Enter 6-digit code
                                </Label>
                                <Input
                                    id="verify-code"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={verificationCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '')
                                        setVerificationCode(value)
                                    }}
                                    className="h-12 text-center text-2xl tracking-widest font-mono"
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <Alert variant="destructive" className="bg-red-50 border-red-200">
                                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('qr')}
                                    className="flex-1 h-12"
                                    disabled={isLoading}
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleVerify}
                                    className="flex-1 h-12"
                                    disabled={verificationCode.length !== 6 || isLoading}
                                >
                                    {isLoading ? (
                                        <div className="flex items-center space-x-2">
                                            <LoadingSpinner size="sm" />
                                            <span>Verifying...</span>
                                        </div>
                                    ) : (
                                        'Enable MFA'
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
