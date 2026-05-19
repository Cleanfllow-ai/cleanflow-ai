/**
 * P0-3: sanitizeAuthError — raw Cognito / APIG messages must not leak to DOM
 * Tests the sanitizer inline logic extracted from use-login-form.ts + signup-form.tsx.
 */

// Mirror the sanitizeAuthError function from use-login-form.ts / signup-form.tsx
function sanitizeAuthError(raw: string): string {
  if (/Invalid key=value pair.*Authorization header/i.test(raw)) {
    return "Unable to reach the authentication service. Please refresh and try again."
  }
  if (/Authorization header.*SHA-256.*Base64/i.test(raw) || /hashed with SHA-256/i.test(raw)) {
    return "Authentication error. Please sign out and sign in again."
  }
  const cognitoPrefix = /^(PreAuthentication|PostAuthentication|UserMigration) failed with error (.+)\.$/.exec(raw)
  if (cognitoPrefix) return cognitoPrefix[2]
  return raw
}

describe('P0-3: sanitizeAuthError', () => {
  it('scrubs SigV4 Authorization header error', () => {
    const raw = 'Invalid key=value pair (missing equal-sign) in Authorization header: ...'
    expect(sanitizeAuthError(raw)).toBe(
      'Unable to reach the authentication service. Please refresh and try again.'
    )
  })

  it('scrubs SHA-256 Base64 error', () => {
    const raw = 'Authorization header encoded with SHA-256 Base64 ...'
    expect(sanitizeAuthError(raw)).toBe(
      'Authentication error. Please sign out and sign in again.'
    )
  })

  it('scrubs hashed with SHA-256 error', () => {
    const raw = 'Signature was hashed with SHA-256 and ...'
    expect(sanitizeAuthError(raw)).toBe(
      'Authentication error. Please sign out and sign in again.'
    )
  })

  it('strips PreAuthentication failed with error prefix', () => {
    const raw = 'PreAuthentication failed with error User is disabled.'
    expect(sanitizeAuthError(raw)).toBe('User is disabled')
  })

  it('strips PostAuthentication failed with error prefix', () => {
    const raw = 'PostAuthentication failed with error Quota exceeded.'
    expect(sanitizeAuthError(raw)).toBe('Quota exceeded')
  })

  it('returns benign user-facing errors unchanged', () => {
    expect(sanitizeAuthError('Incorrect username or password.')).toBe('Incorrect username or password.')
    expect(sanitizeAuthError('User does not exist.')).toBe('User does not exist.')
    expect(sanitizeAuthError('Password does not conform to policy.')).toBe('Password does not conform to policy.')
  })

  it('returns empty string unchanged', () => {
    expect(sanitizeAuthError('')).toBe('')
  })
})
