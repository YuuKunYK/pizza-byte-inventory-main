export type BaseUnit = 'grams' | 'kg' | 'ml' | 'liter' | 'pcs';

export interface ConversionItem {
  base_unit?: string | null;
  unit_type?: string | null;
  purchase_unit?: string | null;
  purchase_conversion_value?: number | string | null;
}

export interface ConversionPreset {
  label: string;
  purchaseUnit: string;
  baseUnit: BaseUnit;
  factor: number;
  example: string;
}

type Dimension = 'mass' | 'volume' | 'count';

const SI: Record<string, { dim: Dimension; toCanonical: number }> = {
  grams: { dim: 'mass', toCanonical: 1 },
  g: { dim: 'mass', toCanonical: 1 },
  gram: { dim: 'mass', toCanonical: 1 },
  kg: { dim: 'mass', toCanonical: 1000 },
  kilogram: { dim: 'mass', toCanonical: 1000 },
  kilograms: { dim: 'mass', toCanonical: 1000 },
  ml: { dim: 'volume', toCanonical: 1 },
  milliliter: { dim: 'volume', toCanonical: 1 },
  millilitre: { dim: 'volume', toCanonical: 1 },
  milliliters: { dim: 'volume', toCanonical: 1 },
  millilitres: { dim: 'volume', toCanonical: 1 },
  liter: { dim: 'volume', toCanonical: 1000 },
  litre: { dim: 'volume', toCanonical: 1000 },
  liters: { dim: 'volume', toCanonical: 1000 },
  litres: { dim: 'volume', toCanonical: 1000 },
  l: { dim: 'volume', toCanonical: 1000 },
  ltr: { dim: 'volume', toCanonical: 1000 },
  pcs: { dim: 'count', toCanonical: 1 },
  pc: { dim: 'count', toCanonical: 1 },
  piece: { dim: 'count', toCanonical: 1 },
  pieces: { dim: 'count', toCanonical: 1 },
  quantity: { dim: 'count', toCanonical: 1 },
};

const PACK_ALIASES: Record<string, number> = {
  dozen: 12,
  doz: 12,
};

export const CONVERSION_PRESETS: ConversionPreset[] = [
  {
    label: 'Crate of 12',
    purchaseUnit: 'crate',
    baseUnit: 'pcs',
    factor: 12,
    example: '1 crate of soda = 12 bottles',
  },
  {
    label: 'Case of 24',
    purchaseUnit: 'case',
    baseUnit: 'pcs',
    factor: 24,
    example: '1 case = 24 pieces',
  },
  {
    label: 'Dozen',
    purchaseUnit: 'dozen',
    baseUnit: 'pcs',
    factor: 12,
    example: '1 dozen = 12 pieces',
  },
  {
    label: '1 L = 1000 ml',
    purchaseUnit: 'liter',
    baseUnit: 'ml',
    factor: 1000,
    example: '1 liter of milk = 1000 ml',
  },
  {
    label: '1 kg = 1000 g',
    purchaseUnit: 'kg',
    baseUnit: 'grams',
    factor: 1000,
    example: '1 kg flour = 1000 g',
  },
];

export const normalizeUnit = (unit?: string | null): string =>
  (unit || '').trim().toLowerCase();

export const getBaseUnit = (item: ConversionItem): string =>
  normalizeUnit(item.base_unit) || normalizeUnit(item.unit_type) || 'pcs';

export const formatUnitLabel = (unit?: string | null): string => {
  const key = normalizeUnit(unit);
  switch (key) {
    case 'grams':
    case 'g':
    case 'gram':
      return 'g';
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      return 'kg';
    case 'ml':
    case 'milliliter':
    case 'millilitre':
    case 'milliliters':
      return 'ml';
    case 'liter':
    case 'litre':
    case 'liters':
    case 'l':
    case 'ltr':
      return 'L';
    case 'pcs':
    case 'piece':
    case 'pieces':
    case 'quantity':
      return 'pcs';
    default:
      return unit || 'units';
  }
};

export const convertSi = (quantity: number, fromUnit: string, toUnit: string): number | null => {
  const from = SI[normalizeUnit(fromUnit)];
  const to = SI[normalizeUnit(toUnit)];
  if (!from || !to || from.dim !== to.dim) return null;
  return (quantity * from.toCanonical) / to.toCanonical;
};

