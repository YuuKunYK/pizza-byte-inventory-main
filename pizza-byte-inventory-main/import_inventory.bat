@echo off
echo Installing required dependencies...
call npm install exceljs @supabase/supabase-js dotenv
echo.
echo Running import script...
node src/scripts/insertInventoryItems.js
echo.
echo Import process completed.
pause 