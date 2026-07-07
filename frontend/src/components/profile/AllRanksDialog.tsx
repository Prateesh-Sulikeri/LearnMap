import { RANKS } from '@/utils/streakRank'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface AllRanksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStreak: number
}

function rankRangeLabel(minDays: number, nextMinDays: number | undefined): string {
  if (nextMinDays === undefined) return `${minDays}+ day streak`
  if (minDays === nextMinDays - 1) return `${minDays} day streak`
  return `${minDays}-${nextMinDays - 1} day streak`
}

export function AllRanksDialog({ open, onOpenChange, currentStreak }: AllRanksDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Streak ranks</DialogTitle>
          <DialogDescription>Keep your streak alive to climb the ranks.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1">
          {RANKS.map((rank, i) => {
            const nextMinDays = RANKS[i + 1]?.minDays
            const isCurrent = currentStreak >= rank.minDays && (nextMinDays === undefined || currentStreak < nextMinDays)
            const Icon = rank.icon
            return (
              <li
                key={rank.name}
                className={cn('flex items-center gap-3 rounded-lg p-2', isCurrent && 'ring-1 ring-foreground/10 bg-accent')}
              >
                <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', rank.bg)}>
                  <Icon className={cn('size-5', rank.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold', rank.color)}>{rank.name}</p>
                  <p className="text-xs text-muted-foreground">{rankRangeLabel(rank.minDays, nextMinDays)}</p>
                </div>
                {isCurrent && <span className="shrink-0 text-xs font-medium text-muted-foreground">You are here</span>}
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
