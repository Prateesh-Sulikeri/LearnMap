import { apiClient } from './client'
import type {
  CreateItemRequest,
  DeleteItemResponse,
  LearningItem,
  RestoreItemResponse,
  SetStatusRequest,
  TrashedItem,
  UpdateItemRequest,
} from '@/types/api'

export const itemsApi = {
  list: () => apiClient.get<LearningItem[]>('/items').then((r) => r.data),
  create: (data: CreateItemRequest) =>
    apiClient.post<LearningItem>('/items', data).then((r) => r.data),
  update: (id: string, data: UpdateItemRequest) =>
    apiClient.put<LearningItem>(`/items/${id}`, data).then((r) => r.data),
  setStatus: (id: string, data: SetStatusRequest) =>
    apiClient.patch<LearningItem>(`/items/${id}/status`, data).then((r) => r.data),
  remove: (id: string) =>
    apiClient.delete<DeleteItemResponse>(`/items/${id}`).then((r) => r.data),
  listTrash: () => apiClient.get<TrashedItem[]>('/items/trash').then((r) => r.data),
  restore: (id: string) =>
    apiClient.post<RestoreItemResponse>(`/items/${id}/restore`).then((r) => r.data),
}
