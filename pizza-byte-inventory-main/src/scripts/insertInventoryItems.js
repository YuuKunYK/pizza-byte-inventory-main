require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');

// Set up Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define unit type mapping
const mapUnitType = (unitFromExcel) => {
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
};

// Function to ensure a category exists
async function ensureCategoryExists(categoryName, categoryMap) {
  if (!categoryName) categoryName = 'Another';
  const normalizedCategoryName = categoryName.trim();
  const lowerCaseCategoryName = normalizedCategoryName.toLowerCase();
  
  // Check if we already have this category in our map
  if (categoryMap[lowerCaseCategoryName]) {
    return categoryMap[lowerCaseCategoryName];
  }
  
  // Check if the category exists in the database
  const { data: existingCategories, error: checkError } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', normalizedCategoryName);
  
  if (checkError) {
    console.error(`Error checking for category ${normalizedCategoryName}:`, checkError);
    // Fall back to "Another" category if there's an error
    return categoryMap['another'] || '';
  }
  
  if (existingCategories && existingCategories.length > 0) {
    // Store in our map for future lookups
    categoryMap[lowerCaseCategoryName] = existingCategories[0].id;
    return existingCategories[0].id;
  }
  
  // Category doesn't exist, create it
  console.log(`Creating new category: ${normalizedCategoryName}`);
  
  const { data: newCategory, error: insertError } = await supabase
    .from('categories')
    .insert({
      name: normalizedCategoryName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id');
  
  if (insertError || !newCategory) {
    console.error(`Error creating category ${normalizedCategoryName}:`, insertError);
    // Fall back to "Another" category
    return categoryMap['another'] || '';
  }
  
  // Store in our map for future lookups
  categoryMap[lowerCaseCategoryName] = newCategory[0].id;
  return newCategory[0].id;
}

// Main function to process Excel file and import data
async function importInventoryItems() {
  try {
    // First, get all existing categories
    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select('id, name');
    
    if (categoryError) {
      throw new Error(`Error fetching categories: ${categoryError.message}`);
    }
    
    // Create a map of category names to their IDs
    const categoryMap = categories.reduce((acc, category) => {
      acc[category.name.toLowerCase()] = category.id;
      return acc;
    }, {});
    
    // Ensure "Another" category exists
    if (!categoryMap['another']) {
      const anotherId = await ensureCategoryExists('Another', categoryMap);
      categoryMap['another'] = anotherId;
    }
    
    console.log('Category mapping:', categoryMap);
    
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
    
    // Process rows
    const items = [];
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let duplicateNames = new Set();
    let processedNames = new Set();
    
    // First pass: collect all items and detect duplicates
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;
      
      try {
        // Extract data from row
        const name = nameIndex >= 0 ? String(row.getCell(nameIndex + 1).value || '').trim() : '';
        
        // Skip rows without a name
        if (!name) {
          console.log(`Row ${rowNumber}: Skipping empty item name`);
          return;
        }
        
        // Check for duplicates in Excel file
        if (processedNames.has(name.toLowerCase())) {
          duplicateNames.add(name.toLowerCase());
          duplicateCount++;
          console.log(`Row ${rowNumber}: Duplicate item name "${name}" found in Excel file`);
        } else {
          processedNames.add(name.toLowerCase());
        }
      } catch (err) {
        console.error(`Error processing row ${rowNumber} in first pass:`, err);
      }
    });
    
    console.log(`Found ${duplicateCount} duplicate item names in Excel file`);
    
    // Second pass: process all items
    processedNames.clear(); // Reset for second pass
    
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;
      
      try {
        // Extract data from row
        const name = nameIndex >= 0 ? String(row.getCell(nameIndex + 1).value || '').trim() : '';
        const category = categoryIndex >= 0 ? String(row.getCell(categoryIndex + 1).value || '').trim() : 'Another';
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
        
        // Skip rows without a name
        if (!name) {
          return;
        }
        
        // Skip duplicates (take first occurrence only)
        if (duplicateNames.has(name.toLowerCase()) && processedNames.has(name.toLowerCase())) {
          console.log(`Row ${rowNumber}: Skipping duplicate item "${name}"`);
          return;
        }
        
        processedNames.add(name.toLowerCase());
        
        // Validate and clean data
        if (rate < 0) {
          console.log(`Row ${rowNumber}: Negative rate found for "${name}", using 0 instead`);
          rate = 0;
        }
        
        // Map unit type to enum value
        const unitType = mapUnitType(unit);
        
        // Create item object with cleaned data
        items.push({
          rowNumber,
          name,
          category: category || 'Another', // Default to "Another" if category is empty
          unitType,
          rate
        });
      } catch (err) {
        console.error(`Error processing row ${rowNumber}:`, err);
        errorCount++;
      }
    });
    
    // Process all items
    console.log(`Found ${items.length} valid items to process`);

    // Process items one by one
    const processItems = async () => {
      for (const item of items) {
        try {
          // Get or create category
          const categoryId = await ensureCategoryExists(item.category, categoryMap);
          
          // Check if the item already exists
          const { data: existingItems, error: checkError } = await supabase
            .from('inventory_items')
            .select('id')
            .eq('name', item.name);
          
          if (checkError) {
            console.error(`Error checking for existing item ${item.name}:`, checkError);
            errorCount++;
            continue;
          }
          
          if (existingItems && existingItems.length > 0) {
            console.log(`Updating existing item: ${item.name}`);
            
            // Update the existing item
            const { error: updateError } = await supabase
              .from('inventory_items')
              .update({
                category_id: categoryId,
                unit_type: item.unitType,
                cost_per_unit: item.rate,
                min_stock_threshold: 10, // Default value
                conversion_value: 1, // Default value
                updated_at: new Date().toISOString()
              })
              .eq('id', existingItems[0].id);
            
            if (updateError) {
              console.error(`Error updating item ${item.name}:`, updateError);
              errorCount++;
            } else {
              console.log(`Row ${item.rowNumber}: Updated ${item.name}`);
              successCount++;
            }
          } else {
            console.log(`Creating new item: ${item.name}`);
            
            // Insert the new item
            const { error: insertError } = await supabase
              .from('inventory_items')
              .insert({
                name: item.name,
                category_id: categoryId,
                unit_type: item.unitType,
                cost_per_unit: item.rate,
                min_stock_threshold: 10, // Default value
                conversion_value: 1, // Default value
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (insertError) {
              console.error(`Error inserting item ${item.name}:`, insertError);
              errorCount++;
            } else {
              console.log(`Row ${item.rowNumber}: Created ${item.name}`);
              successCount++;
            }
          }
        } catch (err) {
          console.error(`Error processing item ${item.name}:`, err);
          errorCount++;
        }
      }
      
      console.log(`Import completed: ${successCount} successful, ${errorCount} errors`);
    };

    // Run the processing
    await processItems();
    
  } catch (error) {
    console.error('Error during import:', error);
  }
}

// Run the import
importInventoryItems()
  .then(() => {
    console.log('Import script finished');
  })
  .catch(error => {
    console.error('Import script failed:', error);
  }); 