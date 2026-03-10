'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, Snowflake } from 'lucide-react'

/**
 * Snowflake OAuth Callback Handler
 * Handles the redirect from Lambda after OAuth authorization.
 */
function SnowflakeCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
    const [message, setMessage] = useState('Connecting to Snowflake...')

    useEffect(() => {
        handleCallback()
    }, [])

    const handleCallback = async () => {
        try {
            const error = searchParams.get('error')
            const success = searchParams.get('success')

            if (error) {
                throw new Error(error)
            }

            if (success === 'true') {
                setStatus('success')
                setMessage('Successfully connected to Snowflake!')

                if (window.opener) {
                    const targetOrigin = document.referrer
                        ? new URL(document.referrer).origin
                        : '*'
                    window.opener.postMessage(
                        { type: 'snowflake-auth-success' },
                        targetOrigin
                    )
                    setTimeout(() => {
                        window.close()
                    }, 1500)
                } else {
                    setTimeout(() => {
                        router.push('/files?snowflake=connected')
                    }, 2000)
                }
            } else {
                throw new Error('OAuth flow incomplete - missing success parameter')
            }
        } catch (err) {
            setStatus('error')
            setMessage((err as Error).message || 'Failed to connect to Snowflake')

            if (window.opener) {
                const targetOrigin = document.referrer
                    ? new URL(document.referrer).origin
                    : '*'
                window.opener.postMessage(
                    {
                        type: 'snowflake-auth-error',
                        error: (err as Error).message || 'Connection failed',
                    },
                    targetOrigin
                )
                setTimeout(() => {
                    window.close()
                }, 5000)
            } else {
                setTimeout(() => {
                    router.push('/files?snowflake=error')
                }, 3000)
            }
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
            <div className="bg-card border rounded-xl shadow-lg p-8 max-w-sm w-full">
                {status === 'processing' && (
                    <div className="text-center">
                        <div className="mb-5">
                            <Loader2 className="h-12 w-12 text-sky-500 mx-auto animate-spin" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground mb-1">
                            Connecting to Snowflake
                        </h2>
                        <p className="text-sm text-muted-foreground">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="mb-5">
                            <div className="w-14 h-14 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                            </div>
                        </div>
                        <h2 className="text-lg font-semibold text-foreground mb-1">
                            Connected
                        </h2>
                        <p className="text-sm text-muted-foreground mb-3">{message}</p>
                        <p className="text-xs text-muted-foreground">
                            This window will close automatically...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="mb-5">
                            <div className="w-14 h-14 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                                <AlertCircle className="h-8 w-8 text-destructive" />
                            </div>
                        </div>
                        <h2 className="text-lg font-semibold text-foreground mb-1">
                            Connection Failed
                        </h2>
                        <p className="text-sm text-muted-foreground mb-3">{message}</p>
                        <p className="text-xs text-muted-foreground">
                            Redirecting you back...
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

function CallbackLoadingFallback() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
            <div className="bg-card border rounded-xl shadow-lg p-8 max-w-sm w-full">
                <div className="text-center">
                    <div className="mb-5">
                        <Snowflake className="h-12 w-12 text-sky-500 mx-auto animate-pulse" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">Loading...</h2>
                    <p className="text-sm text-muted-foreground">Please wait</p>
                </div>
            </div>
        </div>
    )
}

export default function SnowflakeCallbackPage() {
    return (
        <Suspense fallback={<CallbackLoadingFallback />}>
            <SnowflakeCallbackContent />
        </Suspense>
    )
}
