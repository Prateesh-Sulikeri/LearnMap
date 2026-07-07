import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, setAccessToken } from './tokenStore'

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

// The backend's origin with no path — used to resolve root-relative URLs
// (e.g. uploaded image paths returned by POST /uploads) into absolute ones
// for <img src>, since those aren't fetched through apiClient's baseURL.
export const API_ORIGIN: string = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

// The only Axios instance in the app — every service file goes through this,
// per frontend-agent's charter ("never call axios/fetch directly from a
// component"). withCredentials is required so the httpOnly refresh cookie
// travels with every request.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// AuthProvider registers this so a failed silent-refresh can trigger a full
// logout (clear user state + TanStack Query cache) without client.ts needing
// to import React/routing concerns.
let onAuthFailure: (() => void) | null = null
export function registerAuthFailureHandler(handler: () => void): void {
  onAuthFailure = handler
}

// Dedupe concurrent 401s into a single refresh call rather than firing one
// refresh request per failed request.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access_token: string }>(`${API_BASE_URL}/auth/refresh`, null, {
        withCredentials: true,
      })
      .then((res) => {
        setAccessToken(res.data.access_token)
        return res.data.access_token
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/')

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true
      const newToken = await refreshAccessToken()
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      }
      onAuthFailure?.()
    }

    return Promise.reject(error)
  },
)
