import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarClock, Check, CheckCircle2, Download, KeyRound, ListTodo, Medal, Pencil, Share2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { profileApi } from '@/services/profileApi'
import { dashboardApi } from '@/services/dashboardApi'
import { formatOrdinalDate } from '@/utils/date'
import { SOCIAL_PLATFORMS } from '@/utils/socialPlatforms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { StatCard } from '@/components/StatCard'
import { ProfileStatCard, type ProfileStatCardHandle } from '@/components/profile/ProfileStatCard'
import { ContributionHeatmap } from '@/components/profile/ContributionHeatmap'
import { AllRanksDialog } from '@/components/profile/AllRanksDialog'
import { EditProfileDialog } from '@/components/profile/EditProfileDialog'
import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })
  const { data: heatmap } = useQuery({ queryKey: ['profile-heatmap'], queryFn: profileApi.getHeatmap })
  const statCardRef = useRef<ProfileStatCardHandle>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [allRanksOpen, setAllRanksOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  if (!user) return null

  const shareUrl = user.username ? `${window.location.origin}/u/${user.username}` : null

  const copyShareLink = async () => {
    if (!shareUrl) {
      toast.info('Set a username first — that becomes your shareable link.')
      setEditOpen(true)
      return
    }
    await navigator.clipboard.writeText(shareUrl)
    setLinkCopied(true)
    toast.success('Link copied')
    setTimeout(() => setLinkCopied(false), 1500)
  }

  const activeSocials = SOCIAL_PLATFORMS.filter(({ key }) => user.social_links[key])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        {/* Left column: identity + achievements, ONE avatar total — stays in
            view on desktop while the right column can grow without dragging
            the whole page into one long scroll.
            min-w-0 on both grid items: without it, an unwrappable child (the
            share URL below has no spaces to break on) forces the implicit
            grid track to grow past the viewport on mobile — the same class
            of bug already hit once in this codebase (see ARCHITECTURE.md). */}
        <div className="min-w-0 space-y-6 lg:sticky lg:top-6">
          <Card>
            <CardContent className="flex min-w-0 flex-col items-center gap-3 pt-2 text-center">
              <ProfileStatCard ref={statCardRef} user={user} dashboard={dashboard} onBadgeClick={() => setAllRanksOpen(true)} />

              {user.bio && <p className="w-full text-sm break-words text-foreground">{user.bio}</p>}

              {activeSocials.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {activeSocials.map(({ key, label, icon: Icon }) => (
                    <a
                      key={key}
                      href={user.social_links[key]}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={label}
                      className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/10 transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
                    >
                      <Icon className="size-3.5" />
                    </a>
                  ))}
                </div>
              )}

              <div className="flex w-full gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  Edit Profile
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => void copyShareLink()}>
                  {linkCopied ? <Check className="size-4" /> : <Share2 className="size-4" />}
                  {linkCopied ? 'Copied' : 'Share'}
                </Button>
              </div>

              <div className="flex w-full gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setAllRanksOpen(true)}>
                  <Medal className="size-4" />
                  View all ranks
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => void statCardRef.current?.exportAsImage()}>
                  <Download className="size-4" />
                  Export image
                </Button>
              </div>

              <Separator />

              <div className="w-full space-y-1.5 text-left text-xs break-words text-muted-foreground">
                <p className="break-all">{user.email}</p>
                <p>Joined {formatOrdinalDate(user.created_at)}</p>
                {shareUrl && <p className="break-all">{shareUrl}</p>}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-0 text-muted-foreground"
                onClick={() => setPasswordOpen(true)}
              >
                <KeyRound className="size-4" />
                Change password
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column: real stats, not empty space — top topics and a
            heatmap, both fed by data already being fetched on this page. */}
        <div className="min-w-0 space-y-6">
          {dashboard && (
            // auto-fit/minmax reflows based on the actual available width —
            // not just viewport size — since this grid competes with the
            // sticky left column and sidebar nav for space, a plain sm:/md:
            // breakpoint could still land on a too-narrow in-between width.
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
              <StatCard label="Hours this week" value={dashboard.study_hours_this_week.toFixed(1)} icon={CalendarClock} />
              <StatCard label="Completed" value={String(dashboard.completed_items)} icon={CheckCircle2} />
              <StatCard label="Pending" value={String(dashboard.pending_items)} icon={ListTodo} />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Top topics</CardTitle>
            </CardHeader>
            <CardContent>
              {!dashboard || dashboard.top_topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">Log a session to see your top topics here.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboard.top_topics.map((topic) => (
                    <li key={topic.learning_item_id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{topic.title}</span>
                      <span className="shrink-0 font-mono text-muted-foreground">{topic.hours.toFixed(1)}h</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Activity</CardTitle>
              <CardDescription>Every day you&apos;ve logged a study session, over the last 12 months.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContributionHeatmap data={heatmap ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>

      <EditProfileDialog user={user} open={editOpen} onOpenChange={setEditOpen} onUpdated={updateUser} />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <AllRanksDialog open={allRanksOpen} onOpenChange={setAllRanksOpen} currentStreak={dashboard?.current_streak ?? 0} />
    </div>
  )
}
