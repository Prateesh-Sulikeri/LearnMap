import { apiClient } from './client'
import type { UploadImageResponse } from '@/types/api'

export const uploadsApi = {
  // Don't set Content-Type manually — axios sets the correct
  // multipart/form-data boundary automatically for a FormData body.
  uploadImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<UploadImageResponse>('/uploads', formData).then((r) => r.data)
  },
}
