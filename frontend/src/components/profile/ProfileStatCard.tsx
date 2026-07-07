import { forwardRef, useImperativeHandle, useRef } from 'react'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { Flame, Trophy } from 'lucide-react'
import type { Dashboard, User } from '@/types/api'
import { resolveAssetUrl } from '@/utils/url'
import { StreakRankBadge } from '@/components/profile/StreakRankBadge'

export interface ProfileStatCardHandle {
  exportAsImage: () => Promise<void>
}

interface ProfileStatCardProps {
  user: User
  dashboard?: Dashboard
  /** Opens the all-ranks reference — the badge itself is the trigger, matching its use elsewhere. */
  onBadgeClick?: () => void
}

// The gradient "hero" block: avatar, name, streak rank, and the two headline
// stat tiles. Deliberately not wrapped in its own <Card> — this is meant to
// sit inside the caller's identity card as its top section (one avatar per
// page, not two), while still being independently exportable as a "wrapped"-
// style PNG via the imperative handle. Best-effort export only: a
// cross-origin avatar_url without permissive CORS headers may render blank
// in the exported PNG even though it displays fine on-screen (a known
// limitation of canvas-based image export).
export const ProfileStatCard = forwardRef<ProfileStatCardHandle, ProfileStatCardProps>(function ProfileStatCard(
  { user, dashboard, onBadgeClick },
  ref,
) {
  const cardRef = useRef<HTMLDivElement>(null)
  const topTopic = dashboard?.top_topics[0]
  const currentStreak = dashboard?.current_streak ?? 0

  useImperativeHandle(ref, () => ({
    exportAsImage: async () => {
      if (!cardRef.current) return
      try {
        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 })
        const link = document.createElement('a')
        link.download = `${user.display_name.trim().replace(/\s+/g, '-').toLowerCase()}-learnmap-stats.png`
        link.href = dataUrl
        link.click()
      } catch {
        toast.error("Couldn't export image — try again")
      }
    },
  }))

  return (
    <div
      ref={cardRef}
      className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-accent via-background to-accent p-8 text-center"
    >
      {user.avatar_url ? (
        <img
          src={resolveAssetUrl(user.avatar_url)}
          alt=""
          className="size-20 shrink-0 rounded-full object-cover ring-4 ring-background"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-2xl font-semibold text-primary-foreground ring-4 ring-background">
          {user.display_name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 max-w-full">
        <p className="truncate font-heading text-lg font-semibold">{user.display_name}</p>
        {user.username && <p className="truncate text-xs text-muted-foreground">@{user.username}</p>}
      </div>

      <StreakRankBadge streakDays={currentStreak} size="lg" showProgress onClick={onBadgeClick} />

      <div className="grid w-full grid-cols-2 gap-3">
        <div className="rounded-xl bg-card px-3 py-4 ring-1 ring-foreground/10">
          <Flame className="mx-auto size-5 text-warning" />
          <p className="mt-1 font-mono text-2xl font-semibold">{currentStreak}</p>
          <p className="text-xs text-muted-foreground">day streak</p>
        </div>
        <div className="rounded-xl bg-card px-3 py-4 ring-1 ring-foreground/10">
          <Trophy className="mx-auto size-5 text-primary" />
          <p className="mt-1 truncate font-heading text-sm font-semibold">{topTopic?.title ?? 'None yet'}</p>
          <p className="text-xs text-muted-foreground">most time spent</p>
        </div>
      </div>
    </div>
  )
})
