import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnitType, BaseUnitType, getBaseUnitDisplayName, validateConversion } from '@/types/inventory';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
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
  
  // New conversion fields
  const [baseUnit, setBaseUnit] = useState<BaseUnitType>('pcs');
  const [purchaseUnit, setPurchaseUnit] = useState('');
  const [purchaseConversionValue, setPurchaseConversionValue] = useState('1');
  const [manualConversionNote, setManualConversionNote] = useState('');

  const resetForm = () => {
    setName('');
    setCategoryId('');
    setUnitType('quantity');
    setConversionValue('1');
    setCostPerUnit('');
    setMinStockThreshold('');
    setInitialStock({});
    setBaseUnit('pcs');
    setPurchaseUnit('');
    setPurchaseConversionValue('1');
    setManualConversionNote('');
  };

  // Auto-set conversion value to 1 if purchase unit equals base unit
  useEffect(() => {
    if (purchaseUnit && baseUnit && purchaseUnit.toLowerCase() === baseUnit.toLowerCase()) {
      setPurchaseConversionValue('1');
    }
  }, [purchaseUnit, baseUnit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemData = {
      name,
      category_id: categoryId,
      unit_type: unitType,
      conversion_value: parseFloat(conversionValue),
      cost_per_unit: parseFloat(costPerUnit),
      min_stock_threshold: parseFloat(minStockThreshold),
      // New conversion fields
      base_unit: baseUnit,
      purchase_unit: purchaseUnit || null,
      purchase_conversion_value: purchaseUnit ? parseFloat(purchaseConversionValue) : null,
      manual_conversion_note: manualConversionNote || null,
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

  // Validation for conversion
  const isConversionValid = purchaseUnit ? validateConversion(baseUnit, purchaseUnit, parseFloat(purchaseConversionValue)) : true;
  const showAutoConversion = purchaseUnit && baseUnit && purchaseUnit.toLowerCase() === baseUnit.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Inventory Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
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
          </div>

          {/* Conversion Section */}
          <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Unit Conversion Setup</h3>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Base Unit (for tracking)</label>
                <Select value={baseUnit} onValueChange={(val) => setBaseUnit(val as BaseUnitType)} required>
                  <SelectTrigger className="mt-1">
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
                <label className="text-sm font-medium">Purchase Unit (optional)</label>
                <Input 
                  placeholder="e.g., packet, box, can" 
                  className="mt-1" 
                  value={purchaseUnit}
                  onChange={(e) => setPurchaseUnit(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  How you buy this item (e.g., packet, box, bottle)
                </p>
              </div>
            </div>

            {purchaseUnit && (
              <div>
                <label className="text-sm font-medium">
                  Conversion Value
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="ml-1">
                        <HelpCircle className="h-3 w-3 text-muted-foreground inline" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>How many base units (e.g., grams/ml/pieces) are in one purchase unit?</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <Input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  placeholder="Enter conversion value" 
                  className="mt-1" 
                  value={purchaseConversionValue}
                  onChange={(e) => setPurchaseConversionValue(e.target.value)}
                  disabled={showAutoConversion}
                  required
                />
                {showAutoConversion && (
                  <Badge variant="secondary" className="mt-1">
                    Auto-set to 1 (same unit)
                  </Badge>
                )}
                {!showAutoConversion && purchaseUnit && purchaseConversionValue && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <strong>Preview:</strong> 1 {purchaseUnit} = {purchaseConversionValue} {getBaseUnitDisplayName(baseUnit)}
                  </div>
                )}
                {!isConversionValid && (
                  <Alert className="mt-2">
                    <AlertDescription>
                      Invalid conversion: When purchase unit equals base unit, conversion must be 1.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Conversion Note (optional)</label>
              <Input 
                placeholder="e.g., 1 large packet of flour" 
                className="mt-1" 
                value={manualConversionNote}
                onChange={(e) => setManualConversionNote(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Additional clarification for this conversion
              </p>
            </div>
          </div>

          {/* Legacy fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Unit Type (Legacy)</label>
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
              <label className="text-sm font-medium">Legacy Conversion Value</label>
              <Input 
                type="number" 
                step="0.01"
                placeholder="Enter value" 
                className="mt-1" 
                value={conversionValue}
                onChange={(e) => setConversionValue(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                placeholder="Enter threshold" 
                className="mt-1" 
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Initial Stock Section */}
          <div>
            <label className="text-sm font-medium mb-2 block">Initial Stock by Location</label>
            <div className="space-y-2">
              {locations.map((location) => (
                <div key={location.id} className="flex items-center gap-2">
                  <span className="text-sm min-w-[120px]">{location.name}:</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={initialStock[location.id] || ''}
                    onChange={(e) => handleStockChange(location.id, e.target.value)}
                    className="w-32"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isConversionValid}>
              {isLoading ? 'Creating...' : 'Create Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemDialog;
