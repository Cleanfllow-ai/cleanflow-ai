'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Zoho Books OAuth Callback Handler
 * This component handles the redirect from Lambda after OAuth authorization
 */
function ZohoBooksCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Connecting to Zoho Books...')

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
        setMessage('Successfully connected to Zoho Books!')

        if (window.opener) {
          window.opener.postMessage(
            { type: 'zoho-books-auth-success' },
            window.location.origin
          )
          setTimeout(() => {
            window.close()
          }, 1500)
        } else {
          setTimeout(() => {
            router.push('/files?zoho-books=connected')
          }, 2000)
        }
      } else {
        throw new Error('OAuth flow incomplete - missing success parameter')
      }
    } catch (err) {
      setStatus('error')
      setMessage((err as Error).message || 'Failed to connect to Zoho Books')

      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'zoho-books-auth-error',
            error: (err as Error).message || 'Connection failed',
          },
          window.location.origin
        )
        setTimeout(() => {
          window.close()
        }, 5000)
      } else {
        setTimeout(() => {
          router.push('/files?zoho-books=error')
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
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Connecting to Zoho Books</h2>
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
            <h2 className="text-lg font-semibold text-foreground mb-1">Connected</h2>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <p className="text-xs text-muted-foreground">This window will close automatically...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mb-5">
              <div className="w-14 h-14 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Connection Failed</h2>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecting you back...</p>
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
            <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Loading...</h2>
          <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
      </div>
    </div>
  )
}

export default function ZohoBooksCallbackPage() {
  return (
    <Suspense fallback={<CallbackLoadingFallback />}>
      <ZohoBooksCallbackContent />
    </Suspense>
  )
}
