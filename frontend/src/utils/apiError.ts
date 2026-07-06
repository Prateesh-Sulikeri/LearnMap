import axios from 'axios'
import type { ApiErrorBody } from '@/types/api'

/** Extracts a user-displayable message from a failed API call, falling back to a generic one. */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined
    if (body?.error?.message) return body.error.message
  }
  return 'Something went wrong. Please try again.'
}
