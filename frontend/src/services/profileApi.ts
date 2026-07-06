import { apiClient } from './client'
import type { ChangePasswordRequest, UpdateProfileRequest, User } from '@/types/api'

export const profileApi = {
  update: (data: UpdateProfileRequest) =>
    apiClient.put<User>('/profile', data).then((r) => r.data),
  changePassword: (data: ChangePasswordRequest) =>
    apiClient.put('/profile/password', data).then(() => undefined),
}
