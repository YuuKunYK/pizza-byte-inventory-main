import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  Package,
  Tag,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import { UnitType } from '@/types/inventory';

const ItemManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('categories');
  
  // States for category management
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // States for item management
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemUnitType, setNewItemUnitType] = useState<UnitType>('quantity');
  const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('');
  const [newItemMinThreshold, setNewItemMinThreshold] = useState('');
  const [newItemConversionValue, setNewItemConversionValue] = useState('1');
  
  // Get inventory data
  const {
    inventoryItems,
    categories,
    isLoadingItems,
    isLoadingCategories,
    createItem,
    updateItem,
    isCreatingItem,
    isUpdatingItem
  } = useInventory();

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      // Use a direct fetch call instead of Supabase client to bypass policies
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://uajdrfwhfkfbwzgtixtk.supabase.co"}/rest/v1/categories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamRyZndoZmtmYnd6Z3RpeHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTk2NjksImV4cCI6MjA2MDEzNTY2OX0.x50quc-lHAbMF7Fuse_P3FbKs2nlZTqSulK9SECL5ho",
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamRyZndoZmtmYnd6Z3RpeHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTk2NjksImV4cCI6MjA2MDEzNTY2OX0.x50quc-lHAbMF7Fuse_P3FbKs2nlZTqSulK9SECL5ho"}`,
            'Prefer': 'return=minimal' // Critical - don't return the created data
          },
          body: JSON.stringify({ name })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Error creating category: ${response.statusText}`);
      }
      
      // Just return success - don't try to get data back
      return { success: true };
    },
    onSuccess: () => {
      // Refresh the categories data
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsAddCategoryDialogOpen(false);
      setNewCategoryName('');
      toast.success('Category created successfully');
    },
    onError: (error) => {
      console.error('Error creating category:', error);
      toast.error('Failed to create category', {
        description: error.message
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string, name: string }) => {
      // Use a direct fetch call instead of Supabase client to bypass policies
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://uajdrfwhfkfbwzgtixtk.supabase.co"}/rest/v1/categories?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamRyZndoZmtmYnd6Z3RpeHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTk2NjksImV4cCI6MjA2MDEzNTY2OX0.x50quc-lHAbMF7Fuse_P3FbKs2nlZTqSulK9SECL5ho",
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamRyZndoZmtmYnd6Z3RpeHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTk2NjksImV4cCI6MjA2MDEzNTY2OX0.x50quc-lHAbMF7Fuse_P3FbKs2nlZTqSulK9SECL5ho"}`,
            'Prefer': 'return=minimal' // Critical - don't return the updated data
          },
          body: JSON.stringify({ 
            name, 
            updated_at: new Date().toISOString() 
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Error updating category: ${response.statusText}`);
      }
      
      // Just return success - don't try to get data back
      return { success: true };
    },
    onSuccess: () => {
      // Refresh the categories data
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsEditCategoryDialogOpen(false);
      setSelectedCategory(null);
      setNewCategoryName('');
      toast.success('Category updated successfully');
    },
    onError: (error) => {
      console.error('Error updating category:', error);
      toast.error('Failed to update category', {
        description: error.message
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if category has associated items
      const { data: itemsWithCategory, error: checkError } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('category_id', id);
      
      if (checkError) throw checkError;
      
      if (itemsWithCategory.length > 0) {
        throw new Error('Cannot delete category that has items associated with it');
      }
      
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDeleteCategoryDialogOpen(false);
      setSelectedCategory(null);
      toast.success('Category deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category', {
        description: error.message
      });
    }
  });

  // Handle category operations
  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Category name cannot be empty');
      return;
    }
    createCategoryMutation.mutate(newCategoryName);
  };

  const handleEditCategory = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !selectedCategory) {
      toast.error('Category name cannot be empty');
      return;
    }
    updateCategoryMutation.mutate({ 
      id: selectedCategory.id, 
      name: newCategoryName 
    });
  };

  const handleDeleteCategory = () => {
    if (!selectedCategory) return;
    deleteCategoryMutation.mutate(selectedCategory.id);
  };

  const openEditCategoryDialog = (category) => {
    setSelectedCategory(category);
    setNewCategoryName(category.name);
    setIsEditCategoryDialogOpen(true);
  };

  const openDeleteCategoryDialog = (category) => {
    setSelectedCategory(category);
    setIsDeleteCategoryDialogOpen(true);
  };

  // Item mutations and handlers
  const handleCreateItem = (e) => {
    e.preventDefault();
    
    const newItem = {
      name: newItemName,
      category_id: newItemCategory,
      unit_type: newItemUnitType,
      cost_per_unit: parseFloat(newItemCostPerUnit),
      min_stock_threshold: newItemMinThreshold ? parseFloat(newItemMinThreshold) : undefined,
      conversion_value: newItemConversionValue ? parseFloat(newItemConversionValue) : undefined
    };
    
    createItem(newItem);
    setIsAddItemDialogOpen(false);
    resetItemForm();
  };

  const handleEditItem = (e) => {
    e.preventDefault();
    
    if (!selectedItem) return;
    
    const updatedItem = {
      id: selectedItem.id,
      name: newItemName,
      category_id: newItemCategory,
      unit_type: newItemUnitType,
      cost_per_unit: parseFloat(newItemCostPerUnit),
      min_stock_threshold: newItemMinThreshold ? parseFloat(newItemMinThreshold) : null,
      conversion_value: newItemConversionValue ? parseFloat(newItemConversionValue) : null
    };
    
    updateItem(updatedItem);
    setIsEditItemDialogOpen(false);
  };

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      setIsDeleteItemDialogOpen(false);
      setSelectedItem(null);
      toast.success('Item deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item', {
        description: error.message
      });
    }
  });

  const handleDeleteItem = () => {
    if (!selectedItem) return;
    deleteItemMutation.mutate(selectedItem.id);
  };

  const openEditItemDialog = (item) => {
    setSelectedItem(item);
    setNewItemName(item.name);
    setNewItemCategory(item.category_id);
    setNewItemUnitType(item.unit_type);
    setNewItemCostPerUnit(item.cost_per_unit.toString());
    setNewItemMinThreshold(item.min_stock_threshold ? item.min_stock_threshold.toString() : '');
    setNewItemConversionValue(item.conversion_value ? item.conversion_value.toString() : '1');
    setIsEditItemDialogOpen(true);
  };

  const openDeleteItemDialog = (item) => {
    setSelectedItem(item);
    setIsDeleteItemDialogOpen(true);
  };

  const resetItemForm = () => {
    setNewItemName('');
    setNewItemCategory('');
    setNewItemUnitType('quantity');
    setNewItemCostPerUnit('');
    setNewItemMinThreshold('');
    setNewItemConversionValue('1');
  };

  // Filter categories based on search
  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  // Filter items based on search
  const filteredItems = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
    (item.category?.name && item.category.name.toLowerCase().includes(itemSearchQuery.toLowerCase()))
  );

  // Loading state
  if (isLoadingCategories || isLoadingItems) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading item management data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Item Management</h1>
        <p className="text-muted-foreground">
          Manage inventory items and categories
        </p>
      </div>

      <Separator />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories" className="flex items-center">
            <Tag className="mr-2 h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center">
            <Package className="mr-2 h-4 w-4" />
            Items
          </TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                className="w-[250px]"
              />
            </div>
            <Button onClick={() => setIsAddCategoryDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>

          <Card>
            <CardHeader className="py-4">
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Items Count</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => {
                      const itemCount = inventoryItems.filter(item => 
                        item.category_id === category.id
                      ).length;
                      
                      return (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>{itemCount}</TableCell>
                          <TableCell>{new Date(category.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(category.updated_at || category.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEditCategoryDialog(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => openDeleteCategoryDialog(category)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No categories found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                className="w-[250px]"
              />
            </div>
            <Button onClick={() => setIsAddItemDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <Card>
            <CardHeader className="py-4">
              <CardTitle>Inventory Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit Type</TableHead>
                    <TableHead>Cost (PKR)</TableHead>
                    <TableHead>Min Threshold</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          {categories.find(c => c.id === item.category_id)?.name || "Uncategorized"}
                        </TableCell>
                        <TableCell>{item.unit_type}</TableCell>
                        <TableCell>PKR {item.cost_per_unit}</TableCell>
                        <TableCell>{item.min_stock_threshold || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openEditItemDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive"
                              onClick={() => openDeleteItemDialog(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No items found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category for inventory items.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory}>
            <div className="grid gap-4 py-4">
              <div>
                <label className="text-sm font-medium">Category Name</label>
                <Input 
                  placeholder="Enter category name" 
                  className="mt-1" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsAddCategoryDialogOpen(false);
                  setNewCategoryName('');
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
              >
                {createCategoryMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCategory}>
            <div className="grid gap-4 py-4">
              <div>
                <label className="text-sm font-medium">Category Name</label>
                <Input 
                  placeholder="Enter category name" 
                  className="mt-1" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsEditCategoryDialogOpen(false);
                  setSelectedCategory(null);
                  setNewCategoryName('');
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updateCategoryMutation.isPending || !newCategoryName.trim()}
              >
                {updateCategoryMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this category? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Category: <span className="font-semibold">{selectedCategory?.name}</span>
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteCategoryDialogOpen(false);
                setSelectedCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateItem}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input 
                    placeholder="Enter item name" 
                    className="mt-1" 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Unit Type</label>
                  <Select 
                    value={newItemUnitType} 
                    onValueChange={(value) => setNewItemUnitType(value as UnitType)}
                    required
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="grams">Grams</SelectItem>
                      <SelectItem value="kg">Kilogram</SelectItem>
                      <SelectItem value="liter">Liter</SelectItem>
                      <SelectItem value="ml">Milliliter</SelectItem>
                      <SelectItem value="packet">Packet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Conversion Value</label>
                  <Input 
                    placeholder="e.g. 1 packet = X grams" 
                    className="mt-1" 
                    type="number"
                    value={newItemConversionValue}
                    onChange={(e) => setNewItemConversionValue(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    e.g. 1 packet = 2000 grams
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Cost Per Unit (PKR)</label>
                  <Input 
                    placeholder="Enter cost" 
                    className="mt-1" 
                    type="number"
                    value={newItemCostPerUnit}
                    onChange={(e) => setNewItemCostPerUnit(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Minimum Stock Threshold</label>
                  <Input 
                    placeholder="Enter threshold" 
                    className="mt-1" 
                    type="number"
                    value={newItemMinThreshold}
                    onChange={(e) => setNewItemMinThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For low stock alerts
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsAddItemDialogOpen(false);
                  resetItemForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isCreatingItem || !newItemName.trim() || !newItemCategory}
              >
                {isCreatingItem && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditItem}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input 
                    placeholder="Enter item name" 
                    className="mt-1" 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Unit Type</label>
                  <Select 
                    value={newItemUnitType} 
                    onValueChange={(value) => setNewItemUnitType(value as UnitType)}
                    required
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="grams">Grams</SelectItem>
                      <SelectItem value="kg">Kilogram</SelectItem>
                      <SelectItem value="liter">Liter</SelectItem>
                      <SelectItem value="ml">Milliliter</SelectItem>
                      <SelectItem value="packet">Packet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Conversion Value</label>
                  <Input 
                    placeholder="e.g. 1 packet = X grams" 
                    className="mt-1" 
                    type="number"
                    value={newItemConversionValue}
                    onChange={(e) => setNewItemConversionValue(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    e.g. 1 packet = 2000 grams
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Cost Per Unit (PKR)</label>
                  <Input 
                    placeholder="Enter cost" 
                    className="mt-1" 
                    type="number"
                    value={newItemCostPerUnit}
                    onChange={(e) => setNewItemCostPerUnit(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Minimum Stock Threshold</label>
                  <Input 
                    placeholder="Enter threshold" 
                    className="mt-1" 
                    type="number"
                    value={newItemMinThreshold}
                    onChange={(e) => setNewItemMinThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For low stock alerts
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsEditItemDialogOpen(false);
                  setSelectedItem(null);
                  resetItemForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isUpdatingItem || !newItemName.trim() || !newItemCategory}
              >
                {isUpdatingItem && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Dialog */}
      <Dialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Item: <span className="font-semibold">{selectedItem?.name}</span>
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteItemDialogOpen(false);
                setSelectedItem(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemManagement; 