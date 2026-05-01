/**
 * Auth-token bridge.
 *
 * Plain-function (non-React) helpers — `makeRequest` / `apiCall` need to
 * refresh tokens on 401 but they live outside the component tree, so they
 * can't call `useAuth()`. The `AuthProvider` registers its `getValidToken`
 * implementation here once on mount; non-React API code calls
 * `getValidTokenAsync()` to use it.
 */

type TokenGetter = () => Promise<string>

let registeredGetter: TokenGetter | null = null

/**
 * Register the function that returns a guaranteed-valid Cognito ID token.
 * Called once from `AuthProvider` so the API layer can transparently
 * refresh tokens on 401 without each hook implementing its own retry logic.
 */
export function setValidTokenGetter(fn: TokenGetter | null): void {
    registeredGetter = fn
}

/**
 * Return a fresh ID token. Throws if no getter is registered or if refresh
 * fails. API helpers use this for transparent 401 token-refresh.
 */
export async function getValidTokenAsync(): Promise<string> {
    if (!registeredGetter) {
        throw new Error("No token getter registered")
    }
    return registeredGetter()
}

/** True iff a token getter has been registered. */
export function hasValidTokenGetter(): boolean {
    return registeredGetter !== null
}
