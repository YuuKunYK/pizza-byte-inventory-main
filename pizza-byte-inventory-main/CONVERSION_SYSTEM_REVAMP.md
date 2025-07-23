# Inventory Conversion System Revamp

## Overview
The inventory conversion system has been completely revamped to provide a clean, manual conversion structure that separates purchase units from base tracking units.

## New Database Fields

The following fields have been added to the `inventory_items` table:

- **`base_unit`** (enum): Standardized base unit for tracking inventory
  - Options: `grams`, `kg`, `ml`, `liter`, `pcs`
  - Required field for all new items

- **`purchase_unit`** (text): How you purchase the item  
  - Examples: "packet", "box", "can", "bottle"
  - Optional field

- **`purchase_conversion_value`** (numeric): How many base units in one purchase unit
  - Must be > 0 when purchase_unit is specified
  - Automatically set to 1 when purchase_unit equals base_unit

- **`manual_conversion_note`** (text): Optional clarification note
  - Free-text field for additional context
  - Example: "1 large packet of flour"

## Business Rules

1. **`conversion_value` must be > 0** when specified
2. **Auto-conversion**: When `purchase_unit` equals `base_unit`, `conversion_value` is automatically set to 1
3. **Base unit is required** - must be selected from the standardized dropdown
4. **No automatic conversions** - all data is stored manually for user reference only

## UI Improvements

### New Features
- **Tooltip helpers** explaining conversion value purpose
- **Real-time preview** showing conversion (e.g., "1 packet = 500 grams")  
- **Auto-validation** preventing invalid conversions
- **Visual feedback** with badges for auto-set values
- **Organized sections** separating new conversion fields from legacy fields

### User Experience
- Clear separation between "Base Unit (for tracking)" and "Purchase Unit"
- Helper text explaining how to use each field
- Validation prevents submission of invalid conversions
- Preview shows exactly what the conversion means

## Examples

### Example 1: Flour
- **Base Unit**: `kg`
- **Purchase Unit**: `packet`
- **Conversion Value**: `2`
- **Note**: `Standard flour packet`
- **Preview**: `1 packet = 2 kg`

### Example 2: Olive Oil
- **Base Unit**: `ml`
- **Purchase Unit**: `bottle`
- **Conversion Value**: `500`
- **Note**: `Medium bottle`
- **Preview**: `1 bottle = 500 ml`

### Example 3: Individual Items
- **Base Unit**: `pcs`
- **Purchase Unit**: `box`
- **Conversion Value**: `12`
- **Note**: `Dozen pack`
- **Preview**: `1 box = 12 pcs`

## Migration Instructions

1. **Run the database migration**:
   ```sql
   -- Run this in your Supabase SQL editor or psql
   \i supabase/migrations/20250125_add_conversion_fields.sql
   ```

2. **Existing items** will have null values for the new conversion fields
3. **Update existing items** through the Item Management interface
4. **New items** will require the base unit field

## Backward Compatibility

- **Legacy fields preserved**: `unit_type` and `conversion_value` remain unchanged
- **Existing functionality** continues to work without modification
- **Gradual migration**: Update items to new system as needed
- **No breaking changes** to current workflows

## No Automatic Conversions

**Important**: This system does NOT automatically apply conversions in calculations. It only stores conversion data for manual reference and future use. All existing inventory calculations, pricing, and reporting remain unchanged.

## Technical Details

### Database Schema Changes
```sql
-- New enum type
CREATE TYPE base_unit_type AS ENUM ('grams', 'kg', 'ml', 'liter', 'pcs');

-- New columns
ALTER TABLE inventory_items 
ADD COLUMN base_unit base_unit_type,
ADD COLUMN purchase_unit TEXT,
ADD COLUMN purchase_conversion_value NUMERIC CHECK (purchase_conversion_value > 0),
ADD COLUMN manual_conversion_note TEXT;
```

### TypeScript Types
- New `BaseUnitType` enum
- Updated `InventoryItem` interface
- Helper functions for validation and display

### React Components
- Enhanced `AddItemDialog` with conversion section
- Updated `ItemManagement` with new fields
- Form validation for conversion rules
- Tooltips and user guidance

This revamp provides a foundation for future features while maintaining full backward compatibility with existing inventory management workflows. 