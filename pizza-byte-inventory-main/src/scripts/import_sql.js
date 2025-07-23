require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Function to generate SQL for categories and inventory items
async function generateImportSQL() {
  try {
    console.log('Starting SQL generation process...');
    
    // Path to the Excel file
    const excelFilePath = path.resolve(process.cwd(), 'InventoryListApril.xlsx');
    
    if (!fs.existsSync(excelFilePath)) {
      console.error(`Excel file not found at path: ${excelFilePath}`);
      process.exit(1);
    }
    
    // Read the Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFilePath);
    
    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    console.log(`Processing worksheet: ${worksheet.name}`);
    
    // Get column headers
    const headers = [];
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value);
    });
    
    console.log('Excel headers:', headers);
    
    // Find relevant column indices
    const nameIndex = headers.findIndex(h => 
      String(h).toLowerCase().includes('item') || 
      String(h).toLowerCase().includes('name') ||
      String(h).toLowerCase().includes('description'));
    
    const categoryIndex = headers.findIndex(h => 
      String(h).toLowerCase().includes('category') || 
      String(h).toLowerCase().includes('type'));
    
    const unitIndex = headers.findIndex(h => 
      String(h).toLowerCase().includes('unit') || 
      String(h).toLowerCase().includes('measure'));
    
    const rateIndex = headers.findIndex(h => 
      String(h).toLowerCase().includes('rate') || 
      String(h).toLowerCase().includes('price') ||
      String(h).toLowerCase().includes('cost'));
    
    console.log(`Column indices - Name: ${nameIndex}, Category: ${categoryIndex}, Unit: ${unitIndex}, Rate: ${rateIndex}`);
    
    // Collect all categories and items
    const categories = new Set();
    const items = [];
    let processedNames = new Set();
    let duplicateNames = new Set();
    
    // First pass: collect all items and unique categories
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;
      
      try {
        // Extract data from row
        const name = nameIndex >= 0 ? String(row.getCell(nameIndex + 1).value || '').trim() : '';
        const category = categoryIndex >= 0 ? String(row.getCell(categoryIndex + 1).value || '').trim() : 'Another';
        
        // Skip rows without a name
        if (!name) return;
        
        // Check for duplicates
        if (processedNames.has(name.toLowerCase())) {
          duplicateNames.add(name.toLowerCase());
        } else {
          processedNames.add(name.toLowerCase());
          
          // Add category to set
          if (category) {
            categories.add(category);
          } else {
            categories.add('Another');
          }
          
          // Process data for non-duplicates
          const unit = unitIndex >= 0 ? String(row.getCell(unitIndex + 1).value || '').trim() : 'quantity';
          const rateCell = rateIndex >= 0 ? row.getCell(rateIndex + 1).value : 0;
          let rate = 0;
          
          // Handle rate/cost parsing
          if (typeof rateCell === 'number') {
            rate = rateCell;
          } else if (rateCell && typeof rateCell === 'string') {
            // Remove any currency symbols or commas and parse
            rate = parseFloat(rateCell.replace(/[^\d.-]/g, '')) || 0;
          }
          
          if (rate < 0) rate = 0;
          
          // Map unit type
          const unitType = mapUnitType(unit);
          
          // Add item to array
          items.push({
            name,
            category: category || 'Another',
            unit: unitType,
            rate
          });
        }
      } catch (err) {
        console.error(`Error processing row ${rowNumber}:`, err);
      }
    });
    
    // Generate SQL for categories
    let categorySql = "-- SQL for creating categories\n";
    categorySql += "-- Run this first to ensure all categories exist\n\n";
    
    // Generate common category insert
    categorySql += "-- 1. Create 'Another' category if it doesn't exist\n";
    categorySql += `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM categories WHERE LOWER(name) = 'another') THEN
        INSERT INTO categories (name, created_at, updated_at)
        VALUES ('Another', NOW(), NOW());
    END IF;
END $$;
\n\n`;

    // Generate individual category inserts
    categorySql += "-- 2. Create other categories\n";
    for (const category of categories) {
      if (category.toLowerCase() !== 'another') {
        categorySql += `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM categories WHERE LOWER(name) = LOWER('${escapeSqlString(category)}')) THEN
        INSERT INTO categories (name, created_at, updated_at)
        VALUES ('${escapeSqlString(category)}', NOW(), NOW());
    END IF;
END $$;
\n`;
      }
    }
    
    // Generate SQL for items
    let itemSql = "\n\n-- SQL for creating/updating inventory items\n";
    itemSql += "-- Run this after creating categories\n\n";
    
    // Generate a dynamic variable to track the category IDs
    itemSql += "-- Variable declarations for category IDs\n";
    itemSql += `DO $$
DECLARE
    category_id_var UUID;
`;

    // Add items
    itemSql += `
BEGIN
    -- Import/update inventory items
`;
    
    for (const item of items) {
      // Get category ID
      itemSql += `
    -- Process item: ${escapeSqlString(item.name)}
    SELECT id INTO category_id_var FROM categories WHERE LOWER(name) = LOWER('${escapeSqlString(item.category)}') LIMIT 1;
    IF category_id_var IS NULL THEN
        -- Fallback to Another category
        SELECT id INTO category_id_var FROM categories WHERE LOWER(name) = 'another' LIMIT 1;
    END IF;
    
    -- Insert or update the item
    IF EXISTS (SELECT 1 FROM inventory_items WHERE LOWER(name) = LOWER('${escapeSqlString(item.name)}')) THEN
        UPDATE inventory_items
        SET 
            category_id = category_id_var,
            unit_type = '${item.unit}',
            cost_per_unit = ${item.rate},
            min_stock_threshold = 10,
            conversion_value = 1,
            updated_at = NOW()
        WHERE LOWER(name) = LOWER('${escapeSqlString(item.name)}');
    ELSE
        INSERT INTO inventory_items (
            name, 
            category_id, 
            unit_type, 
            cost_per_unit, 
            min_stock_threshold, 
            conversion_value, 
            created_at, 
            updated_at
        )
        VALUES (
            '${escapeSqlString(item.name)}',
            category_id_var,
            '${item.unit}',
            ${item.rate},
            10,
            1,
            NOW(),
            NOW()
        );
    END IF;
`;
    }
    
    itemSql += `END $$;`;
    
    // Write SQL to files
    fs.writeFileSync('import_categories.sql', categorySql);
    console.log('Category SQL written to import_categories.sql');
    
    fs.writeFileSync('import_items.sql', itemSql);
    console.log('Item SQL written to import_items.sql');
    
    // Write combined SQL
    fs.writeFileSync('import_all.sql', categorySql + itemSql);
    console.log('Combined SQL written to import_all.sql');
    
    console.log(`SQL generation complete: ${categories.size} categories, ${items.length} items`);
    
  } catch (error) {
    console.error('Error generating SQL:', error);
  }
}

