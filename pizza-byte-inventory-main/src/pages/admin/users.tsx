import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Loader2, Users, Edit, UserX, UserCheck, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { UserRole } from '@/types/auth';
import { staffAdmin, fetchStaffProfiles, StaffProfile } from '@/lib/staff-admin';

const emptyForm = {
  email: '',
  name: '',
  password: '',
  role: UserRole.BRANCH,
  location_id: '',
};

export default function ManageUsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffProfile | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showInactive, setShowInactive] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['profiles', 'staff'],
    queryFn: fetchStaffProfiles,
    enabled: user?.role === UserRole.ADMIN,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', 'picker'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id, name, type').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['profiles', 'staff'] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const locationId = formData.location_id || null;
      if (editingUser) {
        return staffAdmin({
          action: 'update',
          id: editingUser.id,
          name: formData.name,
          role: formData.role,
          location_id: locationId,
        });
      }
      return staffAdmin({
        action: 'create',
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role,
        location_id: locationId,
      });
    },
    onSuccess: () => {
      toast.success(editingUser ? 'User updated' : 'User created');
      setIsDialogOpen(false);
      setEditingUser(null);
      setFormData(emptyForm);
      invalidate();
    },
    onError: (error: Error) => toast.error('Could not save user', { description: error.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (target: StaffProfile) =>
      staffAdmin({ action: target.is_active ? 'deactivate' : 'reactivate', id: target.id }),
    onSuccess: (_data, target) => {
      toast.success(target.is_active ? 'User deactivated' : 'User reactivated');
      invalidate();
    },
    onError: (error: Error) => toast.error('Could not change user status', { description: error.message }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!resetTarget) throw new Error('No user selected');
      return staffAdmin({ action: 'reset_password', id: resetTarget.id, password: newPassword });
    },
    onSuccess: () => {
      toast.success('Password reset');
      setResetTarget(null);
      setNewPassword('');
    },
    onError: (error: Error) => toast.error('Could not reset password', { description: error.message }),
  });

  const handleEdit = (target: StaffProfile) => {
    setEditingUser(target);
    setFormData({
      email: target.email,
      name: target.name,
      password: '',
      role: target.role,
      location_id: target.location_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.role !== UserRole.ADMIN && !formData.location_id) {
      toast.error('Branch and warehouse users must be assigned to a location');
      return;
    }
    saveMutation.mutate();
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  const visibleUsers = users.filter((u) => showInactive || u.is_active !== false);
  const activeUsers = users.filter((u) => u.is_active !== false);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Staff accounts, roles and locations. Deactivated users lose access immediately; accounts are never deleted so their history stays intact.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Card className="w-full md:w-1/3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeUsers.filter((u) => u.role === UserRole.ADMIN).length} admins,{' '}
              {activeUsers.filter((u) => u.role === UserRole.BRANCH).length} branch,{' '}
              {activeUsers.filter((u) => u.role === UserRole.WAREHOUSE).length} warehouse
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="show-inactive" className="text-sm">Show deactivated</Label>
          </div>
          <Button
            onClick={() => {
              setEditingUser(null);
              setFormData(emptyForm);
              setIsDialogOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingUser(null);
            setFormData(emptyForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update the user information below.' : 'The user can sign in immediately with this password.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={!!editingUser}
              />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            {!editingUser && (
              <div>
                <Label htmlFor="password">Password (min 8 characters)</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="role">Role</Label>
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
              <Label htmlFor="location">
                Location {formData.role === UserRole.ADMIN ? '(optional for admins)' : ''}
              </Label>
              <select
                id="location"
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                required={formData.role !== UserRole.ADMIN}
              >
                <option value="">No fixed location</option>
                {locations
                  .filter((loc) => formData.role !== UserRole.WAREHOUSE || loc.type === 'warehouse')
                  .filter((loc) => formData.role !== UserRole.BRANCH || loc.type === 'branch')
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {resetTarget?.email}.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resetPasswordMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="new-password">New password (min 8 characters)</Label>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending}>
                Reset
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p>No users found. Add your first user to get started.</p>
                </TableCell>
              </TableRow>
            ) : (
              visibleUsers.map((staff) => (
                <TableRow key={staff.id} className={staff.is_active === false ? 'opacity-60' : undefined}>
                  <TableCell className="font-medium">{staff.name}</TableCell>
                  <TableCell>{staff.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        staff.role === UserRole.ADMIN
                          ? 'default'
                          : staff.role === UserRole.BRANCH
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {staff.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{staff.locations?.name || (staff.location_id ? 'Unknown location' : 'None')}</TableCell>
                  <TableCell>
                    <Badge variant={staff.is_active === false ? 'destructive' : 'outline'}>
                      {staff.is_active === false ? 'Deactivated' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => handleEdit(staff)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Reset password"
                      onClick={() => {
                        setResetTarget(staff);
                        setNewPassword('');
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={staff.is_active === false ? 'Reactivate' : 'Deactivate'}
                      disabled={staff.id === user?.id || toggleActiveMutation.isPending}
                      onClick={() => {
                        const verb = staff.is_active === false ? 'Reactivate' : 'Deactivate';
                        if (window.confirm(`${verb} ${staff.email}?`)) toggleActiveMutation.mutate(staff);
                      }}
                    >
                      {staff.is_active === false ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <UserX className="h-4 w-4 text-destructive" />
                      )}
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
