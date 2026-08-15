-- Beverage and milk purchase conversions.
-- Stock is stored in base units. Receiving 1 crate adds 12 bottles.
-- Receiving 1 liter of milk adds 1000 ml.

UPDATE public.inventory_items
SET
  base_unit = 'pcs',
  purchase_unit = 'crate',
  purchase_conversion_value = 12,
  manual_conversion_note = '1 crate = 12 bottles'
WHERE name IN (
  'Pepsi-345 ML',
  'Colanext 345ML',
  'Water Next Cola 600 ML',
  'Pepsi 1 Ltr.',
  'Colanext 1 LTR',
  'Water Next Cola 1500 ML'
);

UPDATE public.inventory_items
SET
  base_unit = 'ml',
  purchase_unit = 'liter',
  purchase_conversion_value = 1000,
  manual_conversion_note = '1 liter = 1000 ml. One Milk Pak packet is 1 liter.'
WHERE name = 'Milk Pak Milk';
