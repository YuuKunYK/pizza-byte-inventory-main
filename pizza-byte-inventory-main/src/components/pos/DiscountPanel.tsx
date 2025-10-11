import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Discount } from '@/types/pos';
import { useDiscountRules } from '@/hooks/usePOSSales';
import { Tag, X, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DiscountPanelProps {
  discounts: Discount[];
  onApplyDiscount: (discount: Discount) => void;
  onRemoveDiscount: (index: number) => void;
  onClearDiscounts: () => void;
}

export const DiscountPanel: React.FC<DiscountPanelProps> = ({
  discounts,
  onApplyDiscount,
  onRemoveDiscount,
  onClearDiscounts,
}) => {
  const { discountRules, isLoadingDiscounts } = useDiscountRules();
  const [customType, setCustomType] = useState<'percentage' | 'fixed'>('percentage');
  const [customValue, setCustomValue] = useState('');

  const handleApplyCustomDiscount = () => {
    const value = parseFloat(customValue);
    if (isNaN(value) || value <= 0) {
      return;
    }

    const discount: Discount = {
      type: customType,
      value,
      amount: 0, // Will be calculated in usePOS
    };

    onApplyDiscount(discount);
    setCustomValue('');
  };

  const handleApplyPredefinedDiscount = (rule: any) => {
    const discount: Discount = {
      type: rule.type,
      value: rule.value,
      amount: 0, // Will be calculated in usePOS
      rule_id: rule.id,
      rule_name: rule.name,
    };

    onApplyDiscount(discount);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Discounts
          </CardTitle>
          {discounts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearDiscounts}
              className="h-7 text-destructive hover:text-destructive"
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Applied Discounts */}
        {discounts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Applied Discounts</Label>
            <div className="space-y-2">
              {discounts.map((discount, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white dark:bg-black">
                      {discount.type === 'percentage' ? `${discount.value}%` : `PKR ${discount.value}`}
                    </Badge>
                    {discount.rule_name && (
                      <span className="text-xs text-muted-foreground">{discount.rule_name}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemoveDiscount(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Separator />
          </div>
        )}

        {/* Predefined Discounts */}
        {discountRules.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Discounts</Label>
            <ScrollArea className="h-[120px]">
              <div className="space-y-1">
                {discountRules.map((rule) => (
                  <Button
                    key={rule.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-9"
                    onClick={() => handleApplyPredefinedDiscount(rule)}
                  >
                    <span className="text-xs">{rule.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {rule.type === 'percentage' ? `${rule.value}%` : `PKR ${rule.value}`}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <Separator />

        {/* Custom Discount */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Custom Discount</Label>

          <RadioGroup
            value={customType}
            onValueChange={(value) => setCustomType(value as 'percentage' | 'fixed')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="percentage" />
              <Label htmlFor="percentage" className="text-sm cursor-pointer">
                Percentage (%)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="fixed" />
              <Label htmlFor="fixed" className="text-sm cursor-pointer">
                Fixed (PKR)
              </Label>
            </div>
          </RadioGroup>

          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={customType === 'percentage' ? 'e.g., 10' : 'e.g., 100'}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApplyCustomDiscount();
                }
              }}
              className="h-9"
              min="0"
              step={customType === 'percentage' ? '0.1' : '1'}
            />
            <Button size="sm" onClick={handleApplyCustomDiscount} className="h-9 px-3">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

