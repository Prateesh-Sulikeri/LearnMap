// Types mirroring the backend's REST contract (docs/ARCHITECTURE.md §5).
// Kept in lockstep with the Go DTOs by hand for now — this file is the
// single source of truth on the frontend for what the API returns/expects.

export type LearningItemStatus = 'not_started' | 'in_progress' | 'completed'

export type SocialPlatform = 'linkedin' | 'instagram' | 'github' | 'portfolio' | 'x' | 'leetcode'

export interface User {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  username: string | null
  bio: string | null
  social_links: Partial<Record<SocialPlatform, string>>
  is_public: boolean
  created_at: string
}

export interface AuthResponse {
  user: User
  access_token: string
}

export interface RefreshResponse {
  access_token: string
}

export interface RegisterRequest {
  email: string
  password: string
  display_name: string
  invite_code: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LearningItem {
  id: string
  parent_id: string | null
  title: string
  description: string | null
  status: LearningItemStatus
  deadline: string | null
  position: number
  is_favorite: boolean
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface CreateItemRequest {
  parent_id?: string
  title: string
  description?: string
  deadline?: string
}

export interface UpdateItemRequest {
  title?: string
  description?: string
  deadline?: string
}

export interface SetStatusRequest {
  status: LearningItemStatus
}

export interface DeleteItemResponse {
  deleted_count: number
}

export interface UploadImageResponse {
  url: string
}

export interface TrashedItem {
  id: string
  parent_id: string | null
  title: string
  description: string | null
  status: LearningItemStatus
  deleted_at: string
}

export interface RestoreItemResponse {
  restored_count: number
}

export interface StudySession {
  id: string
  /** Primary/first topic — kept for back-compat, prefer learning_item_ids. */
  learning_item_id: string
  /** Every topic this session covers (a session may span more than one). */
  learning_item_ids: string[]
  hours: number
  notes: string | null
  session_date: string
  scheduled_start: string | null
  scheduled_end: string | null
  confirmed_at: string | null
  created_at: string
}

export interface CreateSessionRequest {
  learning_item_ids: string[]
  hours?: number
  notes?: string
  session_date?: string
  scheduled_start?: string
  scheduled_end?: string
}

export interface ConfirmSessionRequest {
  hours?: number
  notes?: string
}

export interface SessionFilter {
  item_id?: string
  from?: string
  to?: string
}

export interface DailyHoursPoint {
  date: string
  hours: number
}

export interface TopicPoint {
  learning_item_id: string
  title: string
  hours: number
}

export interface ActivityPoint {
  type: 'item_updated' | 'session_logged'
  title: string
  timestamp: string
}

export interface Dashboard {
  study_hours_this_week: number
  current_streak: number
  completed_items: number
  pending_items: number
  completion_percentage: number
  weekly_hours_chart: DailyHoursPoint[]
  top_topics: TopicPoint[]
  todays_sessions: StudySession[]
  recent_activity: ActivityPoint[]
}

export type StatsRange = 'week' | 'month' | 'year'

export interface StatsPoint {
  period: string
  hours: number
}

export interface StatsResponse {
  range: StatsRange
  points: StatsPoint[]
}

export interface UpdateProfileRequest {
  display_name?: string
  avatar_url?: string
  username?: string
  bio?: string
  social_links?: Partial<Record<SocialPlatform, string>>
  is_public?: boolean
}

export interface PublicProfile {
  display_name: string
  avatar_url: string | null
  bio: string | null
  social_links: Partial<Record<SocialPlatform, string>>
  joined_at: string
  current_streak: number
  heatmap: DailyHoursPoint[]
}

export interface HeatmapResponse {
  heatmap: DailyHoursPoint[]
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}
