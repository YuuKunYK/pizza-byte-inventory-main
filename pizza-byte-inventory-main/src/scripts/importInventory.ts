import * as XLSX from 'xlsx';
import { supabase } from '../integrations/supabase/client';
import { UnitType } from '../types/inventory';
import * as fs from 'fs';
import * as path from 'path';

// Define the structure of the inventory item to be imported
interface InventoryItemImport {
  name: string;
  category_id: string;
  unit_type: UnitType;
  cost_per_unit: number;
  min_stock_threshold?: number;
  conversion_value?: number;
}

// Define category structure
interface Category {
  id: string;
  name: string;
}

// Define a mapping of category names to their IDs
let categoryMap: Record<string, string> = {};

// Main function to import inventory data
async function importInventoryData(filePath: string) {
  try {
    console.log('Starting import process...');
    
    // Read categories from database to map them
    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select('id, name');
    
    if (categoryError) {
      throw new Error(`Error fetching categories: ${categoryError.message}`);
    }
    
    // Create a map of category names to their IDs
    categoryMap = categories.reduce((acc, category) => {
      acc[category.name.toLowerCase()] = category.id;
      return acc;
    }, {} as Record<string, string>);
    
    console.log('Category mapping:', categoryMap);
    
    // Read the Excel file
    console.log(`Reading Excel file from: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert the sheet to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Found ${rawData.length} items in Excel file`);
    
    // Process and transform the data
    const inventoryItems = await processExcelData(rawData);
    
    // Import data to the database
    await importToDatabase(inventoryItems);
    
    console.log('Import completed successfully!');
  } catch (error) {
    console.error('Error during import:', error);
  }
}

// Process the Excel data and convert it to the format needed for the database
async function processExcelData(rawData: any[]): Promise<InventoryItemImport[]> {
  const inventoryItems: InventoryItemImport[] = [];
  
  for (const row of rawData) {
    // Extract relevant fields from the Excel row
    // Adjust these field names based on your Excel column headers
    const name = row.Name || row.Item || row.ItemName || row.Description;
    const categoryName = row.Category || row.CategoryName || row.Type || 'Another';
    const unitType = mapUnitType(row.Unit || row.UnitType || row.UnitOfMeasure || 'quantity');
    const costPerUnit = parseFloat(row.Rate || row.Price || row.Cost || row.CostPerUnit || '0');
    
    if (!name) continue; // Skip rows without a name
    
    // Check if the category exists, if not create it
    let categoryId = await ensureCategoryExists(categoryName);
    
    // Create the inventory item object
    const item: InventoryItemImport = {
      name: name.trim(),
      category_id: categoryId,
      unit_type: unitType,
      cost_per_unit: isNaN(costPerUnit) ? 0 : costPerUnit,
      // Optional fields
      min_stock_threshold: 10, // Default value
      conversion_value: 1 // Default value
    };
    
    inventoryItems.push(item);
  }
  
  return inventoryItems;
}

// Import the processed data to the database
async function importToDatabase(inventoryItems: InventoryItemImport[]) {
  console.log(`Importing ${inventoryItems.length} items to database...`);
  
  for (const item of inventoryItems) {
    // Check if the item already exists
    const { data: existingItems, error: checkError } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('name', item.name);
    
    if (checkError) {
      console.error(`Error checking for existing item ${item.name}:`, checkError);
      continue;
    }
    
    if (existingItems.length > 0) {
      console.log(`Item ${item.name} already exists, updating...`);
      
      // Update the existing item
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          category_id: item.category_id,
          unit_type: item.unit_type,
          cost_per_unit: item.cost_per_unit,
          min_stock_threshold: item.min_stock_threshold,
          conversion_value: item.conversion_value,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItems[0].id);
      
      if (updateError) {
        console.error(`Error updating item ${item.name}:`, updateError);
      } else {
        console.log(`Updated item: ${item.name}`);
      }
    } else {
      console.log(`Creating new item: ${item.name}`);
      
      // Insert the new item
      const { error: insertError } = await supabase
        .from('inventory_items')
        .insert({
          ...item,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error(`Error inserting item ${item.name}:`, insertError);
      } else {
        console.log(`Inserted new item: ${item.name}`);
      }
    }
  }
}

// Ensure category exists, create if it doesn't
async function ensureCategoryExists(categoryName: string): Promise<string> {
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
  
  if (existingCategories.length > 0) {
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

// Map Excel unit types to database unit types
function mapUnitType(unitFromExcel: string): UnitType {
  const unitLower = unitFromExcel.toLowerCase().trim();
  
  // Map common variations of unit types
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
  
  // Default to quantity if unknown
  return 'quantity';
}

// Main execution
const excelFilePath = path.resolve(process.cwd(), 'InventoryListApril.xlsx');

if (!fs.existsSync(excelFilePath)) {
  console.error(`Excel file not found at path: ${excelFilePath}`);
  process.exit(1);
}

// Run the import
importInventoryData(excelFilePath).catch(console.error);

// Export the functions for testing or reuse
export { importInventoryData, processExcelData, importToDatabase, ensureCategoryExists, mapUnitType }; 