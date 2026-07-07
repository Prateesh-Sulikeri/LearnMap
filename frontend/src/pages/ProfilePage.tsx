import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, KeyRound, Pencil, Share2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { profileApi } from '@/services/profileApi'
import { dashboardApi } from '@/services/dashboardApi'
import { formatOrdinalDate } from '@/utils/date'
import { resolveAssetUrl } from '@/utils/url'
import { SOCIAL_PLATFORMS } from '@/utils/socialPlatforms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProfileStatCard } from '@/components/profile/ProfileStatCard'
import { ContributionHeatmap } from '@/components/profile/ContributionHeatmap'
import { EditProfileDialog } from '@/components/profile/EditProfileDialog'
import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })
  const { data: heatmap } = useQuery({ queryKey: ['profile-heatmap'], queryFn: profileApi.getHeatmap })
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
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
        {/* Left column: identity + achievements — stays in view on desktop
            while the right column can grow (heatmap, future stats) without
            dragging the whole page into one long form-like scroll.
            min-w-0 on both grid items: without it, an unwrappable child (the
            share URL below has no spaces to break on) forces the implicit
            grid track to grow past the viewport on mobile — the same class
            of bug already hit once in this codebase (see ARCHITECTURE.md). */}
        <div className="min-w-0 space-y-6 lg:sticky lg:top-6">
          <Card>
            <CardContent className="flex min-w-0 flex-col items-center gap-3 pt-2 text-center">
              {user.avatar_url ? (
                <img
                  src={resolveAssetUrl(user.avatar_url)}
                  alt=""
                  className="size-20 shrink-0 rounded-full object-cover ring-4 ring-accent"
                />
              ) : (
                <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-2xl font-semibold text-primary-foreground ring-4 ring-accent">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 max-w-full">
                <p className="truncate font-heading text-lg font-semibold">{user.display_name}</p>
                {user.username && <p className="truncate text-sm text-muted-foreground">@{user.username}</p>}
              </div>
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

              <div className="flex w-full gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  Edit Profile
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => void copyShareLink()}>
                  {linkCopied ? <Check className="size-4" /> : <Share2 className="size-4" />}
                  {linkCopied ? 'Copied' : 'Share'}
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

          <ProfileStatCard user={user} dashboard={dashboard} />
        </div>

        {/* Right column: activity — the part that actually grows over time. */}
        <div className="min-w-0 space-y-6">
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
    </div>
  )
}
