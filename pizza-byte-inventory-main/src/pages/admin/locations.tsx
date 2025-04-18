import { useState, useEffect } from 'react';
import { PlusCircle, Loader2, MapPin, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { UserRole } from '@/types/auth';

interface Location {
  id: string;
  name: string;
  address: string | null;
  type: string;
  created_at: string | null;
  updated_at: string | null;
}

export default function LocationsPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: 'branch'
  });
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      toast.error('Failed to load locations', {
        description: error.message || 'Please try again later'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('locations')
          .update(formData)
          .eq('id', editingLocation.id);

        if (error) throw error;
        toast.success('Location updated successfully');
      } else {
        const { error } = await supabase
          .from('locations')
          .insert([formData]);

        if (error) throw error;
        toast.success('Location added successfully');
      }
      setIsDialogOpen(false);
      setFormData({ name: '', address: '', type: 'branch' });
      setEditingLocation(null);
      fetchLocations();
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast.error('Failed to save location', {
        description: error.message || 'Please try again later'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Location deleted successfully');
      fetchLocations();
    } catch (error: any) {
      console.error('Error deleting location:', error);
      toast.error('Failed to delete location', {
        description: error.message || 'Please try again later'
      });
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address || '',
      type: location.type
    });
    setIsDialogOpen(true);
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
        <p className="text-lg text-muted-foreground">Loading locations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Locations Management</h1>
        <p className="text-muted-foreground">
          Manage locations for your organization's branches and warehouses.
        </p>
      </div>

      <Separator />

      <div className="flex justify-between items-center">
        <Card className="w-full md:w-1/3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
            <p className="text-xs text-muted-foreground">
              {locations.filter(l => l.type === 'branch').length} branches, {locations.filter(l => l.type === 'warehouse').length} warehouses
            </p>
          </CardContent>
        </Card>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div>
                <label htmlFor="address" className="block text-sm font-medium mb-1">
                  Address
                </label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">
                  Type
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                >
                  <option value="branch">Branch</option>
                  <option value="warehouse">Warehouse</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingLocation ? 'Update' : 'Add'}
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
              <TableHead>Type</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Updated At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p>No locations found. Add your first location to get started.</p>
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>
                    <span className={`capitalize ${location.type === 'warehouse' ? 'text-blue-600' : 'text-green-600'}`}>
                      {location.type}
                    </span>
                  </TableCell>
                  <TableCell>{location.address || 'N/A'}</TableCell>
                  <TableCell>{location.created_at ? new Date(location.created_at).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>{location.updated_at ? new Date(location.updated_at).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(location)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(location.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
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