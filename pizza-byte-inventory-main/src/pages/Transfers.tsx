import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import { transferStockRpc } from '@/lib/erp';
import { toast } from '@/components/ui/sonner';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/pos-utils';
import { UserRole } from '@/types/auth';
import { describeConversion, formatStock, formatUnitLabel, getBaseUnit, quantityToBase } from '@/lib/units';

const Transfers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { inventoryItems, locations, getCurrentStock, isLoadingItems, isLoadingLocations } =
    useInventory();

  const [itemId, setItemId] = useState('');
  const [fromLocationId, setFromLocationId] = useState(user?.locationId || '');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const { data: movements = [], isLoading: isLoadingMovements } = useQuery({
    queryKey: ['inventory_movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*, inventory_items(name), locations(name)')
        .in('movement_type', ['transfer_in', 'transfer_out'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);
      const item = inventoryItems.find((row: any) => row.id === itemId);
      if (!itemId || !fromLocationId || !toLocationId || !qty || !item) {
        throw new Error('Fill in item, locations, and quantity');
      }
      const baseQty = quantityToBase(qty, item, 'base');
      return transferStockRpc({
        itemId,
        fromLocationId,
        toLocationId,
        quantity: baseQty,
        notes,
      });
    },
    onSuccess: () => {
      toast.success('Stock transferred');
      setQuantity('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['stock_entries'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
    },
    onError: (error: Error) => {
      toast.error('Transfer failed', { description: error.message });
    },
  });

  const available = itemId && fromLocationId ? getCurrentStock(itemId, fromLocationId) : 0;
  const selectedItem = inventoryItems.find((row: any) => row.id === itemId);
  const canSendFromOther =
    user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE;

  if (isLoadingItems || isLoadingLocations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading transfers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Transfers</h1>
        <p className="text-muted-foreground">
          Move inventory between warehouses and branches. Stock is deducted and received in one step.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            New transfer
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {inventoryItems.map((item: any) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From</Label>
            <Select
              value={fromLocationId}
              onValueChange={setFromLocationId}
              disabled={!canSendFromOther}
            >
              <SelectTrigger>
                <SelectValue placeholder="Source location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location: any) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name} ({location.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Select value={toLocationId} onValueChange={setToLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Destination location" />
              </SelectTrigger>
              <SelectContent>
                {locations
                  .filter((location: any) => location.id !== fromLocationId)
                  .map((location: any) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.type})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Quantity in {selectedItem ? formatUnitLabel(getBaseUnit(selectedItem)) : 'stock units'}
              {itemId ? ` (available: ${formatStock(available, selectedItem || {})})` : ''}
            </Label>
            <Input
              type="number"
              min="0.01"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {selectedItem && describeConversion(selectedItem) && (
              <p className="text-xs text-muted-foreground">
                {describeConversion(selectedItem)}. Transfers move stock units, not crates — enter 12
                to move one crate of 12 bottles.
              </p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div>
            <Button
              onClick={() => transferMutation.mutate()}
              disabled={transferMutation.isPending || Number(quantity) > available}
            >
              {transferMutation.isPending ? 'Transferring...' : 'Transfer stock'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingMovements ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>{row.inventory_items?.name || row.item_id}</TableCell>
                    <TableCell>{row.locations?.name}</TableCell>
                    <TableCell className="capitalize">{row.movement_type.replace('_', ' ')}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                  </TableRow>
                ))}
                {movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No transfers recorded yet. Apply the latest database migration to enable the ledger.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Transfers;
