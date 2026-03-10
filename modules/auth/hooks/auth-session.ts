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

export const buildUserFromPayload = (payload: any): User => ({
  email: payload.email,
  sub: payload.sub,
  username: payload["cognito:username"],
  name: payload.name || payload.email.split("@")[0],
})

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

