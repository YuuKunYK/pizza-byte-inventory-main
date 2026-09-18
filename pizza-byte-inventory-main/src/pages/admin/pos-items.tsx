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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { usePOSCategories, usePOSItems } from '@/hooks/usePOSCategories';
import { useRecipes } from '@/hooks/useRecipes';
import { useInventory } from '@/hooks/useInventory';
import { POSItemWithDetails, POSItemLinkMode, getPOSItemLinkMode } from '@/types/pos';
import { formatCurrency, pkrToPaisa, paisaToPkr } from '@/types/pos';
import { Plus, Edit, Trash2, ImageOff, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const emptyForm = {
  name: '',
  category_id: '',
  subcategory_id: '',
  price: '',
  link_mode: 'recipe' as POSItemLinkMode,
  recipe_id: '',
  inventory_item_id: '',
  inventory_qty: '1',
  available: true,
  image_url: '',
  description: '',
};

const POSItemsPage = () => {
  const { items, isLoadingItems, createItem, updateItem, deleteItem, isCreating, isUpdating, isDeleting } = usePOSItems();
  const { categories, parentCategories, isLoadingCategories } = usePOSCategories();
  const { recipes } = useRecipes();
  const { inventoryItems } = useInventory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<POSItemWithDetails | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  // Get subcategories for selected parent category
  const subcategories = categories.filter(
    (cat) => cat.parent_category_id === formData.category_id
  );

  const unlinkedCount = items.filter((item) => getPOSItemLinkMode(item) === 'unlinked').length;

  const handleOpenDialog = (item?: POSItemWithDetails) => {
    if (item) {
      setEditingItem(item);
      const mode = getPOSItemLinkMode(item);
      setFormData({
        name: item.name,
        category_id: item.category_id || '',
        subcategory_id: item.subcategory_id || '',
        price: paisaToPkr(item.price).toString(),
        link_mode: mode === 'unlinked' ? 'recipe' : mode,
        recipe_id: item.recipe_id || '',
        inventory_item_id: item.inventory_item_id || '',
        inventory_qty: String(item.inventory_qty ?? 1),
        available: item.available,
        image_url: item.image_url || '',
        description: item.description || '',
      });
    } else {
      setEditingItem(null);
      setFormData(emptyForm);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.link_mode === 'recipe' && !formData.recipe_id) {
      // Allowed: existing live catalogs have drinks and other SKUs with no recipe.
    }
    if (formData.link_mode === 'stock_item' && !formData.inventory_item_id) {
      toast({
        title: 'Stock item required',
        description: 'Pick the inventory item this menu item sells.',
        variant: 'destructive',
      });
      return;
    }
    const inventoryQty = parseFloat(formData.inventory_qty);
    if (formData.link_mode === 'stock_item' && (!Number.isFinite(inventoryQty) || inventoryQty <= 0)) {
      toast({ title: 'Invalid quantity', description: 'Units per sale must be greater than zero.', variant: 'destructive' });
      return;
    }

    const data = {
      name: formData.name,
      category_id: formData.category_id || null,
      subcategory_id: formData.subcategory_id || null,
      price: pkrToPaisa(parseFloat(formData.price)),
      recipe_id: formData.link_mode === 'recipe' && formData.recipe_id ? formData.recipe_id : null,
      inventory_item_id: formData.link_mode === 'stock_item' ? formData.inventory_item_id : null,
      inventory_qty: formData.link_mode === 'stock_item' ? inventoryQty : 1,
      inventory_tracked: formData.link_mode !== 'untracked',
      available: formData.available,
      image_url: formData.image_url || undefined,
      description: formData.description || undefined,
    };

    if (editingItem) {
      updateItem({ id: editingItem.id, updates: data });
    } else {
      createItem(data);
    }

    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteItem(id);
    }
  };

  if (isLoadingItems || isLoadingCategories) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">POS Items</h1>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
        <p className="text-muted-foreground">
          Manage sale items for your point of sale system
        </p>
      </div>

      {unlinkedCount > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {unlinkedCount} menu {unlinkedCount === 1 ? 'item is' : 'items are'} not linked to stock
            </p>
            <p className="text-muted-foreground">
              The register blocks these items until each one is linked to a recipe or a stock item, or marked as not stock-tracked.
            </p>
          </div>
        </div>
      )}

      <Separator />

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle>All Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Stock link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const margin = item.price > 0 ? ((item.price - item.cost_per_item) / item.price) * 100 : 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageOff className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {item.category && <Badge variant="outline">{item.category.name}</Badge>}
                        {item.subcategory && <Badge variant="secondary" className="text-xs">{item.subcategory.name}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(item.cost_per_item)}</TableCell>
                    <TableCell>
                      <Badge variant={margin < 20 ? 'destructive' : margin < 40 ? 'secondary' : 'default'}>
                        {margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const mode = getPOSItemLinkMode(item);
                        if (mode === 'recipe') {
                          return <Badge variant="outline">Recipe: {item.recipe?.name ?? 'linked'}</Badge>;
                        }
                        if (mode === 'stock_item') {
                          return (
                            <Badge variant="outline">
                              Stock: {item.inventory_item?.name ?? 'linked'} x{item.inventory_qty}
                            </Badge>
                          );
                        }
                        if (mode === 'untracked') {
                          return <Badge variant="secondary">Not tracked</Badge>;
                        }
                        return <Badge variant="destructive">Unlinked</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.available ? 'default' : 'secondary'}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(item)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription>
              Create sale items with pricing and recipe linkage
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 12 inch Pepperoni Pizza"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (PKR) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g., 1200"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value, subcategory_id: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Select
                  value={formData.subcategory_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, subcategory_id: value })
                  }
                  disabled={!formData.category_id || subcategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="space-y-2">
                <Label htmlFor="link_mode">Stock link *</Label>
                <Select
                  value={formData.link_mode}
                  onValueChange={(value: POSItemLinkMode) => setFormData({ ...formData, link_mode: value })}
                >
                  <SelectTrigger id="link_mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recipe">Recipe (ingredients are deducted)</SelectItem>
                    <SelectItem value="stock_item">Stock item (sold 1:1, e.g. bottled drink)</SelectItem>
                    <SelectItem value="untracked">Not stock-tracked (service charge, fee)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.link_mode === 'recipe' && (
                <div className="space-y-2">
                  <Label htmlFor="recipe">Recipe *</Label>
                  <Select
                    value={formData.recipe_id}
                    onValueChange={(value) => setFormData({ ...formData, recipe_id: value })}
                  >
                    <SelectTrigger id="recipe">
                      <SelectValue placeholder="Select recipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {recipes?.map((recipe: any) => (
                        <SelectItem key={recipe.id} value={recipe.id}>
                          {recipe.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cost is calculated from the recipe and its ingredients leave the branch on every sale.
                  </p>
                </div>
              )}

              {formData.link_mode === 'stock_item' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="inventory_item">Inventory item *</Label>
                    <Select
                      value={formData.inventory_item_id}
                      onValueChange={(value) => setFormData({ ...formData, inventory_item_id: value })}
                    >
                      <SelectTrigger id="inventory_item">
                        <SelectValue placeholder="Select stock item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inventory_qty">Units per sale *</Label>
                    <Input
                      id="inventory_qty"
                      type="number"
                      min="0.001"
                      step="any"
                      value={formData.inventory_qty}
                      onChange={(e) => setFormData({ ...formData, inventory_qty: e.target.value })}
                    />
                  </div>
                  <p className="col-span-3 text-xs text-muted-foreground">
                    Each sale removes this many base units of the stock item from the branch.
                  </p>
                </div>
              )}

              {formData.link_mode === 'untracked' && (
                <p className="text-xs text-muted-foreground">
                  This item will never move stock. Use only for fees and charges, never for food or drink.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL (Optional)</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the item"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="available"
                checked={formData.available}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, available: checked })
                }
              />
              <Label htmlFor="available" className="cursor-pointer">
                Available for sale
              </Label>
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
                ) : editingItem ? (
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

export default POSItemsPage;

