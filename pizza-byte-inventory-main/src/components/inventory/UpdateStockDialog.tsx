import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import {
  describeConversion,
  formatStock,
  formatUnitLabel,
  getBaseUnit,
  quantityToBase,
} from '@/lib/units';

interface UpdateStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  locations: any[];
  locationId?: string;
  getCurrentStock: (itemId: string, locationId: string) => number;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const UpdateStockDialog: React.FC<UpdateStockDialogProps> = ({
  open,
  onOpenChange,
  item,
  locations,
  locationId,
  getCurrentStock,
  onSubmit,
  isLoading,
}) => {
  const { user } = useAuth();
  const targetLocationId = locationId || user?.locationId;
  const [updateType, setUpdateType] = useState('warehouse_receiving');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [currentStock, setCurrentStock] = useState(0);
  const [enteredAs, setEnteredAs] = useState<'purchase' | 'base'>('purchase');

  const conversionHint = describeConversion(item || {});
  const hasPurchase = Boolean(item?.purchase_unit);

  useEffect(() => {
    if (item && targetLocationId) {
      setCurrentStock(getCurrentStock(item.id, targetLocationId));
    } else {
      setCurrentStock(0);
    }
    setEnteredAs(item?.purchase_unit ? 'purchase' : 'base');
  }, [item, targetLocationId, getCurrentStock]);

  const resetForm = () => {
    setUpdateType('warehouse_receiving');
    setQuantity('');
    setNotes('');
    setEnteredAs(item?.purchase_unit ? 'purchase' : 'base');
  };

  const qtyNumber = Number(quantity);
  const baseDelta = useMemo(() => {
    if (!item || !Number.isFinite(qtyNumber) || qtyNumber <= 0) return 0;
    return quantityToBase(qtyNumber, item, hasPurchase ? enteredAs : 'base');
  }, [item, qtyNumber, enteredAs, hasPurchase]);

  const isAdd = ['warehouse_receiving', 'local_purchasing', 'transfer_in'].includes(updateType);
  const nextStock = isAdd ? currentStock + baseDelta : currentStock - baseDelta;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !targetLocationId || baseDelta <= 0) return;
    if (!isAdd && baseDelta > currentStock) return;

    onSubmit({
      itemId: item.id,
      locationId: targetLocationId,
      quantity: baseDelta,
      movementType: updateType,
      notes: notes || undefined,
    });
  };

  const getUpdateTypeLabel = (type: string) => {
    switch (type) {
      case 'warehouse_receiving':
        return 'Warehouse Receiving';
      case 'local_purchasing':
        return 'Local Purchasing';
      case 'transfer_in':
        return 'Transfer In';
      case 'transfer_out':
        return 'Transfer Out';
      case 'discarded':
        return 'Discarded';
      default:
        return type;
    }
  };

  const locationName = locations.find((l) => l.id === targetLocationId)?.name || 'Unknown Location';
  const inputUnit =
    hasPurchase && enteredAs === 'purchase'
      ? item.purchase_unit
      : formatUnitLabel(getBaseUnit(item || {}));

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
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

            <div className="bg-muted p-3 rounded-md space-y-1">
              <p className="text-sm font-medium">
                Current stock:{' '}
                <span className="font-bold">{formatStock(currentStock, item || {})}</span>
              </p>
              {conversionHint && <p className="text-xs text-muted-foreground">{conversionHint}</p>}
            </div>

            <Tabs
              value={isAdd ? 'add' : 'remove'}
              onValueChange={(value) =>
                setUpdateType(value === 'add' ? 'warehouse_receiving' : 'discarded')
              }
              className="w-full"
            >
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
                        <SelectValue />
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
                        <SelectValue />
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

            {hasPurchase && (
              <div>
                <label className="text-sm font-medium">Enter quantity as</label>
                <Select value={enteredAs} onValueChange={(value: 'purchase' | 'base') => setEnteredAs(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">
                      {item.purchase_unit} (converts to {formatUnitLabel(getBaseUnit(item))})
                    </SelectItem>
                    <SelectItem value="base">{formatUnitLabel(getBaseUnit(item))}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Quantity ({inputUnit})</label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder={`Enter ${inputUnit}`}
                className="mt-1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              {baseDelta > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Will {isAdd ? 'add' : 'remove'} {formatStock(baseDelta, item || {})}
                </p>
              )}
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
                After {getUpdateTypeLabel(updateType)}:{' '}
                <span className="font-bold">{formatStock(Math.max(nextStock, 0), item || {})}</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || baseDelta <= 0 || (!isAdd && baseDelta > currentStock)}
            >
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
