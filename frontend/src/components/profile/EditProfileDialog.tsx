import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'
import { profileApi } from '@/services/profileApi'
import { uploadsApi } from '@/services/uploadsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { resolveAssetUrl } from '@/utils/url'
import { SOCIAL_PLATFORMS } from '@/utils/socialPlatforms'
import type { SocialPlatform, User } from '@/types/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

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

interface EditProfileDialogProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (user: User) => void
}

export function EditProfileDialog({ user, open, onOpenChange, onUpdated }: EditProfileDialogProps) {
  const avatarFileInputRef = useRef<HTMLInputElement>(null)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: user.display_name,
      avatarUrl: user.avatar_url ?? '',
      username: user.username ?? '',
      bio: user.bio ?? '',
      isPublic: user.is_public,
      linkedin: user.social_links.linkedin ?? '',
      github: user.social_links.github ?? '',
      instagram: user.social_links.instagram ?? '',
      x: user.social_links.x ?? '',
      leetcode: user.social_links.leetcode ?? '',
      portfolio: user.social_links.portfolio ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      profileForm.reset({
        displayName: user.display_name,
        avatarUrl: user.avatar_url ?? '',
        username: user.username ?? '',
        bio: user.bio ?? '',
        isPublic: user.is_public,
        linkedin: user.social_links.linkedin ?? '',
        github: user.social_links.github ?? '',
        instagram: user.social_links.instagram ?? '',
        x: user.social_links.x ?? '',
        leetcode: user.social_links.leetcode ?? '',
        portfolio: user.social_links.portfolio ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user])

  const avatarUrlValue = profileForm.watch('avatarUrl')
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
      onUpdated(updated)
      toast.success('Profile updated')
      onOpenChange(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit profile</DialogTitle>
          <DialogDescription>Update how you appear across LearnMap, including your public profile.</DialogDescription>
        </DialogHeader>

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

          <DialogFooter>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