export const suggestedPurchaseConversion = (
  baseUnit?: string | null,
  purchaseUnit?: string | null
): number | null => {
  if (!baseUnit || !purchaseUnit) return null;
  const si = convertSi(1, purchaseUnit, baseUnit);
  if (si) return si;
  const pack = PACK_ALIASES[normalizeUnit(purchaseUnit)];
  if (pack && (normalizeUnit(baseUnit) === 'pcs' || normalizeUnit(baseUnit) === 'quantity')) {
    return pack;
  }
  return null;
};

export const effectivePurchaseFactor = (item: ConversionItem): number => {
  const factor = Number(item.purchase_conversion_value);
  const si = suggestedPurchaseConversion(getBaseUnit(item), item.purchase_unit);

  // A leftover form default of 1 must not hide 1 L = 1000 ml.
  if (Number.isFinite(factor) && factor > 0) {
    if (si && si !== 1 && factor === 1) return si;
    return factor;
  }

  if (si) return si;
  return 1;
};

export const purchaseToBase = (purchaseQty: number, item: ConversionItem): number =>
  purchaseQty * effectivePurchaseFactor(item);

export const baseToPurchase = (baseQty: number, item: ConversionItem): number | null => {
  const onePack = effectivePurchaseFactor(item);
  if (!onePack || onePack === 1) {
    if (!item.purchase_unit) return null;
    if (normalizeUnit(item.purchase_unit) === getBaseUnit(item)) return null;
  }
  if (!item.purchase_unit && !Number(item.purchase_conversion_value)) return null;
  return baseQty / onePack;
};

export const isSuspiciousOneToOne = (item: ConversionItem): boolean => {
  const purchase = normalizeUnit(item.purchase_unit);
  const base = getBaseUnit(item);
  if (!purchase || purchase === base) return false;
  const factor = effectivePurchaseFactor(item);
  const si = suggestedPurchaseConversion(base, purchase);
  return factor === 1 && !si;
};

export const describeConversion = (item: ConversionItem): string | null => {
  const purchase = item.purchase_unit?.trim();
  const base = getBaseUnit(item);
  const one = purchaseToBase(1, item);
  if (!purchase) {
    const si = suggestedPurchaseConversion(base, item.unit_type);
    if (si && si !== 1 && normalizeUnit(item.unit_type) !== base) {
      return `1 ${formatUnitLabel(item.unit_type)} = ${si} ${formatUnitLabel(base)}`;
    }
    return null;
  }
  if (one === 1 && normalizeUnit(purchase) === base) return null;
  return `1 ${purchase} = ${formatQty(one)} ${formatUnitLabel(base)}`;
};

export const formatQty = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const rounded =
    Math.abs(value - Math.round(value)) < 1e-6 ? Math.round(value) : Number(value.toFixed(3));
  return String(rounded);
};

export const formatStock = (baseQty: number, item: ConversionItem): string => {
  const base = `${formatQty(baseQty)} ${formatUnitLabel(getBaseUnit(item))}`;
  const packs = item.purchase_unit ? baseToPurchase(baseQty, item) : null;
  const factor = effectivePurchaseFactor(item);
  if (packs != null && item.purchase_unit && factor > 1) {
    return `${base} (${formatQty(packs)} ${item.purchase_unit})`;
  }
  const literEq = convertSi(baseQty, getBaseUnit(item), 'liter');
  if (literEq != null && getBaseUnit(item) === 'ml' && baseQty >= 1000) {
    return `${base} (${formatQty(literEq)} L)`;
  }
  const kgEq = convertSi(baseQty, getBaseUnit(item), 'kg');
  if (kgEq != null && getBaseUnit(item) === 'grams' && baseQty >= 1000) {
    return `${base} (${formatQty(kgEq)} kg)`;
  }
  return base;
};

export const quantityToBase = (
  quantity: number,
  item: ConversionItem,
  enteredAs: 'base' | 'purchase'
): number => {
  if (enteredAs === 'purchase') return purchaseToBase(quantity, item);
  return quantity;
};
