import { apiClient } from './client'
import type { ConfirmSessionRequest, CreateSessionRequest, SessionFilter, StudySession } from '@/types/api'

export const sessionsApi = {
  list: (filter?: SessionFilter) =>
    apiClient
      .get<StudySession[]>('/sessions', { params: filter })
      .then((r) => r.data),
  create: (data: CreateSessionRequest) =>
    apiClient.post<StudySession>('/sessions', data).then((r) => r.data),
  confirm: (id: string, data: ConfirmSessionRequest) =>
    apiClient.post<StudySession>(`/sessions/${id}/confirm`, data).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/sessions/${id}`).then(() => undefined),
}
