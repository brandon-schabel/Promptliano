import { createFileRoute, redirect, useNavigate, isRedirect } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { loginSearchSchema } from '@/lib/search-schemas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { useAuth } from '@/contexts/auth-context'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { AuthStatusResponse } from '@promptliano/api-client'
import { normalizeAuthStatus } from '@/routes/__root'
import { CONNECTION_QUERY_KEY, ConnectionSnapshot, createConnectionSnapshot } from '@/lib/system/connection-status'
import { isNetworkError, getNetworkErrorMessage, withTimeout } from '@/lib/system/network'
import { toast } from 'sonner'
import { Loader2, LogIn, AlertCircle } from 'lucide-react'
import { useState } from 'react'

/**
 * Login form schema - PASSWORD REQUIRED
 */
const loginFormSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
})

type LoginFormData = z.infer<typeof loginFormSchema>

/**
 * Login page component
 */
function LoginPage() {
  const search = Route.useSearch()
  const { login, authClient, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false
    }
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true)
      await login(data.username, data.password)

      // Redirect to original destination or projects page
      const redirectTo = search.redirect || '/projects'
      navigate({
        to: redirectTo as any,
        replace: true
      })
    } catch (error) {
      // Error already handled by login with toast
      console.error('Login error:', error)
    } finally {
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
            <LogIn className='h-6 w-6 text-primary' />
          </div>
          <CardTitle className='text-2xl'>Sign In</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
            {/* Username */}
            <div className='space-y-2'>
              <Label htmlFor='username'>Username</Label>
              <Input
                id='username'
                {...register('username')}
                placeholder='Enter your username'
                autoComplete='username'
                autoFocus
                disabled={isSubmitting}
              />
              {errors.username && (
                <p className='text-xs text-destructive flex items-center gap-1'>
                  <AlertCircle className='h-3 w-3' />
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password - ALWAYS REQUIRED */}
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                {...register('password')}
                placeholder='Enter your password'
                autoComplete='current-password'
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className='text-xs text-destructive flex items-center gap-1'>
                  <AlertCircle className='h-3 w-3' />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className='flex items-center space-x-2'>
              <Checkbox id='rememberMe' {...register('rememberMe')} disabled={isSubmitting} />
              <Label
                htmlFor='rememberMe'
                className='text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
              >
                Remember me
              </Label>
            </div>

            {/* Submit Button */}
            <Button type='submit' className='w-full' size='lg' disabled={isSubmitting}>
              {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Sign In
            </Button>

            {/* Additional Help */}
            <div className='text-center text-sm text-muted-foreground'>
              <p>Contact your administrator if you've forgotten your credentials</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Route definition with auth check
 */
export const Route = createFileRoute('/login')({
  validateSearch: zodValidator(loginSearchSchema),
  beforeLoad: async ({ context }) => {
    try {
      const connectionSnapshot = context.queryClient.getQueryData<ConnectionSnapshot>(CONNECTION_QUERY_KEY)
      if (connectionSnapshot && connectionSnapshot.status !== 'connected') {
        return { connection: connectionSnapshot }
      }

      const cachedStatus = context.queryClient.getQueryData(['auth', 'full-status'])
      let fullStatus: AuthStatusResponse | undefined = cachedStatus ? normalizeAuthStatus(cachedStatus) : undefined

      if (!fullStatus) {
        try {
          const response = await withTimeout(context.authClient.getAuthStatus(), 8000)
          fullStatus = normalizeAuthStatus(response)
          context.queryClient.setQueryData(['auth', 'full-status'], fullStatus)
          context.queryClient.setQueryData(
            CONNECTION_QUERY_KEY,
            createConnectionSnapshot('connected', null, Date.now(), Date.now())
          )
        } catch (error) {
          if (isNetworkError(error)) {
            const snapshot = createConnectionSnapshot('disconnected', getNetworkErrorMessage(error), Date.now(), null)
            context.queryClient.setQueryData(CONNECTION_QUERY_KEY, snapshot)
            return { connection: snapshot }
          }
          throw error
        }
      }

      const authStatus = fullStatus.data

      if (authStatus.needsSetup === true) {
        throw redirect({
          to: '/setup'
        })
      }

      try {
        const userResponse = await withTimeout(context.authClient.getCurrentUser(), 8000)
        if (userResponse.data?.user) {
          throw redirect({ to: '/projects' })
        }
      } catch (error) {
        if (isNetworkError(error)) {
          const snapshot = createConnectionSnapshot('disconnected', getNetworkErrorMessage(error), Date.now(), null)
          context.queryClient.setQueryData(CONNECTION_QUERY_KEY, snapshot)
          return { connection: snapshot }
        }
      }

      return { connection: createConnectionSnapshot('connected', null, Date.now(), Date.now()) }
    } catch (error) {
      if (isRedirect(error)) {
        throw error
      }

      throw redirect({
        to: '/setup'
      })
    }
  },
  component: LoginPage
})
