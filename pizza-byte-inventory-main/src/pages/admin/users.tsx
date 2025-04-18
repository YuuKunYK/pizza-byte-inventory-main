import { useState, useEffect } from 'react';
import { PlusCircle, Loader2, Users, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { UserRole } from '@/types/auth';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  location_id: string | null;
  created_at: string;
  updated_at: string;
  locations?: {
    name: string;
  };
}

export default function ManageUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: UserRole.BRANCH,
    location_id: ''
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get profiles with their location details
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          email, 
          name, 
          role, 
          location_id, 
          created_at, 
          updated_at,
          locations:location_id (
            id, 
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Log the data to help debug
      console.log('User data from profiles table:', data);
      
      setUsers((data as User[]) || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users', {
        description: error.message || 'Please try again later'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      toast.error('Failed to load locations', {
        description: error.message || 'Please try again later'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update existing user
        const updateData = {
          name: formData.name,
          role: formData.role,
          location_id: formData.location_id,
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;
        
        // Also update the auth metadata to keep in sync
        const { error: metadataError } = await supabase.auth.admin.updateUserById(
          editingUser.id,
          { 
            user_metadata: { 
              name: formData.name,
              role: formData.role,
              location_id: formData.location_id
            } 
          }
        );
        
        if (metadataError) {
          console.warn('Could not update auth metadata:', metadataError);
        }
        
        toast.success('User updated successfully');
      } else {
        // Get the current session before creating a new user
        const { data } = await supabase.auth.getSession();
        const currentSession = data.session;
        
        if (!currentSession) {
          throw new Error('Admin session not available');
        }
        
        console.log('Creating user with data:', {
          email: formData.email,
          name: formData.name,
          role: formData.role,
          location_id: formData.location_id
        });
        
        // Create the user account first
        const { data: userData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: formData.role,
              location_id: formData.location_id
            }
          }
        });
        
        if (signUpError) {
          // Special handler for "User already registered" error
          if (signUpError.message?.includes('already registered')) {
            toast.error('This email is already registered', {
              description: 'If you recently deleted this user, please wait a few minutes and try again.'
            });
            
            // We'll stop here without refreshing the session to avoid any issues
            return;
          }
          
          // For any other error, throw it
          throw signUpError;
        }
        
        // Manually create or update the profile record to ensure correct data
        if (userData?.user?.id) {
          console.log('Creating profile with data:', {
            id: userData.user.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            location_id: formData.location_id
          });
          
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: userData.user.id,
              email: formData.email,
              name: formData.name,
              role: formData.role,
              location_id: formData.location_id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (profileError) {
            console.error('Error creating profile:', profileError);
            toast.warning('User created but profile may be incomplete', {
              description: profileError.message
            });
          }
        }
        
        // Manually restore the original session
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        });
        
        // Ensure we're back to the admin user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser || currentUser.email !== user?.email) {
          // If session restoration failed, force a page reload
          toast.success('User created, refreshing session...');
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
        
        toast.success('User added successfully');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error('Failed to save user', {
        description: error.message || 'Please try again later'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
      // Find the user's details before deleting
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', id)
        .single();
      
      if (userError) {
        console.error('Error finding user details:', userError);
      }
      
      const userEmail = userData?.email;
      console.log(`Attempting to delete user ${id} with email ${userEmail}`);
      
      // First try to delete from auth.users
      const { error: authError } = await supabase.auth.admin.deleteUser(id);
      
      if (authError) {
        console.warn('Could not delete from auth.users:', authError.message);
        
        // Try a fallback approach - deactivate the user instead
        try {
          // First change the email to prevent reuse
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            id,
            { 
              user_metadata: {
                status: 'deleted',
                original_email: userEmail
              },
              email: `deleted-${Date.now()}-${userEmail}` // Change email to prevent reuse
            }
          );
          
          if (updateError) {
            console.error('Failed to deactivate user:', updateError);
          } else {
            // Then reset password to random string to prevent login
            const randomPassword = Math.random().toString(36).slice(-10) + 
                                   Math.random().toString(36).slice(-10);
            
            const { error: passwordError } = await supabase.auth.admin.updateUserById(
              id,
              { password: randomPassword }
            );
            
            if (passwordError) {
              console.error('Failed to reset password:', passwordError);
            } else {              
              // Instead of using RPC, we'll just mark the user as deleted in our UI
              console.log('User marked as deleted in the system');
            }
          }
        } catch (updateError) {
          console.error('Error in fallback deactivation:', updateError);
        }
      }
      
      // Then delete from profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (profileError) {
        console.error('Failed to delete profile:', profileError);
        throw profileError;
      }
      
      toast.success('User deleted successfully', {
        description: 'If you want to recreate a user with the same email address, wait 60 seconds before trying.'
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user', {
        description: error.message || 'Please try again later'
      });
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: '', // Can't retrieve password, leave empty for updates
      role: user.role,
      location_id: user.location_id || ''
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      password: '',
      role: UserRole.BRANCH,
      location_id: ''
    });
    setEditingUser(null);
  };

  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage user accounts and their assigned locations.
        </p>
      </div>

      <Separator />

      <div className="flex justify-between items-center">
        <Card className="w-full md:w-1/3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {users.filter(u => u.role === UserRole.ADMIN).length} admins, {users.filter(u => u.role === UserRole.BRANCH).length} branch users, {users.filter(u => u.role === UserRole.WAREHOUSE).length} warehouse users
            </p>
          </CardContent>
        </Card>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? 'Update the user information below.' 
                  : 'Fill in the details to create a new user.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingUser} // Can't change email for existing users
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Name
                </label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              {!editingUser && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                </div>
              )}
              <div>
                <label htmlFor="role" className="block text-sm font-medium mb-1">
                  Role
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                >
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.BRANCH}>Branch</option>
                  <option value={UserRole.WAREHOUSE}>Warehouse</option>
                </select>
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium mb-1">
                  Location
                </label>
                <select
                  id="location"
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                >
                  <option value="">Select a location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUser ? 'Update' : 'Add'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p>No users found. Add your first user to get started.</p>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === UserRole.ADMIN 
                        ? 'bg-blue-100 text-blue-800' 
                        : user.role === UserRole.BRANCH 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.locations?.name || (user.location_id ? 'Unknown Location' : 'None')}
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(user)}
                      className="mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 