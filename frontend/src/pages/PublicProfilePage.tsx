import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { publicProfileApi } from '@/services/publicProfileApi'
import { resolveAssetUrl } from '@/utils/url'
import { formatOrdinalDate } from '@/utils/date'
import { SOCIAL_PLATFORMS } from '@/utils/socialPlatforms'
import { StreakRankBadge } from '@/components/profile/StreakRankBadge'
import { ContributionHeatmap } from '@/components/profile/ContributionHeatmap'
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        {isLoading ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
            <Skeleton className="mx-auto size-20 rounded-full" />
            <Skeleton className="mx-auto h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError || !profile ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <UserRound className="size-10 text-muted-foreground" />
            <h1 className="font-heading text-lg font-semibold">Profile not found</h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              This profile doesn&apos;t exist, or its owner has kept it private.
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-gradient-to-br from-accent via-background to-accent p-8 text-center">
            {profile.avatar_url ? (
              <img
                src={resolveAssetUrl(profile.avatar_url)}
                alt=""
                className="mx-auto size-20 rounded-full object-cover ring-4 ring-background"
              />
            ) : (
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary font-heading text-2xl font-semibold text-primary-foreground ring-4 ring-background">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-heading text-lg font-semibold">{profile.display_name}</p>
              <p className="text-xs text-muted-foreground">Joined {formatOrdinalDate(profile.joined_at)}</p>
            </div>

            {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}

            {Object.keys(profile.social_links).length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {SOCIAL_PLATFORMS.filter(({ key }) => profile.social_links[key]).map(({ key, label, icon: Icon }) => (
                  <a
                    key={key}
                    href={profile.social_links[key]}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={label}
                    className="flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-foreground/10 transition-colors duration-150 hover:text-foreground"
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            )}

            <StreakRankBadge streakDays={profile.current_streak} size="lg" showProgress />

            <div className="rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10">
              <ContributionHeatmap data={profile.heatmap} />
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-foreground hover:underline">
            LearnMap.app
          </Link>{' '}
          — track what you&apos;re learning.
        </p>
      </div>
    </div>
  )
}
