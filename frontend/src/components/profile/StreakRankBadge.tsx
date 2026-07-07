import { getStreakRank, nextStreakRank } from '@/utils/streakRank'
import { cn } from '@/lib/utils'

interface StreakRankBadgeProps {
  streakDays: number
  size?: 'sm' | 'md' | 'lg'
  /** Shows a "N days to <next rank>" hint below the badge — the incentive-to-stay-consistent bit. */
  showProgress?: boolean
  /** When provided, the whole badge becomes a button (e.g. opening the all-ranks reference) with a visible "View all ranks" hint, not just a hover affordance. */
  onClick?: () => void
}

const SIZE_CLASSES = {
  sm: { badge: 'size-8', icon: 'size-4' },
  md: { badge: 'size-12', icon: 'size-6' },
  lg: { badge: 'size-16', icon: 'size-8' },
}

export function StreakRankBadge({ streakDays, size = 'md', showProgress = false, onClick }: StreakRankBadgeProps) {
  const rank = getStreakRank(streakDays)
  const next = nextStreakRank(streakDays)
  const Icon = rank.icon
  const { badge, icon } = SIZE_CLASSES[size]

  const content = (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn('flex items-center justify-center rounded-full ring-4 ring-background', badge, rank.bg)}>
        <Icon className={cn(icon, rank.color)} />
      </div>
      <span className={cn('font-heading text-sm font-semibold', rank.color)}>{rank.name}</span>
      {showProgress && (
        <span className="text-xs text-muted-foreground">
          {next ? `${next.minDays - streakDays} day${next.minDays - streakDays === 1 ? '' : 's'} to ${next.name}` : 'Top rank!'}
        </span>
      )}
    </div>
  )

  // Kept purely visual (no "tap me" text baked in) since this badge also
  // renders inside the card that gets exported as a static PNG — an
  // instructional hint would look broken once shared.
  if (!onClick) return content

  return (
    <button type="button" onClick={onClick} className="rounded-lg transition-opacity duration-150 hover:opacity-80">
      {content}
    </button>
  )
}
