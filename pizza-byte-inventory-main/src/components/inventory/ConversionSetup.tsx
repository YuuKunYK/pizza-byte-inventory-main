import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, HelpCircle } from 'lucide-react';
import { BaseUnitType, getBaseUnitDisplayName, validateConversion } from '@/types/inventory';
import {
  CONVERSION_PRESETS,
  formatQty,
  formatUnitLabel,
  isSuspiciousOneToOne,
  suggestedPurchaseConversion,
} from '@/lib/units';

interface ConversionSetupProps {
  baseUnit: BaseUnitType;
  purchaseUnit: string;
  conversionValue: string;
  note: string;
  onBaseUnitChange: (value: BaseUnitType) => void;
  onPurchaseUnitChange: (value: string) => void;
  onConversionValueChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}

const ConversionSetup: React.FC<ConversionSetupProps> = ({
  baseUnit,
  purchaseUnit,
  conversionValue,
  note,
  onBaseUnitChange,
  onPurchaseUnitChange,
  onConversionValueChange,
  onNoteChange,
}) => {
  const factor = parseFloat(conversionValue);
  const sameUnit = Boolean(purchaseUnit) && purchaseUnit.toLowerCase() === baseUnit.toLowerCase();
  const si = suggestedPurchaseConversion(baseUnit, purchaseUnit);
  const valid = purchaseUnit ? validateConversion(baseUnit, purchaseUnit, factor) : true;
  const suspicious = isSuspiciousOneToOne({
    base_unit: baseUnit,
    purchase_unit: purchaseUnit,
    purchase_conversion_value: factor,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <h3 className="text-lg font-medium text-foreground">Unit Conversion Setup</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger type="button">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                Stock is always stored in the base unit. A crate of soda should become 12 bottles. 1
                liter of milk should become 1000 ml.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
        <div className="flex flex-wrap gap-2">
          {CONVERSION_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onBaseUnitChange(preset.baseUnit);
                onPurchaseUnitChange(preset.purchaseUnit);
                onConversionValueChange(String(preset.factor));
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Presets fill purchase unit, stock unit, and the pack size. Change the number if your crate
          is not 12.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">Stock unit (how recipes deduct)</label>
            <Select value={baseUnit} onValueChange={(val) => onBaseUnitChange(val as BaseUnitType)} required>
              <SelectTrigger className="mt-2">
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
            <label className="text-sm font-medium text-foreground">Purchase unit (how you receive)</label>
            <Input
              placeholder="e.g., crate, packet, liter"
              className="mt-2"
              value={purchaseUnit}
              onChange={(e) => onPurchaseUnitChange(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Leave empty if you already count in the stock unit.</p>
          </div>
        </div>

        {purchaseUnit && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">
                How many {formatUnitLabel(baseUnit)} in 1 {purchaseUnit}?
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="12 for a soda crate, 1000 for a liter"
                className="mt-2"
                value={conversionValue}
                onChange={(e) => onConversionValueChange(e.target.value)}
                disabled={sameUnit}
                required
              />
              {sameUnit && (
                <Badge variant="secondary" className="mt-2">
                  Auto-set to 1 (same unit)
                </Badge>
              )}
              {si && si !== 1 && (
                <Button
                  type="button"
                  variant="link"
                  className="px-0 h-auto mt-1"
                  onClick={() => onConversionValueChange(String(si))}
                >
                  Use standard conversion: 1 {purchaseUnit} = {si} {formatUnitLabel(baseUnit)}
                </Button>
              )}
            </div>

            {Number.isFinite(factor) && factor > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-1">
                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> 1 {purchaseUnit} = {formatQty(factor)}{' '}
                  {getBaseUnitDisplayName(baseUnit)}
                </p>
                <p className="text-xs text-blue-700">
                  Receiving 2 {purchaseUnit}s adds {formatQty(factor * 2)} {formatUnitLabel(baseUnit)} to
                  stock. Recipes deduct in {formatUnitLabel(baseUnit)}.
                </p>
              </div>
            )}

            {suspicious && (
              <Alert className="border-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-destructive">
                  1 {purchaseUnit} currently equals 1 {formatUnitLabel(baseUnit)}. For soda, a crate is
                  usually 12 bottles — set the conversion to 12 or stock will be wrong.
                </AlertDescription>
              </Alert>
            )}

            {!valid && (
              <Alert className="border-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-destructive">
                  Invalid conversion: when purchase unit equals stock unit, conversion must be 1.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground">Conversion note (optional)</label>
          <Input
            placeholder="e.g., 1 crate of Pepsi 345ml = 12 bottles"
            className="mt-2"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default ConversionSetup;
