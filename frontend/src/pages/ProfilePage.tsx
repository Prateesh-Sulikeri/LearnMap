import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { profileApi } from '@/services/profileApi'
import { dashboardApi } from '@/services/dashboardApi'
import { uploadsApi } from '@/services/uploadsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { formatOrdinalDate } from '@/utils/date'
import { resolveAssetUrl } from '@/utils/url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileStatCard } from '@/components/profile/ProfileStatCard'

const profileFormSchema = z.object({
  displayName: z.string().min(1, 'Tell us what to call you'),
  avatarUrl: z
    .string()
    .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//.test(v), { message: 'Must be a valid URL' }),
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
  const avatarFileInputRef = useRef<HTMLInputElement>(null)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: user?.display_name ?? '', avatarUrl: user?.avatar_url ?? '' },
  })
  const avatarUrlValue = profileForm.watch('avatarUrl')

  const updateProfile = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      profileApi.update({ display_name: values.displayName, avatar_url: values.avatarUrl || undefined }),
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

  if (!user) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <ProfileStatCard user={user} dashboard={dashboard} />

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
