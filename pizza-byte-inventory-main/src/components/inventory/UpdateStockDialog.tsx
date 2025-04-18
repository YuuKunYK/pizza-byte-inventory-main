import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

interface UpdateStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  locations: any[];
  getCurrentStock: (itemId: string, locationId: string) => number;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const UpdateStockDialog: React.FC<UpdateStockDialogProps> = ({
  open,
  onOpenChange,
  item,
  locations,
  getCurrentStock,
  onSubmit,
  isLoading
}) => {
  const { user } = useAuth();
  const [updateType, setUpdateType] = useState('warehouse_receiving');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [currentStock, setCurrentStock] = useState(0);

  useEffect(() => {
    if (item && user?.locationId) {
      setCurrentStock(getCurrentStock(item.id, user.locationId));
    } else {
      setCurrentStock(0);
    }
  }, [item, user?.locationId, getCurrentStock]);

  const resetForm = () => {
    setUpdateType('warehouse_receiving');
    setQuantity('');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!item || !user?.locationId || !quantity) {
      return;
    }
    
    const qtyValue = parseInt(quantity);
    
    // Calculate the new closing stock
    let newClosingStock = currentStock;
    const updateData: any = {
      warehouse_receiving: 0,
      local_purchasing: 0,
      transfer_in: 0,
      transfer_out: 0,
      discarded: 0,
    };
    
    updateData[updateType] = qtyValue;
    
    // Update the closing stock based on the type of transaction
    if (['warehouse_receiving', 'local_purchasing', 'transfer_in'].includes(updateType)) {
      newClosingStock += qtyValue;
    } else if (['transfer_out', 'discarded'].includes(updateType)) {
      newClosingStock -= qtyValue;
    }
    
    updateData.closing_stock = newClosingStock;
    
    onSubmit({
      itemId: item.id,
      locationId: user.locationId,
      updateData
    });
  };

  // Get label for update type
  const getUpdateTypeLabel = (type: string) => {
    switch (type) {
      case 'warehouse_receiving': return 'Warehouse Receiving';
      case 'local_purchasing': return 'Local Purchasing';
      case 'transfer_in': return 'Transfer In';
      case 'transfer_out': return 'Transfer Out';
      case 'discarded': return 'Discarded';
      default: return type;
    }
  };

  const locationName = locations.find(l => l.id === user?.locationId)?.name || 'Unknown Location';

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Stock for {item?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm font-medium">Location</label>
              <div className="mt-1 p-2 bg-muted rounded-md">
                <p className="text-sm">{locationName}</p>
              </div>
            </div>
            
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Current Stock: <span className="font-bold">{currentStock} {item?.unit_type}</span></p>
            </div>
            
            <Tabs defaultValue="add" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="add">Add Stock</TabsTrigger>
                <TabsTrigger value="remove">Remove Stock</TabsTrigger>
              </TabsList>
              
              <TabsContent value="add">
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select value={updateType} onValueChange={setUpdateType} required>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warehouse_receiving">Warehouse Receiving</SelectItem>
                        <SelectItem value="local_purchasing">Local Purchasing</SelectItem>
                        <SelectItem value="transfer_in">Transfer In</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="remove">
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select value={updateType} onValueChange={setUpdateType} required>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer_out">Transfer Out</SelectItem>
                        <SelectItem value="discarded">Discarded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div>
              <label className="text-sm font-medium">Quantity ({item?.unit_type})</label>
              <Input 
                type="number" 
                step="1"
                min="1"
                pattern="\d*"
                placeholder={`Enter quantity in ${item?.unit_type}`} 
                className="mt-1" 
                value={quantity}
                onChange={(e) => {
                  // Allow only whole numbers
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    setQuantity(value);
                  }
                }}
                onBlur={(e) => {
                  // Ensure value is at least 1
                  const value = parseInt(e.target.value);
                  if (isNaN(value) || value < 1) {
                    setQuantity('1');
                  }
                }}
                required
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add notes about this stock update"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">
                New Stock After {getUpdateTypeLabel(updateType)}: <span className="font-bold">
                  {['warehouse_receiving', 'local_purchasing', 'transfer_in'].includes(updateType)
                    ? currentStock + (parseInt(quantity) || 0)
                    : currentStock - (parseInt(quantity) || 0)} {item?.unit_type}
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Stock'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateStockDialog;
