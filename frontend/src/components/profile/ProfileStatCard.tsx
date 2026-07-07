import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { Download, Flame, Medal, Trophy } from 'lucide-react'
import type { Dashboard, User } from '@/types/api'
import { resolveAssetUrl } from '@/utils/url'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { StreakRankBadge } from '@/components/profile/StreakRankBadge'
import { AllRanksDialog } from '@/components/profile/AllRanksDialog'

interface ProfileStatCardProps {
  user: User
  dashboard?: Dashboard
}

// A shareable "wrapped"-style stat card — exported client-side as a PNG via
// html-to-image, no server round trip needed. Best-effort only: a
// cross-origin avatar_url without permissive CORS headers may render blank
// in the exported PNG even though it displays fine on-screen (a known
// limitation of canvas-based image export, not something worth building a
// server-side image proxy to work around for this MVP).
export function ProfileStatCard({ user, dashboard }: ProfileStatCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [allRanksOpen, setAllRanksOpen] = useState(false)
  const topTopic = dashboard?.top_topics[0]
  const currentStreak = dashboard?.current_streak ?? 0

  const handleExport = async () => {
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
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div
          ref={cardRef}
          className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-accent via-background to-accent p-8 text-center"
        >
          {user.avatar_url ? (
            <img
              src={resolveAssetUrl(user.avatar_url)}
              alt=""
              className="size-20 rounded-full object-cover ring-4 ring-background"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-primary font-heading text-2xl font-semibold text-primary-foreground ring-4 ring-background">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-heading text-lg font-semibold">{user.display_name}</p>
            <p className="text-xs text-muted-foreground">learnmap.app</p>
          </div>

          <StreakRankBadge streakDays={currentStreak} size="lg" showProgress onClick={() => setAllRanksOpen(true)} />

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
      </CardContent>
      <CardFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full sm:flex-1" onClick={() => setAllRanksOpen(true)}>
          <Medal className="size-4" />
          View all ranks
        </Button>
        <Button className="w-full sm:flex-1" onClick={() => void handleExport()}>
          <Download className="size-4" />
          Export as image
        </Button>
      </CardFooter>

      <AllRanksDialog open={allRanksOpen} onOpenChange={setAllRanksOpen} currentStreak={currentStreak} />
    </Card>
  )
}
