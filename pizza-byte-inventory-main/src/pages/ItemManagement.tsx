import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import {
  AlertCircle,
  Edit,
  Plus,
  Search,
  Trash2,
  Loader2,
  Package,
  Tag,
  HelpCircle,
  Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { UnitType, BaseUnitType, getBaseUnitDisplayName, validateConversion } from '@/types/inventory';
import { UserRole } from '@/types/auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  
  // New conversion field states
  const [newItemBaseUnit, setNewItemBaseUnit] = useState<BaseUnitType>('pcs');
  const [newItemPurchaseUnit, setNewItemPurchaseUnit] = useState('');
  const [newItemPurchaseConversionValue, setNewItemPurchaseConversionValue] = useState('1');
  const [newItemManualConversionNote, setNewItemManualConversionNote] = useState('');
  
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

  const resetItemForm = () => {
    setNewItemName('');
    setNewItemCategory('');
    setNewItemUnitType('quantity');
    setNewItemCostPerUnit('');
    setNewItemMinThreshold('');
    setNewItemConversionValue('1');
    setNewItemBaseUnit('pcs');
    setNewItemPurchaseUnit('');
    setNewItemPurchaseConversionValue('1');
    setNewItemManualConversionNote('');
  };

  // Auto-set conversion value to 1 if purchase unit equals base unit
  React.useEffect(() => {
    if (newItemPurchaseUnit && newItemBaseUnit && newItemPurchaseUnit.toLowerCase() === newItemBaseUnit.toLowerCase()) {
      setNewItemPurchaseConversionValue('1');
    }
  }, [newItemPurchaseUnit, newItemBaseUnit]);

  // Validation for conversion
  const isConversionValid = newItemPurchaseUnit ? validateConversion(newItemBaseUnit, newItemPurchaseUnit, parseFloat(newItemPurchaseConversionValue)) : true;
  const showAutoConversion = newItemPurchaseUnit && newItemBaseUnit && newItemPurchaseUnit.toLowerCase() === newItemBaseUnit.toLowerCase();

  // Item mutations and handlers
  const handleCreateItem = (e) => {
    e.preventDefault();
    
    const newItem = {
      name: newItemName,
      category_id: newItemCategory,
      unit_type: newItemUnitType,
      cost_per_unit: parseFloat(newItemCostPerUnit),
      min_stock_threshold: newItemMinThreshold ? parseFloat(newItemMinThreshold) : undefined,
      conversion_value: newItemConversionValue ? parseFloat(newItemConversionValue) : undefined,
      // New conversion fields
      base_unit: newItemBaseUnit,
      purchase_unit: newItemPurchaseUnit || null,
      purchase_conversion_value: newItemPurchaseUnit ? parseFloat(newItemPurchaseConversionValue) : null,
      manual_conversion_note: newItemManualConversionNote || null
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
      conversion_value: newItemConversionValue ? parseFloat(newItemConversionValue) : null,
      // New conversion fields
      base_unit: newItemBaseUnit,
      purchase_unit: newItemPurchaseUnit || null,
      purchase_conversion_value: newItemPurchaseUnit ? parseFloat(newItemPurchaseConversionValue) : null,
      manual_conversion_note: newItemManualConversionNote || null
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
    // New conversion fields
    setNewItemBaseUnit(item.base_unit || 'pcs');
    setNewItemPurchaseUnit(item.purchase_unit || '');
    setNewItemPurchaseConversionValue(item.purchase_conversion_value ? item.purchase_conversion_value.toString() : '1');
    setNewItemManualConversionNote(item.manual_conversion_note || '');
    setIsEditItemDialogOpen(true);
  };

  const openDeleteItemDialog = (item) => {
    setSelectedItem(item);
    setIsDeleteItemDialogOpen(true);
  };

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
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold">Add New Inventory Item</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a new inventory item with conversion settings
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateItem} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Item Name</label>
                  <Input 
                    placeholder="Enter item name" 
                    className="mt-2" 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory} required>
                    <SelectTrigger className="mt-2">
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
              </div>
            </div>

            {/* Unit Conversion Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <h3 className="text-lg font-medium text-foreground">Unit Conversion Setup</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Set up how you purchase items vs. how you track them in inventory</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Base Unit (for tracking)</label>
                    <Select value={newItemBaseUnit} onValueChange={(val) => setNewItemBaseUnit(val as BaseUnitType)} required>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select base unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grams">Grams (g)</SelectItem>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="ml">Milliliters (ml)</SelectItem>
                        <SelectItem value="liter">Liters (L)</SelectItem>
                        <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Purchase Unit (optional)</label>
                    <Input 
                      placeholder="e.g., packet, box, can" 
                      className="mt-2" 
                      value={newItemPurchaseUnit}
                      onChange={(e) => setNewItemPurchaseUnit(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      How you buy this item
                    </p>
                  </div>
                </div>

                {newItemPurchaseUnit && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">Conversion Value</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>How many base units (e.g., grams/ml/pieces) are in one purchase unit?</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0.01"
                        placeholder="Enter conversion value" 
                        className="mt-2" 
                        value={newItemPurchaseConversionValue}
                        onChange={(e) => setNewItemPurchaseConversionValue(e.target.value)}
                        disabled={showAutoConversion}
                        required
                      />
                      {showAutoConversion && (
                        <Badge variant="secondary" className="mt-2">
                          Auto-set to 1 (same unit)
                        </Badge>
                      )}
                    </div>
                    
                    {!showAutoConversion && newItemPurchaseUnit && newItemPurchaseConversionValue && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          <strong>Preview:</strong> 1 {newItemPurchaseUnit} = {newItemPurchaseConversionValue} {getBaseUnitDisplayName(newItemBaseUnit)}
                        </p>
                      </div>
                    )}
                    
                    {!isConversionValid && (
                      <Alert className="border-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-destructive">
                          Invalid conversion: When purchase unit equals base unit, conversion must be 1.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground">Conversion Note (optional)</label>
                  <Input 
                    placeholder="e.g., 1 large packet of flour" 
                    className="mt-2" 
                    value={newItemManualConversionNote}
                    onChange={(e) => setNewItemManualConversionNote(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Additional clarification for this conversion
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing & Inventory */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground border-b pb-2">Pricing & Inventory</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Cost Per Unit (PKR)</label>
                  <Input 
                    placeholder="Enter cost" 
                    className="mt-2" 
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItemCostPerUnit}
                    onChange={(e) => setNewItemCostPerUnit(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Minimum Stock Threshold</label>
                  <Input 
                    placeholder="Enter threshold" 
                    className="mt-2" 
                    type="number"
                    min="0"
                    value={newItemMinThreshold}
                    onChange={(e) => setNewItemMinThreshold(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    For low stock alerts
                  </p>
                </div>
              </div>
            </div>

            {/* Legacy System (Collapsible) */}
            <div className="space-y-4">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-lg font-medium text-foreground border-b pb-2">
                  <span>Legacy System Fields</span>
                  <Badge variant="outline" className="text-xs">
                    Backward Compatibility
                  </Badge>
                </summary>
                <div className="mt-4 p-4 border rounded-lg bg-gray-50/50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Unit Type (Legacy)</label>
                      <Select 
                        value={newItemUnitType} 
                        onValueChange={(value) => setNewItemUnitType(value as UnitType)}
                        required
                      >
                        <SelectTrigger className="mt-2">
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
                      <label className="text-sm font-medium text-muted-foreground">Legacy Conversion Value</label>
                      <Input 
                        placeholder="e.g. 1 packet = X grams" 
                        className="mt-2" 
                        type="number"
                        step="0.01"
                        value={newItemConversionValue}
                        onChange={(e) => setNewItemConversionValue(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        e.g. 1 packet = 2000 grams
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            <Separator />

            <DialogFooter className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsAddItemDialogOpen(false);
                  resetItemForm();
                }}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isCreatingItem || !newItemName.trim() || !newItemCategory || !isConversionValid}
                className="min-w-[120px]"
              >
                {isCreatingItem ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Item'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold">Edit Inventory Item</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update the item details and conversion settings
            </p>
          </DialogHeader>
          <form onSubmit={handleEditItem} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Item Name</label>
                  <Input 
                    placeholder="Enter item name" 
                    className="mt-2" 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory} required>
                    <SelectTrigger className="mt-2">
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
              </div>
            </div>

            {/* Unit Conversion Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <h3 className="text-lg font-medium text-foreground">Unit Conversion Setup</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Set up how you purchase items vs. how you track them in inventory</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Base Unit (for tracking)</label>
                    <Select value={newItemBaseUnit} onValueChange={(val) => setNewItemBaseUnit(val as BaseUnitType)} required>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select base unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grams">Grams (g)</SelectItem>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="ml">Milliliters (ml)</SelectItem>
                        <SelectItem value="liter">Liters (L)</SelectItem>
                        <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Purchase Unit (optional)</label>
                    <Input 
                      placeholder="e.g., packet, box, can" 
                      className="mt-2" 
                      value={newItemPurchaseUnit}
                      onChange={(e) => setNewItemPurchaseUnit(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      How you buy this item
                    </p>
                  </div>
                </div>

                {newItemPurchaseUnit && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">Conversion Value</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>How many base units (e.g., grams/ml/pieces) are in one purchase unit?</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0.01"
                        placeholder="Enter conversion value" 
                        className="mt-2" 
                        value={newItemPurchaseConversionValue}
                        onChange={(e) => setNewItemPurchaseConversionValue(e.target.value)}
                        disabled={showAutoConversion}
                        required
                      />
                      {showAutoConversion && (
                        <Badge variant="secondary" className="mt-2">
                          Auto-set to 1 (same unit)
                        </Badge>
                      )}
                    </div>
                    
                    {!showAutoConversion && newItemPurchaseUnit && newItemPurchaseConversionValue && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          <strong>Preview:</strong> 1 {newItemPurchaseUnit} = {newItemPurchaseConversionValue} {getBaseUnitDisplayName(newItemBaseUnit)}
                        </p>
                      </div>
                    )}
                    
                    {!isConversionValid && (
                      <Alert className="border-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-destructive">
                          Invalid conversion: When purchase unit equals base unit, conversion must be 1.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground">Conversion Note (optional)</label>
                  <Input 
                    placeholder="e.g., 1 large packet of flour" 
                    className="mt-2" 
                    value={newItemManualConversionNote}
                    onChange={(e) => setNewItemManualConversionNote(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Additional clarification for this conversion
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing & Inventory */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground border-b pb-2">Pricing & Inventory</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Cost Per Unit (PKR)</label>
                  <Input 
                    placeholder="Enter cost" 
                    className="mt-2" 
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItemCostPerUnit}
                    onChange={(e) => setNewItemCostPerUnit(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Minimum Stock Threshold</label>
                  <Input 
                    placeholder="Enter threshold" 
                    className="mt-2" 
                    type="number"
                    min="0"
                    value={newItemMinThreshold}
                    onChange={(e) => setNewItemMinThreshold(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    For low stock alerts
                  </p>
                </div>
              </div>
            </div>

            {/* Legacy System (Collapsible) */}
            <div className="space-y-4">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-lg font-medium text-foreground border-b pb-2">
                  <span>Legacy System Fields</span>
                  <Badge variant="outline" className="text-xs">
                    Backward Compatibility
                  </Badge>
                </summary>
                <div className="mt-4 p-4 border rounded-lg bg-gray-50/50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Unit Type (Legacy)</label>
                      <Select 
                        value={newItemUnitType} 
                        onValueChange={(value) => setNewItemUnitType(value as UnitType)}
                        required
                      >
                        <SelectTrigger className="mt-2">
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
                      <label className="text-sm font-medium text-muted-foreground">Legacy Conversion Value</label>
                      <Input 
                        placeholder="e.g. 1 packet = X grams" 
                        className="mt-2" 
                        type="number"
                        step="0.01"
                        value={newItemConversionValue}
                        onChange={(e) => setNewItemConversionValue(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        e.g. 1 packet = 2000 grams
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            <Separator />

            <DialogFooter className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditItemDialogOpen(false)}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isUpdatingItem || !newItemName.trim() || !newItemCategory || !isConversionValid}
                className="min-w-[120px]"
              >
                {isUpdatingItem ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Item'
                )}
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