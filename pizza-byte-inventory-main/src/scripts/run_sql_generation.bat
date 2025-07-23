@echo off
echo Installing required dependencies...
call npm install exceljs dotenv
echo.
echo Generating SQL files from Excel data...
node .\src\scripts\import_sql.js
echo.
echo SQL generation completed. The following files were created:
echo - import_categories.sql: SQL to create categories
echo - import_items.sql: SQL to create inventory items
echo - import_all.sql: Combined SQL script
echo.
echo You can run these SQL files directly in Supabase SQL Editor.
pause 