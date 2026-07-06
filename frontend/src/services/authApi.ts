import { apiClient } from './client'
import type { AuthResponse, LoginRequest, RefreshResponse, RegisterRequest, User } from '@/types/api'

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data),
  refresh: () =>
    apiClient.post<RefreshResponse>('/auth/refresh').then((r) => r.data),
  logout: () => apiClient.post('/auth/logout').then(() => undefined),
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
}
