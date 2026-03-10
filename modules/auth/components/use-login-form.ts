'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { useAuth } from '@/modules/auth/providers/auth-provider'
import { orgAPI } from '@/modules/auth/api/org-api'
import { useToast } from '@/shared/hooks/use-toast'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLoginForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [mounted, setMounted] = useState(false)
    const [showMfaModal, setShowMfaModal] = useState(false)
    const [mfaCode, setMfaCode] = useState('')
    const [mfaError, setMfaError] = useState('')
    const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)

    // MFA Setup state
    const [showMfaSetupModal, setShowMfaSetupModal] = useState(false)
    const [mfaSetupStep, setMfaSetupStep] = useState<'qr' | 'verify'>('qr')
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
    const [secretCode, setSecretCode] = useState('')
    const [setupMfaCode, setSetupMfaCode] = useState('')
    const [mfaSetupSession, setMfaSetupSession] = useState<string | null>(null)
    const [copiedSecret, setCopiedSecret] = useState(false)

    // New Password state
    const [showNewPasswordModal, setShowNewPasswordModal] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [isSettingPassword, setIsSettingPassword] = useState(false)

    const { login, verifyMfaCode, setupMfaWithSession, confirmMfaSetupWithSession, completeNewPassword, mfaRequired, mfaSession, cancelMfa } = useAuth()
    const { toast } = useToast()
    const searchParams = useSearchParams()

    useEffect(() => {
        setMounted(true)
        const emailParam = searchParams.get('email')
        if (emailParam) {
            setEmail(decodeURIComponent(emailParam))
        }
    }, [searchParams])

    // ─── Helpers ────────────────────────────────────────────────────────────────

    const maskEmail = (emailStr: string): string => {
        const [localPart, domain] = emailStr.split('@')
        if (!localPart || !domain) return emailStr
        if (localPart.length <= 3) return `${localPart[0]}***@${domain}`
        const firstPart = localPart.substring(0, 2)
        const lastChar = localPart[localPart.length - 1]
        const middleLength = localPart.length - 3
        const masked = '*'.repeat(Math.max(middleLength, 4))
        return `${firstPart}${masked}${lastChar}@${domain}`
    }

    const redirectAfterLogin = async () => {
        try {
            const me = await orgAPI.getMe()
            sessionStorage.removeItem("pending_org_details")
            const role = me.membership?.role || "Super Admin"
            window.localStorage.setItem("cleanflowai.currentRole", role)
            window.location.href = "/dashboard"
        } catch (err: any) {
            const message = err?.message || ""
            if (message.includes("Organization membership required")) {
                const pendingOrgRaw = sessionStorage.getItem("pending_org_details")
                if (pendingOrgRaw) {
                    try {
                        const pendingOrg = JSON.parse(pendingOrgRaw)
                        await orgAPI.registerOrg({
                            name: pendingOrg.name,
                            email: pendingOrg.email || email,
                            phone: pendingOrg.phone,
                            address: pendingOrg.address,
                            industry: pendingOrg.industry,
                            gst: pendingOrg.gst,
                            pan: pendingOrg.pan,
                            contact_person: pendingOrg.contact_person,
                            subscriptionPlan: "standard",
                        })
                        sessionStorage.removeItem("pending_org_details")
                        window.location.href = "/dashboard"
                        return
                    } catch {
                        // Fall back to setup page
                    }
                }
                toast({
                    title: "Organization setup required",
                    description: "Please create your organization to continue.",
                })
                window.location.href = `/create-organization${window.location.search}`
                return
            }
            window.location.href = "/dashboard"
        }
    }

    // ─── Login submit ───────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        setSuccess('')

        try {
            const result = await login(email, password)

            if (result.mfaRequired) {
                setShowMfaModal(true)
                setIsLoading(false)
                return
            }

            if (result.newPasswordRequired) {
                setShowNewPasswordModal(true)
                setIsLoading(false)
                return
            }

            if (result.mfaSetupRequired) {
                await handleMfaSetupStart(result.session)
                return
            }

            if (result.success) {
                setSuccess('Login successful!')
                setIsVerifying(true)
                setTimeout(() => { redirectAfterLogin() }, 1500)
            }
        } catch (err: any) {
            setError(err.message)
            setIsLoading(false)
        }
    }

    // ─── MFA Setup ──────────────────────────────────────────────────────────────

    const handleMfaSetupStart = async (session?: string) => {
        try {
            const sessionToUse = session || mfaSetupSession
            if (!sessionToUse) throw new Error('No MFA setup session available')

            const result = await setupMfaWithSession(sessionToUse, email)
            const qrDataUrl = await QRCode.toDataURL(result.qrCodeUrl, {
                width: 200,
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            })

            setQrCodeDataUrl(qrDataUrl)
            setSecretCode(result.secretCode)
            setMfaSetupSession(result.session)
            setShowMfaSetupModal(true)
            setMfaSetupStep('qr')
            setIsLoading(false)
        } catch (err: any) {
            setError(err.message || 'Failed to start MFA setup')
            setIsLoading(false)
        }
    }

    // ─── MFA Verify ─────────────────────────────────────────────────────────────

    const handleVerifyMfa = async () => {
        setMfaError('')
        if (mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
            setMfaError('Please enter a valid 6-digit code')
            return
        }
        setIsVerifyingMfa(true)
        try {
            const result = await verifyMfaCode(mfaCode)
            if (result.success) {
                setIsVerifying(true)
                setTimeout(() => { redirectAfterLogin() }, 1500)
            }
        } catch (err: any) {
            setMfaError(err.message || 'Invalid verification code')
            setIsVerifyingMfa(false)
        }
    }

    // ─── MFA Setup Verify ──────────────────────────────────────────────────────

    const handleVerifySetupMfa = async () => {
        if (setupMfaCode.length !== 6 || !/^\d{6}$/.test(setupMfaCode)) {
            setMfaError('Please enter a valid 6-digit code')
            return
        }
        if (!mfaSetupSession) {
            setMfaError('MFA setup session expired. Please try again.')
            return
        }
        setIsVerifyingMfa(true)
        setMfaError('')
        try {
            const result = await confirmMfaSetupWithSession(mfaSetupSession, setupMfaCode, email)
            if (result.success) {
                setIsVerifying(true)
                setTimeout(() => { redirectAfterLogin() }, 1500)
            }
        } catch (err: any) {
            setMfaError(err.message || 'Verification failed')
            setIsVerifyingMfa(false)
        }
    }

    // ─── Modal close handlers ──────────────────────────────────────────────────

    const handleCloseMfaModal = () => {
        setShowMfaModal(false)
        setMfaCode('')
        setMfaError('')
        setIsVerifyingMfa(false)
        cancelMfa()
    }

    const handleCloseNewPasswordModal = () => {
        setShowNewPasswordModal(false)
        setNewPassword('')
        setConfirmNewPassword('')
        setError('')
        setIsSettingPassword(false)
        cancelMfa()
    }

    const handleCloseMfaSetupModal = () => {
        setShowMfaSetupModal(false)
        setMfaSetupStep('qr')
        setSetupMfaCode('')
        setQrCodeDataUrl('')
        setSecretCode('')
        setMfaSetupSession(null)
        cancelMfa()
    }

    // ─── Copy secret ───────────────────────────────────────────────────────────

    const handleCopySecret = async () => {
        try {
            await navigator.clipboard.writeText(secretCode)
            setCopiedSecret(true)
            setTimeout(() => setCopiedSecret(false), 2000)
        } catch (err) {
            console.error('Failed to copy secret')
        }
    }

    // ─── New Password ──────────────────────────────────────────────────────────

    const handleSetNewPassword = async () => {
        setError('')
        if (!newPassword || !confirmNewPassword) {
            setError('Please fill in both password fields')
            return
        }
        if (newPassword !== confirmNewPassword) {
            setError('Passwords do not match')
            return
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        setIsSettingPassword(true)
        try {
            const result = await completeNewPassword(newPassword)
            if (result.mfaRequired) {
                setShowNewPasswordModal(false)
                setShowMfaModal(true)
                setIsSettingPassword(false)
                return
            }
            if (result.success) {
                setSuccess('Password set successfully!')
                setShowNewPasswordModal(false)
                setIsVerifying(true)
                setTimeout(() => { redirectAfterLogin() }, 1500)
            }
        } catch (err: any) {
            const message = err.message || 'Failed to set password'
            setError(message)
            setIsSettingPassword(false)

            if (message.includes('session can only be used once') || message.includes('Invalid session')) {
                toast({
                    title: "Session Expired",
                    description: "Your secure session has expired. Please log in again to continue.",
                    variant: "destructive"
                })
                handleCloseNewPasswordModal()
            }
        }
    }

    return {
        mounted,
        // Form
        email, setEmail,
        password, setPassword,
        showPassword, setShowPassword,
        isLoading,
        isVerifying,
        error,
        success,
        handleSubmit,
        // MFA verify modal
        showMfaModal,
        mfaCode, setMfaCode,
        mfaError,
        isVerifyingMfa,
        handleVerifyMfa,
        handleCloseMfaModal,
        maskEmail,
        // MFA setup modal
        showMfaSetupModal,
        mfaSetupStep, setMfaSetupStep,
        qrCodeDataUrl,
        secretCode,
        setupMfaCode, setSetupMfaCode,
        copiedSecret,
        handleCopySecret,
        handleVerifySetupMfa,
        handleCloseMfaSetupModal,
        // New Password modal
        showNewPasswordModal,
        newPassword, setNewPassword,
        confirmNewPassword, setConfirmNewPassword,
        isSettingPassword,
        handleSetNewPassword,
        handleCloseNewPasswordModal,
    }
}
