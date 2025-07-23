# Inventory Import Instructions

This document explains how to import inventory items from an Excel file into the NYP Inventory Management System.

## Prerequisites

- Node.js installed
- Access to the Supabase database
- Excel file named `InventoryListApril.xlsx` placed in the project root directory

## Excel File Format

The Excel file should have the following columns (headers can vary slightly):
- **Item Name/Description**: Name of the inventory item
- **Category**: Category of the item (will be created if it doesn't exist)
- **Unit**: Unit of measurement (grams, kg, packet, quantity, liter, ml)
- **Rate/Price/Cost**: Cost per unit in PKR

## Running the Import

### Option 1: Using the Batch File (Windows)

1. Simply double-click the `import_inventory.bat` file
2. Follow the prompts in the console window
3. The script will install necessary dependencies and run the import

### Option 2: Using npm

1. Open a terminal in the project root directory
2. Run `npm run import-inventory`
3. This will install the necessary dependencies and run the import script

### Option 3: Manual Execution

1. Open a terminal in the project root directory
2. Install the required dependencies:
   ```
   npm install exceljs @supabase/supabase-js dotenv
   ```
3. Run the import script:
   ```
   node src/scripts/insertInventoryItems.js
   ```

## Import Process

The script performs the following steps:
1. Reads the Excel file and identifies key columns
2. Checks for duplicate item names in the Excel file
3. Maps units to the system's unit types
4. Creates any categories that don't already exist
5. Updates existing items or creates new ones in the database

## Handling Special Cases

- **Duplicate Items**: If the Excel file contains duplicate item names, only the first one will be processed
- **Missing Categories**: If a category is not specified, the item will be added to "Another" category
- **Unit Types**: The script will map various unit descriptions to the system's standard unit types (grams, kg, packet, quantity, liter, ml)
- **Negative Rates**: Negative rates will be converted to 0

## Troubleshooting

If you encounter any issues during the import process:

1. Check that the Excel file is properly formatted with the required columns
2. Ensure the Excel file is in the correct location (project root directory)
3. Verify that your database credentials in the .env file are correct
4. Check the console output for specific error messages 