import { Circle, Crown, Flame, Gem, Sparkle, Star, Zap, type LucideIcon } from 'lucide-react'

export interface StreakRank {
  name: string
  icon: LucideIcon
  minDays: number
  color: string
  bg: string
}

// A fire-themed progression matching the streak stat's existing Flame
// icon — each tier gets its own icon + color so the badges read as
// genuinely distinct achievements, not just one icon recolored.
const RANKS: StreakRank[] = [
  { name: 'Unranked', icon: Circle, minDays: 0, color: 'text-muted-foreground', bg: 'bg-muted' },
  { name: 'Spark', icon: Sparkle, minDays: 1, color: 'text-amber-500', bg: 'bg-amber-500/15' },
  { name: 'Ember', icon: Flame, minDays: 3, color: 'text-orange-500', bg: 'bg-orange-500/15' },
  { name: 'Blaze', icon: Zap, minDays: 7, color: 'text-red-500', bg: 'bg-red-500/15' },
  { name: 'Inferno', icon: Star, minDays: 14, color: 'text-rose-600', bg: 'bg-rose-600/15' },
  { name: 'Legend', icon: Crown, minDays: 30, color: 'text-amber-600', bg: 'bg-amber-600/15' },
  { name: 'Mythic', icon: Gem, minDays: 60, color: 'text-violet-600', bg: 'bg-violet-600/15' },
]

export function getStreakRank(streakDays: number): StreakRank {
  let rank = RANKS[0]
  for (const r of RANKS) {
    if (streakDays >= r.minDays) rank = r
  }
  return rank
}

/** The next rank up, or null if already at the top tier. */
export function nextStreakRank(streakDays: number): StreakRank | null {
  return RANKS.find((r) => r.minDays > streakDays) ?? null
}
