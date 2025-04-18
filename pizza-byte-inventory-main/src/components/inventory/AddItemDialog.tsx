import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { UnitType } from '@/types/inventory';

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: any[];
  locations: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const AddItemDialog: React.FC<AddItemDialogProps> = ({
  open,
  onOpenChange,
  categories,
  locations,
  onSubmit,
  isLoading
}) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitType, setUnitType] = useState<UnitType>('quantity');
  const [conversionValue, setConversionValue] = useState('1');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [minStockThreshold, setMinStockThreshold] = useState('');
  const [initialStock, setInitialStock] = useState<{[key: string]: string}>({});

  const resetForm = () => {
    setName('');
    setCategoryId('');
    setUnitType('quantity');
    setConversionValue('1');
    setCostPerUnit('');
    setMinStockThreshold('');
    setInitialStock({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemData = {
      name,
      category_id: categoryId,
      unit_type: unitType,
      conversion_value: parseFloat(conversionValue),
      cost_per_unit: parseFloat(costPerUnit),
      min_stock_threshold: parseFloat(minStockThreshold),
      initialStock: Object.entries(initialStock).reduce((acc, [locId, value]) => {
        acc[locId] = parseFloat(value) || 0;
        return acc;
      }, {} as {[key: string]: number})
    };
    
    onSubmit(itemData);
  };

  const handleStockChange = (locationId: string, value: string) => {
    setInitialStock(prev => ({
      ...prev,
      [locationId]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Inventory Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Item Details</TabsTrigger>
              <TabsTrigger value="stock">Initial Stock</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input 
                    placeholder="Enter item name" 
                    className="mt-1" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={categoryId} onValueChange={setCategoryId} required>
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
                  <Select value={unitType} onValueChange={(val) => setUnitType(val as UnitType)} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grams">Grams</SelectItem>
                      <SelectItem value="kg">KG</SelectItem>
                      <SelectItem value="packet">Packet</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="liter">Liter</SelectItem>
                      <SelectItem value="ml">ML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Conversion Value</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="Enter value" 
                    className="mt-1" 
                    value={conversionValue}
                    onChange={(e) => setConversionValue(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    e.g., 1 packet = X grams
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Cost Per Unit (PKR)</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="Enter cost" 
                    className="mt-1" 
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Minimum Stock Threshold</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="Enter threshold" 
                    className="mt-1" 
                    value={minStockThreshold}
                    onChange={(e) => setMinStockThreshold(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    For low stock alerts
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="stock" className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Set initial stock levels for each location
              </p>
              {locations.map((location) => (
                <div key={location.id} className="grid grid-cols-3 gap-4 items-center">
                  <div className="col-span-2">
                    <label className="text-sm font-medium">{location.name}</label>
                    {location.type === 'warehouse' && (
                      <p className="text-xs text-muted-foreground">Main storage location</p>
                    )}
                  </div>
                  <div>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0" 
                      value={initialStock[location.id] || ''}
                      onChange={(e) => handleStockChange(location.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemDialog;
