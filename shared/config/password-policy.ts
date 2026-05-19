/**
 * Password policy matching Cognito user pool us-east-2_vl4npw482 (Austin).
 * Single source of truth — update here when Cognito policy changes.
 */
export const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: false, // Cognito pool does NOT require symbols
} as const;

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PwResult {
  isValid: boolean;
  errors: string[];
  /** 0=Weak, 1=Weak, 2=Fair, 3=Good, 4=Strong (isValid) */
  strengthLevel: StrengthLevel;
}

/**
 * Validates a password against PASSWORD_POLICY.
 * strengthLevel 4 means all requirements are satisfied (isValid=true).
 */
export function validatePassword(pw: string): PwResult {
  const errors: string[] = [];
  if (pw.length < PASSWORD_POLICY.minLength)
    errors.push(`At least ${PASSWORD_POLICY.minLength} characters`);
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(pw))
    errors.push("One uppercase letter");
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(pw))
    errors.push("One lowercase letter");
  if (PASSWORD_POLICY.requireDigit && !/[0-9]/.test(pw))
    errors.push("One number");
  if (PASSWORD_POLICY.requireSymbol && !/[^A-Za-z0-9]/.test(pw))
    errors.push("One symbol");

  const passedChecks = 4 - errors.length; // 4 active requirements (symbol is off)
  const strengthLevel = Math.max(0, passedChecks) as StrengthLevel;
  return { isValid: errors.length === 0, errors, strengthLevel };
}
