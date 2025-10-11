import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePOSCategories } from '@/hooks/usePOSCategories';
import { POSCategory } from '@/types/pos';
import { Plus, Edit, Trash2, Folder, FolderOpen, Loader2 } from 'lucide-react';

const POSCategoriesPage = () => {
  const { categories, parentCategories, isLoadingCategories, createCategory, updateCategory, deleteCategory, isCreating, isUpdating, isDeleting } = usePOSCategories();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<POSCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parent_category_id: '',
    display_order: 0,
    icon: '',
  });

  const handleOpenDialog = (category?: POSCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        parent_category_id: category.parent_category_id || '',
        display_order: category.display_order,
        icon: category.icon || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        parent_category_id: '',
        display_order: 0,
        icon: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      parent_category_id: formData.parent_category_id && formData.parent_category_id !== 'none' ? formData.parent_category_id : null,
      display_order: formData.display_order,
      icon: formData.icon || undefined,
    };

    if (editingCategory) {
      updateCategory({ id: editingCategory.id, updates: data });
    } else {
      createCategory(data);
    }

    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      deleteCategory(id);
    }
  };

  if (isLoadingCategories) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">POS Categories</h1>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
        <p className="text-muted-foreground">
          Manage categories and subcategories for your point of sale items
        </p>
      </div>

      <Separator />

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Display Order</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parentCategories.map((parent) => (
                <React.Fragment key={parent.id}>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-medium flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      {parent.name}
                    </TableCell>
                    <TableCell>
                      <Badge>Parent Category</Badge>
                    </TableCell>
                    <TableCell>{parent.display_order}</TableCell>
                    <TableCell>{parent.icon || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(parent)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(parent.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {parent.subcategories?.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="pl-12 flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        {sub.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Subcategory</Badge>
                      </TableCell>
                      <TableCell>{sub.display_order}</TableCell>
                      <TableCell>{sub.icon || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(sub)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(sub.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
            <DialogDescription>
              Create categories for organizing your sale items
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Pizzas, Drinks"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Parent Category (Optional)</Label>
              <Select
                value={formData.parent_category_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, parent_category_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Main Category)</SelectItem>
                  {categories
                    .filter((cat) => !cat.parent_category_id && cat.id !== editingCategory?.id)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g., 🍕, 🥤"
                maxLength={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingCategory ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSCategoriesPage;

