import type { StudySession } from '@/types/api'

export type SessionStatus = 'upcoming' | 'in_progress' | 'expired' | 'logged'

/**
 * A scheduled session moves upcoming -> in_progress -> expired as real time
 * passes; confirming it (at any point from in_progress onward) moves it to
 * logged. A retroactively-logged session (no scheduled_end, or already
 * confirmed) is always logged.
 */
export function getSessionStatus(session: StudySession): SessionStatus {
  if (!session.scheduled_end || session.confirmed_at) {
    return 'logged'
  }
  const now = new Date()
  const end = new Date(session.scheduled_end)
  if (session.scheduled_start && now < new Date(session.scheduled_start)) {
    return 'upcoming'
  }
  return now > end ? 'expired' : 'in_progress'
}

/** Confirmation is only meaningful once the session has actually started. */
export function canConfirmSession(session: StudySession): boolean {
  const status = getSessionStatus(session)
  return status === 'in_progress' || status === 'expired'
}
