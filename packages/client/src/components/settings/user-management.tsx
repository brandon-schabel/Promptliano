import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Switch } from '@promptliano/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@promptliano/ui'
import { Plus, Trash2, UserCog, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { User } from '@promptliano/api-client'

/**
 * Create user form schema
 */
const createUserSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    role: z.enum(['admin', 'user']).default('user'),
    enablePassword: z.boolean().default(false),
    password: z.string().optional(),
    confirmPassword: z.string().optional()
  })
  .refine(
    (data) => {
      if (data.enablePassword && (!data.password || data.password.length < 6)) {
        return false
      }
      return true
    },
    {
      message: 'Password must be at least 6 characters when password is enabled',
      path: ['password']
    }
  )
  .refine(
    (data) => {
      if (data.enablePassword && data.password !== data.confirmPassword) {
        return false
      }
      return true
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  )

type CreateUserFormData = z.infer<typeof createUserSchema>

/**
 * User management component for admin users
 */
export function UserManagement() {
  const { authClient, user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      role: 'user',
      enablePassword: false,
      password: '',
      confirmPassword: ''
    }
  })

  const enablePassword = watch('enablePassword')

  /**
   * Load users from API
   */
  const loadUsers = async () => {
    try {
      setLoading(true)
      // Auth is handled via httpOnly cookies automatically
      const result = await authClient.listUsers()
      // API returns { success: true, data: { users: [...] } }
      setUsers(result.data?.users || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load users'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Create new user
   */
  const handleCreateUser = async (data: CreateUserFormData) => {
    try {
      setIsSubmitting(true)
      // Auth is handled via httpOnly cookies automatically
      await authClient.createUser({
        username: data.username,
        email: data.email || undefined,
        password: data.enablePassword ? data.password : undefined,
        role: data.role
      })

      toast.success('User created successfully')
      setShowCreateDialog(false)
      reset()
      loadUsers()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Delete user
   */
  const handleDeleteUser = async (user: User) => {
    try {
      // Auth is handled via httpOnly cookies automatically
      await authClient.deleteUser(user.id)
      toast.success('User deleted successfully')
      setUserToDelete(null)
      loadUsers()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user'
      toast.error(errorMessage)
    }
  }

  /**
   * Load users on mount
   */
  useEffect(() => {
    loadUsers()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage application users (admin only)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <div className='flex items-center gap-2 text-muted-foreground'>
              <Loader2 className='h-5 w-5 animate-spin' />
              <span>Loading users...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage application users and their roles</CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Add User
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <UserCog className='h-12 w-12 text-muted-foreground mb-4' />
            <p className='text-muted-foreground'>No users found</p>
            <Button variant='outline' onClick={() => setShowCreateDialog(true)} className='mt-4'>
              Create First User
            </Button>
          </div>
        ) : (
          <div className='rounded-md border border-border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className='font-medium'>
                      {user.username}
                      {user.id === currentUser?.id && (
                        <Badge variant='outline' className='ml-2'>
                          You
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {user.isActive ? (
                          <>
                            <CheckCircle2 className='h-4 w-4 text-green-600' />
                            <span className='text-sm'>Active</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className='h-4 w-4 text-muted-foreground' />
                            <span className='text-sm text-muted-foreground'>Inactive</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setUserToDelete(user)}
                        disabled={user.id === currentUser?.id}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. Users can be assigned different roles and permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleCreateUser)} className='space-y-4'>
            {/* Username */}
            <div className='space-y-2'>
              <Label htmlFor='create-username'>
                Username <span className='text-destructive'>*</span>
              </Label>
              <Input id='create-username' {...register('username')} placeholder='johndoe' disabled={isSubmitting} />
              {errors.username && <p className='text-xs text-destructive'>{errors.username.message}</p>}
            </div>

            {/* Email */}
            <div className='space-y-2'>
              <Label htmlFor='create-email'>Email (optional)</Label>
              <Input
                id='create-email'
                type='email'
                {...register('email')}
                placeholder='user@example.com'
                disabled={isSubmitting}
              />
              {errors.email && <p className='text-xs text-destructive'>{errors.email.message}</p>}
            </div>

            {/* Role */}
            <div className='space-y-2'>
              <Label htmlFor='create-role'>Role</Label>
              <Select {...register('role')} disabled={isSubmitting}>
                <SelectTrigger id='create-role'>
                  <SelectValue placeholder='Select role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='user'>User</SelectItem>
                  <SelectItem value='admin'>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Password Toggle */}
            <div className='flex items-center justify-between space-x-2 rounded-lg border p-3'>
              <div className='space-y-0.5'>
                <Label htmlFor='create-enablePassword' className='font-medium'>
                  Set Password
                </Label>
                <p className='text-xs text-muted-foreground'>Require password for this user</p>
              </div>
              <Switch id='create-enablePassword' {...register('enablePassword')} disabled={isSubmitting} />
            </div>

            {/* Password Fields */}
            {enablePassword && (
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='create-password'>
                    Password <span className='text-destructive'>*</span>
                  </Label>
                  <Input
                    id='create-password'
                    type='password'
                    {...register('password')}
                    placeholder='Enter password'
                    disabled={isSubmitting}
                  />
                  {errors.password && <p className='text-xs text-destructive'>{errors.password.message}</p>}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='create-confirmPassword'>
                    Confirm Password <span className='text-destructive'>*</span>
                  </Label>
                  <Input
                    id='create-confirmPassword'
                    type='password'
                    {...register('confirmPassword')}
                    placeholder='Confirm password'
                    disabled={isSubmitting}
                  />
                  {errors.confirmPassword && (
                    <p className='text-xs text-destructive'>{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setShowCreateDialog(false)
                  reset()
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user <strong>{userToDelete?.username}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userToDelete) {
                  handleDeleteUser(userToDelete)
                }
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
