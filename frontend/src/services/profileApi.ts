import { apiClient } from './client'
import type { ChangePasswordRequest, HeatmapResponse, UpdateProfileRequest, User } from '@/types/api'

export const profileApi = {
  update: (data: UpdateProfileRequest) =>
    apiClient.put<User>('/profile', data).then((r) => r.data),
  changePassword: (data: ChangePasswordRequest) =>
    apiClient.put('/profile/password', data).then(() => undefined),
  getHeatmap: () => apiClient.get<HeatmapResponse>('/profile/heatmap').then((r) => r.data.heatmap),
}
