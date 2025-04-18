import React, { useState } from 'react';
import {
  AlertCircle,
  FileDown,
  FileUp,
  Filter,
  PackagePlus,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
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
import { Loader2 } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useAuth } from '@/hooks/useAuth';
import AddExistingItemDialog from '@/components/inventory/AddExistingItemDialog';
import UpdateStockDialog from '@/components/inventory/UpdateStockDialog';
import { UnitType } from '@/types/inventory';
import { UserRole } from '@/types/auth';

interface CreateItemParams {
  name: string;
  category_id: string;
  unit_type: UnitType;
  cost_per_unit: number;
  min_stock_threshold?: number;
  conversion_value?: number;
}

interface AddExistingItemData {
  item_id: string;
  location_id: string;
  quantity: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
  };
  category_id: string;
  unit_type: UnitType;
  cost_per_unit: number;
  min_stock_threshold?: number;
  conversion_value?: number;
}

const Inventory = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const {
    inventoryItems,
    categories,
    locations,
    isLoadingItems,
    isLoadingCategories,
    isLoadingLocations,
    isLoadingStock,
    isUpdateStockDialogOpen,
    setIsUpdateStockDialogOpen,
    selectedItem,
    setSelectedItem,
    selectedLocation,
    setSelectedLocation,
    updateStock,
    getCurrentStock,
    getTotalStock,
    getStockStatus,
    isUpdatingStock
  } = useInventory();

  // Set default location for non-admin users
  React.useEffect(() => {
    if (user?.role !== UserRole.ADMIN && user?.role?.toString() !== UserRole.ADMIN && user?.locationId) {
      setSelectedLocation(user.locationId);
    }
  }, [user]);

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.category?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleAddExistingItem = (data: AddExistingItemData) => {
    const { item_id, location_id, quantity } = data;
    updateStock({
      itemId: item_id,
      locationId: location_id,
      updateData: {
        warehouse_receiving: quantity,
        closing_stock: quantity
      }
    });
    setIsAddDialogOpen(false);
  };

  const handleUpdateStock = (item: InventoryItem) => {
    // Only allow updating stock if user is admin or if it's their own location
    if (user?.role === UserRole.ADMIN || user?.role?.toString() === UserRole.ADMIN || selectedLocation === user?.locationId) {
      setSelectedItem(item);
      setIsUpdateStockDialogOpen(true);
    }
  };

  if (isLoadingItems || isLoadingCategories || isLoadingLocations || isLoadingStock) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading inventory data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
        <p className="text-muted-foreground">
          {user?.role === UserRole.ADMIN || user?.role?.toString() === UserRole.ADMIN 
            ? 'View and manage inventory across all locations.'
            : `View and manage inventory for ${locations.find(l => l.id === user?.locationId)?.name || 'your location'}.`}
        </p>
      </div>

      <Separator />

      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:w-[250px]"
            />
          </div>
          
          <div className="flex space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSelectedCategory('all')}>
                  All Categories
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    {category.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {user?.role === UserRole.ADMIN && (
              <Select
                value={selectedLocation || 'all'}
                onValueChange={setSelectedLocation}
              >
                <SelectTrigger className="h-10 w-[180px]">
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="h-10">
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="h-10">
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button size="sm" className="h-10" onClick={() => setIsAddDialogOpen(true)}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredItems.length}</div>
            <p className="text-xs text-muted-foreground">
              {inventoryItems.length} total in system
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inventoryItems.filter(item => getStockStatus(item) === 'low' || getStockStatus(item) === 'critical').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention soon
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inventory Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              PKR {inventoryItems.reduce((total, item) => {
                return total + (item.cost_per_unit * getTotalStock(item.id));
              }, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.role === UserRole.ADMIN && selectedLocation === 'all' 
                ? 'Across all locations'
                : `At ${locations.find(l => l.id === (selectedLocation || user?.locationId))?.name || 'your location'}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Unit Type</TableHead>
                <TableHead>Cost per Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.category?.name}</TableCell>
                  <TableCell>{getTotalStock(item.id)}</TableCell>
                  <TableCell>{item.unit_type}</TableCell>
                  <TableCell>PKR {item.cost_per_unit.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStockStatus(item) === 'critical' ? 'destructive' : 
                              getStockStatus(item) === 'low' ? 'outline' : 'default'}
                      className={getStockStatus(item) === 'normal' ? 'bg-green-500 hover:bg-green-500 text-white border-0' : ''}
                    >
                      {getStockStatus(item)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStock(item)}
                      disabled={user?.role !== UserRole.ADMIN && selectedLocation !== user?.locationId}
                    >
                      Update Stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddExistingItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        locations={locations}
        onSubmit={handleAddExistingItem}
        isLoading={isUpdatingStock}
      />

      <UpdateStockDialog
        open={isUpdateStockDialogOpen}
        onOpenChange={setIsUpdateStockDialogOpen}
        item={selectedItem}
        locations={locations}
        getCurrentStock={getCurrentStock}
        onSubmit={updateStock}
        isLoading={isUpdatingStock}
      />
    </div>
  );
};

export default Inventory;
