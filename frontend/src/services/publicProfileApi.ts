import { apiClient } from './client'
import type { PublicProfile } from '@/types/api'

export const publicProfileApi = {
  getByUsername: (username: string) =>
    apiClient.get<PublicProfile>(`/public/profiles/${encodeURIComponent(username)}`).then((r) => r.data),
}
