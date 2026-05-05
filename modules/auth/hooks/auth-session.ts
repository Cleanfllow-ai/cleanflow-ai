import type { User } from "@/modules/auth/types/auth.types"

export interface StoredTokens {
  idToken: string
  accessToken: string
  refreshToken: string | null
}

export const parseJWT = (token: string) => {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error("Error parsing JWT:", error)
    return null
  }
}

export const buildUserFromPayload = (payload: any): User => {
  // Cognito always issues an ``email`` claim, but a malformed token (or a
  // future federated identity) may not. Fall back through username → ""
  // so the UI never crashes on ``payload.email.split`` when email is missing.
  const email: string = payload?.email || ""
  const username: string = payload?.["cognito:username"] || ""
  const fallbackName = email ? email.split("@")[0] : (username || "user")
  return {
    email,
    sub: payload?.sub || "",
    username,
    name: payload?.name || fallbackName,
  }
}

export const loadStoredTokens = (): StoredTokens | null => {
  const raw = localStorage.getItem("authTokens")
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed.idToken || !parsed.accessToken) return null
    return {
      idToken: parsed.idToken,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken || null,
    }
  } catch {
    return null
  }
}

export const saveStoredTokens = (tokens: StoredTokens) => {
  localStorage.setItem(
    "authTokens",
    JSON.stringify({
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  )
}

export const clearStoredTokens = () => {
  localStorage.removeItem("authTokens")
}