// Helper function to map unit types
function mapUnitType(unitFromExcel) {
  if (!unitFromExcel) return 'quantity';
  
  const unitLower = String(unitFromExcel).toLowerCase().trim();
  
  if (unitLower.includes('gram') || unitLower === 'g' || unitLower === 'gm') {
    return 'grams';
  } else if (unitLower.includes('kilo') || unitLower === 'kg') {
    return 'kg';
  } else if (unitLower.includes('packet') || unitLower.includes('pack') || unitLower === 'pkt') {
    return 'packet';
  } else if (unitLower.includes('qty') || unitLower.includes('quantity') || unitLower.includes('count') || unitLower.includes('pcs') || unitLower.includes('piece')) {
    return 'quantity';
  } else if (unitLower.includes('liter') || unitLower.includes('litre') || unitLower === 'l') {
    return 'liter';
  } else if (unitLower.includes('milli') || unitLower === 'ml') {
    return 'ml';
  }
  
  return 'quantity';
}

// Helper function to escape single quotes in SQL strings
function escapeSqlString(str) {
  return str.replace(/'/g, "''");
}

// Run the SQL generation
generateImportSQL()
  .then(() => {
    console.log('SQL generation script finished');
  })
  .catch(error => {
    console.error('SQL generation script failed:', error);
  }); 