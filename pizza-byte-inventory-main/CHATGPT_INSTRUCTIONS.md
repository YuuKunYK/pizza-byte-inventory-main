# ChatGPT Instructions for Recipe Import

## Task
Generate a SQL import script to bulk import recipes from Excel data into a Pizza Byte Inventory System database.

## What You Need to Do
1. Take the Excel data I provide
2. Convert it to SQL INSERT statements 
3. Use the template file `RECIPE_IMPORT_TEMPLATE.sql` as your base
4. Replace the sample data section with actual data from Excel

## Expected Excel Format
- **Column A**: Recipe Name (e.g., "12 inch Margherita Pizza")
- **Column B**: Recipe Description (optional)
- **Column C**: Ingredient Name (must match inventory exactly)
- **Column D**: Ingredient Quantity (numbers only)
- **Column E**: Ingredient Unit (optional, for reference)

## Key Rules
1. **Each Excel row = One ingredient for one recipe**
2. **Multiple rows with same recipe name = Multiple ingredients for that recipe**
3. **Ingredient names must match existing inventory items exactly** (case doesn't matter)
4. **Use quantities in base units** (grams, ml, pieces)
5. **Generate UUIDs with `gen_random_uuid()`**

## Example Excel Data:
```
Recipe Name                | Description                      | Ingredient Name    | Quantity | Unit
12 inch Margherita Pizza  | Classic pizza with mozzarella   | Pizza Dough        | 300      | grams
12 inch Margherita Pizza  | Classic pizza with mozzarella   | Tomato Sauce       | 80       | ml
12 inch Margherita Pizza  | Classic pizza with mozzarella   | Mozzarella Cheese  | 150      | grams
Full Calzone              | Traditional calzone              | Pizza Dough        | 350      | grams
Full Calzone              | Traditional calzone              | Ricotta Cheese     | 200      | grams
```

## Output Required
- Complete SQL script ready to run
- Include all validation and error checking from template
- Show verification queries at the end
- Handle duplicate recipes gracefully (skip them)
- List any missing ingredients that need to be added to inventory first

## Template Location
Use the complete `RECIPE_IMPORT_TEMPLATE.sql` file as your starting point and replace only the sample data section (Step 2) with the actual Excel data converted to INSERT statements.

## Important Notes
- **Pizza dough amounts**: 7"=150g/70g, 9"=250g/150g, 12"=450g/250g, 16"=700g/400g, 16" Half=400g/250g, 21"=1050g/750g, 21" Half=500g/390g, 21" Slice=225g/150g (Standard/Thin Crust)
- **Calzone dough amounts**: Mini=70g, Slice=150g, Half=500g, Full=1000g
- **Always validate ingredient names exist in inventory**
- **Provide clear error messages for any issues**
- **Include summary of what was imported** 