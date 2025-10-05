import { createFileRoute, redirect, useNavigate, isRedirect } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { setupSearchSchema } from '@/lib/search-schemas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Switch } from '@promptliano/ui'
import { useAuth } from '@/contexts/auth-context'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { normalizeAuthStatus } from '@/routes/__root'
import { useState } from 'react'
import { Alert, AlertDescription } from '@promptliano/ui'

/**
 * Setup form schema - PASSWORD REQUIRED
 */
const setupFormSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

type SetupFormData = z.infer<typeof setupFormSchema>

/**
 * Password strength indicator
 */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null

  let strength = 0
  let label = ''
  let color = ''

  if (password.length >= 6) strength++
  if (password.length >= 10) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^a-zA-Z\d]/.test(password)) strength++

  if (strength <= 2) {
    label = 'Weak'
    color = 'bg-red-500'
  } else if (strength <= 3) {
    label = 'Fair'
    color = 'bg-yellow-500'
  } else if (strength <= 4) {
    label = 'Good'
    color = 'bg-green-500'
  } else {
    label = 'Strong'
    color = 'bg-green-600'
  }

  return (
    <div className='space-y-1'>
      <div className='flex gap-1'>
        {[1, 2, 3, 4, 5].map((level) => (
          <div key={level} className={`h-1 flex-1 rounded ${level <= strength ? color : 'bg-muted'}`} />
        ))}
      </div>
      <p className='text-xs text-muted-foreground'>{label}</p>
    </div>
  )
}

/**
 * Setup page component
 */
function SetupPage() {
  const { setupFirstUser, authClient, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  })

  const password = watch('password')

  const onSubmit = async (data: SetupFormData) => {
    try {
      setIsSubmitting(true)
      await setupFirstUser(data.username, data.password, data.email || undefined)

      // Show success message
      toast.success('Account created! Redirecting to application...')

      // Small delay to show success message, then hard reload
      setTimeout(() => {
        // CRITICAL: Hard reload clears all caches and prevents infinite loops
        // This ensures the app sees needsSetup: false everywhere
        console.log('[Setup] Setup complete, performing hard reload')
        window.location.href = '/projects'
      }, 800)
    } catch (error) {
      // Error already handled by setupFirstUser with toast
      console.error('[Setup] Setup error:', error)
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='flex items-center gap-2 text-muted-foreground'>
          <Loader2 className='h-5 w-5 animate-spin' />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-screen items-center justify-center bg-muted/30 p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='space-y-3 text-center'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
            <CheckCircle2 className='h-6 w-6 text-primary' />
          </div>
          <CardTitle className='text-2xl'>Welcome to Promptliano</CardTitle>
          <CardDescription>Create your admin account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
            {/* Username */}
            <div className='space-y-2'>
              <Label htmlFor='username'>
                Username <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='username'
                {...register('username')}
                placeholder='admin'
                autoComplete='username'
                disabled={isSubmitting}
              />
              {errors.username && (
                <p className='text-xs text-destructive flex items-center gap-1'>
                  <AlertCircle className='h-3 w-3' />
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className='space-y-2'>
              <Label htmlFor='email'>Email (optional)</Label>
              <Input
                id='email'
                type='email'
                {...register('email')}
                placeholder='admin@example.com'
                autoComplete='email'
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className='text-xs text-destructive flex items-center gap-1'>
                  <AlertCircle className='h-3 w-3' />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Security Notice */}
            <Alert>
              <AlertDescription className='text-xs'>
                <strong>Password Required:</strong> For security, all accounts must be protected with a strong password.
              </AlertDescription>
            </Alert>

            {/* Password Fields - ALWAYS SHOWN */}
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='password'>
                  Password <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='password'
                  type='password'
                  {...register('password')}
                  placeholder='Enter password (min 6 characters)'
                  autoComplete='new-password'
                  disabled={isSubmitting}
                />
                {password && <PasswordStrength password={password} />}
                {errors.password && (
                  <p className='text-xs text-destructive flex items-center gap-1'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='confirmPassword'>
                  Confirm Password <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='confirmPassword'
                  type='password'
                  {...register('confirmPassword')}
                  placeholder='Confirm password'
                  autoComplete='new-password'
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <p className='text-xs text-destructive flex items-center gap-1'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button type='submit' className='w-full' size='lg' disabled={isSubmitting}>
              {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Create Admin Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Route definition with auth check
 */
export const Route = createFileRoute('/setup')({
  validateSearch: zodValidator(setupSearchSchema),
  beforeLoad: async ({ context }) => {
    try {
      // Use cached FULL auth status from root route (ZERO API calls!)
      const cachedAuthStatus = context.queryClient.getQueryData(['auth', 'full-status'])

      const normalizedStatus = cachedAuthStatus ? normalizeAuthStatus(cachedAuthStatus) : null

      if (!normalizedStatus) {
        console.log('[Setup] No cached auth status found, proceeding with setup')
        return {
          authSettings: normalizeAuthStatus({}).data.authSettings
        }
      }

      if (normalizedStatus.data.needsSetup === false) {
        // Setup already complete, redirect to login
        console.log('[Setup] Setup complete (from cache), redirecting to /login')
        throw redirect({
          to: '/login'
        })
      }

      // Return auth settings from cache - NO API CALL
      return {
        authSettings: normalizedStatus.data.authSettings
      }
    } catch (error) {
      // If error is a redirect, rethrow it
      if (isRedirect(error)) {
        throw error
      }

      // If error checking status, allow setup to proceed (fail open for setup)
      console.error('[Setup] Error checking auth status:', error)
      return {
        authSettings: normalizeAuthStatus({}).data.authSettings
      }
    }
  },
  component: SetupPage
})
