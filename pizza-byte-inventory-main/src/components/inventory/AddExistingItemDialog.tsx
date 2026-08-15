import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle } from 'lucide-react';
import { UserRole } from '@/types/auth';
import { describeConversion, formatStock, formatUnitLabel, getBaseUnit, quantityToBase } from '@/lib/units';

interface AddExistingItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const AddExistingItemDialog: React.FC<AddExistingItemDialogProps> = ({
  open,
  onOpenChange,
  locations,
  onSubmit,
  isLoading
}) => {
  const { user } = useAuth();
  const { inventoryItems, getCurrentStock } = useInventory();
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locationError, setLocationError] = useState('');

  // Auto-select location for branch users
  useEffect(() => {
    if (user?.locationId && (user?.role === UserRole.BRANCH || user?.role.toString() === UserRole.BRANCH)) {
      const userLocation = locations.find(loc => loc.id === user.locationId);
      if (userLocation) {
        setSelectedLocation(user.locationId);
        setLocationError('');
      } else {
        setLocationError('Location couldn\'t be read');
      }
    }
  }, [user, locations]);

  // Memoize the filtered items to prevent unnecessary recalculations
  const availableItems = useMemo(() => {
    if (!selectedLocation) return [];
    
    return inventoryItems.filter(item => {
      const currentStock = getCurrentStock(item.id, selectedLocation);
      return currentStock === 0;
    });
  }, [selectedLocation, inventoryItems, getCurrentStock]);

  const resetForm = () => {
    setSelectedItem('');
    setSelectedLocation('');
    setQuantity('');
    setLocationError('');
  };

  const selected = inventoryItems.find((item) => item.id === selectedItem);
  const conversionHint = selected ? describeConversion(selected) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantityValue = Number(quantity);
    if (isNaN(quantityValue) || quantityValue <= 0 || !selected) {
      return;
    }

    const baseQty = quantityToBase(
      quantityValue,
      selected,
      selected.purchase_unit ? 'purchase' : 'base'
    );

    onSubmit({
      item_id: selectedItem,
      location_id: selectedLocation,
      quantity: baseQty,
    });
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Existing Item to Inventory</DialogTitle>
          <DialogDescription>
            Select an item and location to add to your inventory. Items already present in the selected location will not be shown.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Location</label>
            {user?.role === UserRole.ADMIN || user?.role.toString() === UserRole.ADMIN ? (
              <Select 
                value={selectedLocation} 
                onValueChange={setSelectedLocation} 
                required
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1">
                {locationError ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{locationError}</span>
                  </div>
                ) : (
                  <div className="rounded-md border px-3 py-2 text-sm">
                    {locations.find(loc => loc.id === selectedLocation)?.name || 'Loading...'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Item</label>
            <Select 
              value={selectedItem} 
              onValueChange={setSelectedItem} 
              required
              disabled={!selectedLocation || !!locationError}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({formatUnitLabel(getBaseUnit(item))})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLocation && availableItems.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                All items are already present in this location
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Quantity</label>
            <Input 
              type="number"
              step="any"
              min="0"
              placeholder={selected?.purchase_unit ? `Quantity in ${selected.purchase_unit}` : 'Quantity'} 
              className="mt-1" 
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {conversionHint
                ? `${conversionHint}. Stock is stored in ${formatUnitLabel(getBaseUnit(selected || {}))}.`
                : 'Quantity is stored in the item base unit.'}
            </p>
            {selected && Number(quantity) > 0 && (
              <p className="mt-1 text-xs font-medium">
                Will add{' '}
                {formatStock(
                  quantityToBase(
                    Number(quantity),
                    selected,
                    selected.purchase_unit ? 'purchase' : 'base'
                  ),
                  selected
                )}
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !selectedItem || !selectedLocation || !quantity || !!locationError}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddExistingItemDialog; 