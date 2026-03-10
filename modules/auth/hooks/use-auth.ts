"use client";

import { useEffect, useState } from 'react'

import { cognitoApi } from '@/modules/auth/api/cognito-client'
import type { User, AuthState, MfaSetupData } from '@/modules/auth/types/auth.types'
import { buildUserFromPayload, clearStoredTokens, loadStoredTokens, parseJWT, saveStoredTokens } from './auth-session'

// Re-export types for backwards compatibility
export type { User, AuthState, MfaSetupData } from '@/modules/auth/types/auth.types'

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    idToken: null,
    accessToken: null,
    refreshToken: null,
    mfaRequired: false,
    mfaSession: null,
    mfaUsername: null
  })

  useEffect(() => {
    // Check for existing session on mount
    const storedTokens = loadStoredTokens()
    if (storedTokens) {
      try {
        const { idToken, accessToken, refreshToken } = storedTokens
        const payload = parseJWT(idToken)
        console.log('Parsed JWT payload:', payload)

        if (payload && payload.exp > Date.now() / 1000) {
          setAuthState({
            user: {
              email: payload.email,
              sub: payload.sub,
              username: payload['cognito:username'],
              name: payload.name || payload.email.split('@')[0]
            },
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            refreshToken: refreshToken || null,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null
          })
        } else if (refreshToken) {
          // Attempt silent refresh on mount if tokens are expired but refresh token exists
          refreshSession(refreshToken)
        } else {
          clearStoredTokens()
          setAuthState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        clearStoredTokens()
        setAuthState(prev => ({ ...prev, isLoading: false }))
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  // Auto-refresh tokens before they expire
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.refreshToken || !authState.idToken || authState.mfaSession) return

    const checkAndRefresh = () => {
      const payload = parseJWT(authState.idToken!)
      if (!payload) return

      const expiresIn = payload.exp - (Date.now() / 1000)

      // If expires in less than 5 minutes (300s), refresh
      if (expiresIn < 300) {
        console.log('Token expiring soon, refreshing session...')
        refreshSession(authState.refreshToken!)
      }
    }

    const interval = setInterval(checkAndRefresh, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [authState.isAuthenticated, authState.refreshToken, authState.idToken])

  const refreshSession = async (refreshToken: string) => {
    try {
      const authResult = await cognitoApi.refreshSession(refreshToken)

      if (authResult.AuthenticationResult) {
        const idToken = authResult.AuthenticationResult.IdToken!
        const accessToken = authResult.AuthenticationResult.AccessToken!
        // Refresh token might be returned, or we keep the old one
        const newRefreshToken = authResult.AuthenticationResult.RefreshToken || refreshToken

        const payload = parseJWT(idToken)
        if (payload) {
          const user = buildUserFromPayload(payload)

          saveStoredTokens({
            idToken,
            accessToken,
            refreshToken: newRefreshToken
          })

          setAuthState(prev => ({
            ...prev,
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            refreshToken: newRefreshToken,
            mfaRequired: false,
          }))

          return { success: true }
        }
      }
      throw new Error('Refresh failed')
    } catch (error) {
      console.error('Session refresh failed:', error)
      // Only logout if we definitely don't have a pending challenge
      setAuthState(prev => {
        if (prev.mfaSession) {
          return { ...prev, isAuthenticated: false, isLoading: false }
        }
        clearStoredTokens()
        return {
          ...prev,
          user: null,
          isLoading: false,
          isAuthenticated: false,
          idToken: null,
          accessToken: null,
          refreshToken: null,
        }
      })
      return { success: false }
    }
  }

  const signup = async (email: string, password: string, confirmPassword: string, name?: string) => {
    if (!email || !password || !confirmPassword) {
      throw new Error('Please fill in all fields')
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match')
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    try {
      const result = await cognitoApi.signUp(email, password, name)

      if (result.UserConfirmed) {
        return { confirmed: true, message: 'Account created successfully!' }
      } else {
        return { confirmed: false, message: 'Please check your email for verification code' }
      }
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        throw new Error('User already exists. Try logging in instead.')
      }
      throw new Error(error.message || 'Signup failed')
    }
  }

  const confirmSignup = async (email: string, code: string) => {
    try {
      await cognitoApi.confirmSignUp(email, code)
      return { success: true, message: 'Email verified successfully!' }
    } catch (error: any) {
      throw new Error(error.message || 'Verification failed')
    }
  }

  const login = async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Please enter both email and password')
    }

    // Clear existing session state before starting new login
    clearStoredTokens()
    setAuthState(prev => ({
      ...prev,
      isAuthenticated: false,
      user: null,
      idToken: null,
      accessToken: null,
      refreshToken: null,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null
    }))

    try {
      const authResult = await cognitoApi.login(email, password)

      // Check if MFA is required
      if (authResult.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        // MFA is required - store session and wait for MFA code
        setAuthState(prev => ({
          ...prev,
          mfaRequired: true,
          mfaSession: authResult.Session || null,
          mfaUsername: email,
          isLoading: false
        }))
        return {
          success: false,
          mfaRequired: true,
          message: 'Please enter your MFA code'
        }
      }

      // Check if temporary password needs to be changed (Invited users)
      if (authResult.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        setAuthState(prev => ({
          ...prev,
          mfaRequired: false,
          mfaSession: authResult.Session || null,
          mfaUsername: email,
          isLoading: false
        }))
        return {
          success: false,
          newPasswordRequired: true,
          session: authResult.Session,
          message: 'Please set your permanent password'
        }
      }

      // Check if MFA setup is required (first time)
      if (authResult.ChallengeName === 'MFA_SETUP') {
        setAuthState(prev => ({
          ...prev,
          mfaRequired: true,
          mfaSession: authResult.Session || null,
          mfaUsername: email,
          isLoading: false
        }))
        return {
          success: false,
          mfaSetupRequired: true,
          session: authResult.Session,
          message: 'Please set up MFA'
        }
      }

      // No MFA - complete authentication
      if (authResult.AuthenticationResult) {
        const idToken = authResult.AuthenticationResult.IdToken!
        const accessToken = authResult.AuthenticationResult.AccessToken!
        const refreshToken = authResult.AuthenticationResult.RefreshToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user = buildUserFromPayload(payload)

          saveStoredTokens({ idToken, accessToken, refreshToken })

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            refreshToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null
          })

          return { success: true, message: 'Login successful!' }
        }
      }

      throw new Error('Authentication failed')
    } catch (error: any) {
      if (error.name === 'UserNotConfirmedException') {
        throw new Error('Account not confirmed. Please check your email.')
      } else if (error.name === 'NotAuthorizedException') {
        throw new Error('Invalid email or password.')
      } else if (error.name === 'UserNotFoundException') {
        throw new Error('User not found. Please sign up first.')
      }
      throw new Error(error.message || 'Login failed')
    }
  }

  // Verify MFA code during login
  const verifyMfaCode = async (mfaCode: string) => {
    if (!authState.mfaSession || !authState.mfaUsername) {
      throw new Error('MFA session not found. Please login again.')
    }

    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }

    try {
      const result = await cognitoApi.verifySoftwareTokenMfa(authState.mfaSession, authState.mfaUsername, mfaCode)

      if (result.AuthenticationResult) {
        const idToken = result.AuthenticationResult.IdToken!
        const accessToken = result.AuthenticationResult.AccessToken!
        const refreshToken = result.AuthenticationResult.RefreshToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user = buildUserFromPayload(payload)

          saveStoredTokens({ idToken, accessToken, refreshToken })

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            refreshToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null
          })

          return { success: true, message: 'MFA verified successfully!' }
        }
      }

      throw new Error('MFA verification failed')
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code. Please try again.')
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Code has expired. Please login again.')
      }
      throw new Error(error.message || 'MFA verification failed')
    }
  }

  // Setup MFA for the first time - get secret code and QR URL
  const setupMfa = async (accessToken: string): Promise<MfaSetupData> => {
    try {
      const result = await cognitoApi.associateSoftwareTokenFromAccessToken(accessToken)

      if (result.SecretCode) {
        // Generate QR code URL for authenticator apps
        const email = authState.user?.email || 'user'
        const qrCodeUrl = `otpauth://totp/CleanFlowAI:${email}?secret=${result.SecretCode}&issuer=CleanFlowAI`

        return {
          secretCode: result.SecretCode,
          qrCodeUrl
        }
      }

      throw new Error('Failed to generate MFA secret')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to setup MFA')
    }
  }

  // Setup MFA using session (for MFA_SETUP challenge during login)
  const setupMfaWithSession = async (session: string, email: string): Promise<MfaSetupData & { session: string }> => {
    try {
      const result = await cognitoApi.associateSoftwareTokenFromSession(session)

      if (result.SecretCode) {
        // Generate QR code URL for authenticator apps
        const qrCodeUrl = `otpauth://totp/CleanFlowAI:${email}?secret=${result.SecretCode}&issuer=CleanFlowAI`

        return {
          secretCode: result.SecretCode,
          qrCodeUrl,
          session: result.Session || session
        }
      }

      throw new Error('Failed to generate MFA secret')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to setup MFA')
    }
  }

  // Confirm MFA setup with verification code
  const confirmMfaSetup = async (accessToken: string, mfaCode: string) => {
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }

    try {
      const result = await cognitoApi.verifySoftwareTokenFromAccessToken(accessToken, mfaCode)

      if (result.Status === 'SUCCESS') {
        return { success: true, message: 'MFA enabled successfully!' }
      }

      throw new Error('MFA setup verification failed')
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code. Please try again.')
      }
      throw new Error(error.message || 'MFA setup failed')
    }
  }

  // Complete new password challenge (for invited users)
  const completeNewPassword = async (newPassword: string) => {
    if (!authState.mfaSession || !authState.mfaUsername) {
      throw new Error('Session not found. Please login again.')
    }

    try {
      const result = await cognitoApi.respondNewPasswordChallenge(authState.mfaSession, authState.mfaUsername, newPassword)

      // The result might trigger another challenge (like MFA) or return tokens
      if (result.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        setAuthState(prev => ({
          ...prev,
          mfaRequired: true,
          mfaSession: result.Session || null,
          isLoading: false
        }))
        return {
          success: false,
          mfaRequired: true,
          message: 'Please enter your MFA code'
        }
      }

      if (result.AuthenticationResult) {
        const idToken = result.AuthenticationResult.IdToken!
        const accessToken = result.AuthenticationResult.AccessToken!
        const refreshToken = result.AuthenticationResult.RefreshToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user = buildUserFromPayload(payload)

          saveStoredTokens({ idToken, accessToken, refreshToken })

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            refreshToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null
          })

          return { success: true, message: 'Password set successfully!' }
        }
      }

      throw new Error('Failed to set new password')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to set password')
    }
  }

  // Confirm MFA setup using session (for MFA_SETUP challenge during login)
  const confirmMfaSetupWithSession = async (session: string, mfaCode: string, username: string) => {
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }

    try {
      const result = await cognitoApi.verifySoftwareTokenFromSession(session, mfaCode)

      if (result.Status === 'SUCCESS') {
        // Now complete the authentication with the new session
        const authResult = await cognitoApi.respondMfaSetupChallenge(result.Session!, username)

        if (authResult.AuthenticationResult) {
          const idToken = authResult.AuthenticationResult.IdToken!
          const accessToken = authResult.AuthenticationResult.AccessToken!
          const refreshToken = authResult.AuthenticationResult.RefreshToken!

          const payload = parseJWT(idToken)
          if (payload) {
            const user = buildUserFromPayload(payload)

            saveStoredTokens({ idToken, accessToken, refreshToken })

            setAuthState({
              user,
              isLoading: false,
              isAuthenticated: true,
              idToken,
              accessToken,
              refreshToken,
              mfaRequired: false,
              mfaSession: null,
              mfaUsername: null
            })

            return { success: true, message: 'MFA enabled successfully!' }
          }
        }

        return { success: true, message: 'MFA setup verified, please log in again.' }
      }

      throw new Error('MFA setup verification failed')
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code. Please try again.')
      }
      throw new Error(error.message || 'MFA setup verification failed')
    }
  }

  // Cancel MFA challenge and reset state
  const cancelMfa = () => {
    setAuthState(prev => ({
      ...prev,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null
    }))
  }

  const logout = () => {
    clearStoredTokens()
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      idToken: null,
      accessToken: null,
      refreshToken: null,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null
    })
  }

  return {
    ...authState,
    signup,
    confirmSignup,
    login,
    logout,
    // Password functions
    completeNewPassword,
    // MFA functions
    verifyMfaCode,
    setupMfa,
    setupMfaWithSession,
    confirmMfaSetup,
    confirmMfaSetupWithSession,
    cancelMfa
  }
}
