import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/services/authApi'
import { registerAuthFailureHandler } from '@/services/client'
import { setAccessToken } from '@/services/tokenStore'
import type { User } from '@/types/api'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string, inviteCode: string) => Promise<void>
  logout: () => Promise<void>
  /** Called after a profile update so the sidebar/nav reflect it immediately without a full refetch. */
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  // On logout (or a failed silent-refresh), clear both the in-memory user
  // state and the TanStack Query cache — the cache is process memory, not
  // per-user, so a second person logging into the same shared browser must
  // never see a stale fetch from whoever was logged in before.
  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    registerAuthFailureHandler(clearSession)
  }, [clearSession])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const { access_token } = await authApi.refresh()
        setAccessToken(access_token)
        const me = await authApi.me()
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const { user, access_token } = await authApi.login({ email, password })
    setAccessToken(access_token)
    setUser(user)
  }, [])

  const register = useCallback(
    async (email: string, password: string, displayName: string, inviteCode: string) => {
      const { user, access_token } = await authApi.register({
        email,
        password,
        display_name: displayName,
        invite_code: inviteCode,
      })
      setAccessToken(access_token)
      setUser(user)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const updateUser = useCallback((updated: User) => {
    setUser(updated)
  }, [])

  return (
    <AuthContext value={{ user, isLoading, isAuthenticated: user !== null, login, register, logout, updateUser }}>
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
