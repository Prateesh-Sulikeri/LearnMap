// The access token lives in memory only — never localStorage/sessionStorage
// — per frontend-agent's charter and ADR-010. The refresh token is an
// httpOnly cookie the browser manages entirely on its own; JS never touches it.
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}
