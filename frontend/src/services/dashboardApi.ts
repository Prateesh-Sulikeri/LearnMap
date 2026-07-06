import { apiClient } from './client'
import type { Dashboard, StatsRange, StatsResponse } from '@/types/api'

export const dashboardApi = {
  get: () => apiClient.get<Dashboard>('/dashboard').then((r) => r.data),
  getStats: (range: StatsRange) =>
    apiClient.get<StatsResponse>('/stats', { params: { range } }).then((r) => r.data),
}
