import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Flame, UserRound } from 'lucide-react'
import { publicProfileApi } from '@/services/publicProfileApi'
import { resolveAssetUrl } from '@/utils/url'
import { formatOrdinalDate } from '@/utils/date'
import { SOCIAL_PLATFORMS } from '@/utils/socialPlatforms'
import { StreakRankBadge } from '@/components/profile/StreakRankBadge'
import { ContributionHeatmap } from '@/components/profile/ContributionHeatmap'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

// Deliberately outside AppLayout/ProtectedRoute — this is the one page in
// the app meant to be viewed by anyone with the link, logged in or not.
export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => publicProfileApi.getByUsername(username ?? ''),
    enabled: Boolean(username),
    retry: false,
  })

  const activeDays = profile?.heatmap.filter((d) => d.hours > 0).length ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent/60 via-background to-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {isLoading ? (
          <div className="space-y-4 rounded-3xl border border-border bg-card p-8 shadow-sm">
            <Skeleton className="mx-auto size-24 rounded-full" />
            <Skeleton className="mx-auto h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError || !profile ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card py-16 text-center shadow-sm">
            <UserRound className="size-10 text-muted-foreground" />
            <h1 className="font-heading text-lg font-semibold">Profile not found</h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              This profile doesn&apos;t exist, or its owner has kept it private.
            </p>
          </div>
        ) : (
          <>
            {/* Hero — a cover band with the avatar overlapping its bottom edge,
                rather than one flat gradient blob, so it reads as a proper
                profile page instead of a minimal stat card. */}
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="h-28 bg-gradient-to-r from-primary/70 via-primary to-accent-hover sm:h-32" />
              <div className="-mt-14 flex flex-col items-center px-6 pb-8 text-center sm:-mt-16">
                {profile.avatar_url ? (
                  <img
                    src={resolveAssetUrl(profile.avatar_url)}
                    alt=""
                    className="size-28 rounded-full object-cover ring-4 ring-card sm:size-32"
                  />
                ) : (
                  <div className="flex size-28 items-center justify-center rounded-full bg-primary font-heading text-3xl font-semibold text-primary-foreground ring-4 ring-card sm:size-32">
                    {profile.display_name.charAt(0).toUpperCase()}
                  </div>
                )}

                <p className="mt-3 font-heading text-xl font-semibold sm:text-2xl">{profile.display_name}</p>
                <p className="text-xs text-muted-foreground">Joined {formatOrdinalDate(profile.joined_at)}</p>

                {profile.bio && <p className="mt-3 max-w-md text-sm text-foreground">{profile.bio}</p>}

                {Object.keys(profile.social_links).length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {SOCIAL_PLATFORMS.filter(({ key }) => profile.social_links[key]).map(({ key, label, icon: Icon }) => (
                      <Tooltip key={key}>
                        <TooltipTrigger
                          render={
                            <a
                              href={profile.social_links[key]}
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label={label}
                              className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/10 transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
                            />
                          }
                        >
                          <Icon className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}

                {/* Stat tiles — streak/active-days only, never anything that
                    reveals learning-item content (ADR-027). */}
                <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1 rounded-2xl bg-muted px-4 py-4 ring-1 ring-foreground/10">
                    <StreakRankBadge streakDays={profile.current_streak} size="md" />
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-muted px-4 py-4 ring-1 ring-foreground/10">
                    <CalendarDays className="size-5 text-muted-foreground" />
                    <p className="font-mono text-xl font-semibold leading-none">{activeDays}</p>
                    <p className="text-xs text-muted-foreground">active days</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="size-4 text-warning" />
                <h2 className="font-heading text-sm font-semibold">Activity</h2>
              </div>
              <ContributionHeatmap data={profile.heatmap} />
            </div>
          </>
        )}

        <div className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted-foreground">
          <span>Track what you&apos;re learning on</span>
          <Link to="/login" className="font-medium text-foreground hover:underline">
            LearnMap.app
          </Link>
        </div>
      </div>
    </div>
  )
}
