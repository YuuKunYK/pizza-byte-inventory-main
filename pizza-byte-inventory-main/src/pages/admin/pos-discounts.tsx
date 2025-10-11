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
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { useDiscountRules } from '@/hooks/usePOSSales';
import { DiscountRule } from '@/types/pos';
import { Plus, Edit, Trash2, Loader2, Tag } from 'lucide-react';

const POSDiscountsPage = () => {
  const { discountRules, isLoadingDiscounts, createDiscount, updateDiscount, deleteDiscount, isCreating, isUpdating, isDeleting } = useDiscountRules();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    active: true,
  });

  const handleOpenDialog = (discount?: DiscountRule) => {
    if (discount) {
      setEditingDiscount(discount);
      setFormData({
        name: discount.name,
        type: discount.type,
        value: discount.value.toString(),
        active: discount.active,
      });
    } else {
      setEditingDiscount(null);
      setFormData({
        name: '',
        type: 'percentage',
        value: '',
        active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      type: formData.type,
      value: parseFloat(formData.value),
      active: formData.active,
    };

    if (editingDiscount) {
      updateDiscount({ id: editingDiscount.id, updates: data });
    } else {
      createDiscount(data);
    }

    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this discount rule?')) {
      deleteDiscount(id);
    }
  };

  if (isLoadingDiscounts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading discount rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Discount Rules</h1>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Discount Rule
          </Button>
        </div>
        <p className="text-muted-foreground">
          Create and manage predefined discount rules for quick application at POS
        </p>
      </div>

      <Separator />

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Tag className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">About Discount Rules</h3>
              <p className="text-sm text-muted-foreground">
                Discount rules allow you to create predefined discounts that can be quickly applied during checkout.
                These can be percentage-based (e.g., 10% off) or fixed amount (e.g., PKR 100 off).
                Active rules will be available to cashiers in the POS discount panel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discount Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>All Discount Rules ({discountRules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {discountRules.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Discount Rules</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first discount rule to get started
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Discount Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {rule.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {rule.type === 'percentage' ? `${rule.value}%` : `PKR ${rule.value}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.active ? 'default' : 'secondary'}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(rule)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDiscount ? 'Edit Discount Rule' : 'Add New Discount Rule'}</DialogTitle>
            <DialogDescription>
              Create predefined discount rules for quick application
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Discount Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Student Discount, Happy Hour"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Discount Type *</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label htmlFor="percentage" className="cursor-pointer font-normal">
                    Percentage (e.g., 10% off)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="cursor-pointer font-normal">
                    Fixed Amount (e.g., PKR 100 off)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">
                Discount Value *{' '}
                <span className="text-muted-foreground text-xs">
                  ({formData.type === 'percentage' ? 'Percentage' : 'PKR'})
                </span>
              </Label>
              <Input
                id="value"
                type="number"
                step={formData.type === 'percentage' ? '0.1' : '1'}
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder={formData.type === 'percentage' ? 'e.g., 10' : 'e.g., 100'}
                required
                min="0"
                max={formData.type === 'percentage' ? '100' : undefined}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked })
                }
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active (available in POS)
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
                ) : editingDiscount ? (
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

export default POSDiscountsPage;

