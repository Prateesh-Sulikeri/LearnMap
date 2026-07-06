import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getApiErrorMessage } from '@/utils/apiError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Mirrors the backend's validation (auth_handler.go registerRequest) exactly:
// email format, password min 8, display name and invite code required.
const registerSchema = z.object({
  displayName: z.string().min(1, 'Tell us what to call you'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Must be at least 8 characters'),
  inviteCode: z.string().min(1, 'Invite code is required'),
})

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null)
    try {
      await registerUser(values.email, values.password, values.displayName, values.inviteCode)
      navigate('/tree', { replace: true })
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Start your learning map</CardTitle>
        <CardDescription>Pilot access requires an invite code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input id="displayName" autoComplete="name" {...register('displayName')} />
            {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite code</Label>
            <Input id="inviteCode" autoComplete="off" {...register('inviteCode')} />
            {errors.inviteCode && <p className="text-sm text-destructive">{errors.inviteCode.message}</p>}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
