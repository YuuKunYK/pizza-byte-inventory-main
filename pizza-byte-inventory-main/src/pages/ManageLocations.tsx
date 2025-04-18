import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Location {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

const ManageLocations: React.FC = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: ''
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Failed to fetch locations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('locations')
          .update({
            name: formData.name,
            address: formData.address
          })
          .eq('id', editingLocation.id);

        if (error) throw error;
        toast.success('Location updated successfully');
      } else {
        const { error } = await supabase
          .from('locations')
          .insert([{
            name: formData.name,
            address: formData.address
          }]);

        if (error) throw error;
        toast.success('Location added successfully');
      }

      setIsDialogOpen(false);
      setEditingLocation(null);
      setFormData({ name: '', address: '' });
      fetchLocations();
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error('Failed to save location');
    }
  };

  const handleDelete = async (locationId: string) => {
    if (!window.confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;
      toast.success('Location deleted successfully');
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Failed to delete location');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address
    });
    setIsDialogOpen(true);
  };

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Locations</h1>
        <Button onClick={() => {
          setEditingLocation(null);
          setFormData({ name: '', address: '' });
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>{location.name}</TableCell>
                  <TableCell>{location.address}</TableCell>
                  <TableCell>{new Date(location.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(location)}
                      className="mr-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(location.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Location Name
                </label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter location name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="address" className="text-sm font-medium">
                  Address
                </label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter location address"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingLocation ? 'Update Location' : 'Add Location'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageLocations; 