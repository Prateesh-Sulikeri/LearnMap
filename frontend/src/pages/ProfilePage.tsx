import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, Loader2, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { profileApi } from '@/services/profileApi'
import { dashboardApi } from '@/services/dashboardApi'
import { uploadsApi } from '@/services/uploadsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { formatOrdinalDate } from '@/utils/date'
import { resolveAssetUrl } from '@/utils/url'
import { SOCIAL_PLATFORMS } from '@/utils/socialPlatforms'
import type { SocialPlatform } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileStatCard } from '@/components/profile/ProfileStatCard'
import { ContributionHeatmap } from '@/components/profile/ContributionHeatmap'

const urlOrEmpty = z.string().refine((v) => v === '' || /^https?:\/\//.test(v), { message: 'Must be a valid URL' })

const profileFormSchema = z.object({
  displayName: z.string().min(1, 'Tell us what to call you'),
  avatarUrl: urlOrEmpty,
  username: z
    .string()
    .refine((v) => v === '' || /^[a-z0-9][a-z0-9_-]{2,29}$/.test(v), {
      message: '3-30 characters: lowercase letters, numbers, underscores, hyphens',
    }),
  bio: z.string().max(280, 'Keep it under 280 characters'),
  isPublic: z.boolean(),
  linkedin: urlOrEmpty,
  github: urlOrEmpty,
  instagram: urlOrEmpty,
  x: urlOrEmpty,
  leetcode: urlOrEmpty,
  portfolio: urlOrEmpty,
})
type ProfileFormValues = z.infer<typeof profileFormSchema>

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
type PasswordFormValues = z.infer<typeof passwordFormSchema>

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })
  const { data: heatmap } = useQuery({ queryKey: ['profile-heatmap'], queryFn: profileApi.getHeatmap })
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: user?.display_name ?? '',
      avatarUrl: user?.avatar_url ?? '',
      username: user?.username ?? '',
      bio: user?.bio ?? '',
      isPublic: user?.is_public ?? true,
      linkedin: user?.social_links.linkedin ?? '',
      github: user?.social_links.github ?? '',
      instagram: user?.social_links.instagram ?? '',
      x: user?.social_links.x ?? '',
      leetcode: user?.social_links.leetcode ?? '',
      portfolio: user?.social_links.portfolio ?? '',
    },
  })
  const avatarUrlValue = profileForm.watch('avatarUrl')
  const usernameValue = profileForm.watch('username')
  const isPublicValue = profileForm.watch('isPublic')

  const updateProfile = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const socialLinks: Partial<Record<SocialPlatform, string>> = {}
      for (const platform of SOCIAL_PLATFORMS) {
        socialLinks[platform.key] = values[platform.key]
      }
      return profileApi.update({
        display_name: values.displayName,
        avatar_url: values.avatarUrl || undefined,
        username: values.username,
        bio: values.bio,
        is_public: values.isPublic,
        social_links: socialLinks,
      })
    },
    onSuccess: (updated) => {
      updateUser(updated)
      toast.success('Profile updated')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => uploadsApi.uploadImage(file),
    onSuccess: (data) => {
      profileForm.setValue('avatarUrl', data.url, { shouldValidate: true, shouldDirty: true })
      toast.success('Photo uploaded — click Save changes to apply it')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema) })

  const changePassword = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      profileApi.changePassword({ current_password: values.currentPassword, new_password: values.newPassword }),
    onSuccess: () => {
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password changed')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const shareUrl = usernameValue ? `${window.location.origin}/u/${usernameValue}` : null

  const copyShareLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <ProfileStatCard user={user} dashboard={dashboard} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Activity</CardTitle>
          <CardDescription>Every day you&apos;ve logged a study session, over the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionHeatmap data={heatmap ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Profile</CardTitle>
          <CardDescription>
            {user.email} · Joined {formatOrdinalDate(user.created_at)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => void profileForm.handleSubmit((v) => updateProfile.mutate(v))(e)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="profile-display-name">Display name</Label>
              <Input id="profile-display-name" {...profileForm.register('displayName')} />
              {profileForm.formState.errors.displayName && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.displayName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-avatar-url">Avatar</Label>
              <div className="flex items-center gap-3">
                {avatarUrlValue ? (
                  <img
                    src={resolveAssetUrl(avatarUrlValue)}
                    alt=""
                    className="size-11 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
                  />
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-1 ring-foreground/10">
                    None
                  </div>
                )}
                <Input id="profile-avatar-url" placeholder="https://…" {...profileForm.register('avatarUrl')} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={uploadAvatar.isPending}
                  onClick={() => avatarFileInputRef.current?.click()}
                >
                  {uploadAvatar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Upload
                </Button>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadAvatar.mutate(file)
                    e.target.value = ''
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Paste a link to a profile image already hosted somewhere (e.g. Gravatar), or upload a photo directly.
              </p>
              {profileForm.formState.errors.avatarUrl && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.avatarUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-username">Username</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">learnmap.app/u/</span>
                <Input id="profile-username" placeholder="yourname" {...profileForm.register('username')} />
              </div>
              {profileForm.formState.errors.username && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea id="profile-bio" rows={3} placeholder="A short line about what you're learning…" {...profileForm.register('bio')} />
              {profileForm.formState.errors.bio && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.bio.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Socials</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, placeholder }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <Input placeholder={placeholder} aria-label={label} {...profileForm.register(key)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Public profile</p>
                <p className="text-xs text-muted-foreground">
                  {isPublicValue ? 'Anyone with your link can view your profile.' : 'Your profile is private.'}
                </p>
              </div>
              <Switch
                checked={isPublicValue}
                onCheckedChange={(checked) => profileForm.setValue('isPublic', checked, { shouldDirty: true })}
              />
            </div>

            {shareUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 pl-3">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{shareUrl}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void copyShareLink()}>
                  {linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {linkCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Change password</CardTitle>
          <CardDescription>You&apos;ll stay logged in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => void passwordForm.handleSubmit((v) => changePassword.mutate(v))(e)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register('currentPassword')}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register('newPassword')}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register('confirmPassword')}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
