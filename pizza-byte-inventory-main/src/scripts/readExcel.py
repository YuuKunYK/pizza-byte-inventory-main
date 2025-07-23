import pandas as pd
import os
import json

def read_excel_structure():
    # Current directory
    current_dir = os.getcwd()
    excel_path = os.path.join(current_dir, 'InventoryListApril.xlsx')
    
    print(f"Looking for Excel file at: {excel_path}")
    
    if not os.path.exists(excel_path):
        print(f"Excel file not found at: {excel_path}")
        return
    
    try:
        # Read the Excel file
        df = pd.read_excel(excel_path)
        
        # Print basic info
        print(f"Excel file successfully read")
        print(f"Number of rows: {len(df)}")
        print(f"Number of columns: {len(df.columns)}")
        print("\nColumn headers:")
        for col in df.columns:
            print(f"  - {col}")
        
        # Print first 5 rows
        print("\nFirst 5 rows:")
        print(df.head(5).to_string())
        
        # Save to JSON for inspection
        sample_data = df.head(10).to_dict(orient='records')
        with open('excel_sample.json', 'w') as f:
            json.dump(sample_data, f, indent=2)
        
        print("\nSample data saved to excel_sample.json")
        
    except Exception as e:
        print(f"Error reading Excel file: {str(e)}")

if __name__ == "__main__":
    read_excel_structure() 