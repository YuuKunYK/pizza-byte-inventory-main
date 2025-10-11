# POS System Documentation

## Overview

A comprehensive Point of Sale (POS) system has been integrated into your inventory management application. The system supports dining and takeaway orders, automatic inventory deduction, discount management, and real-time analytics.

## Features Implemented

### ✅ Core Features

1. **Dual-Mode POS Interface**
   - Dining mode for dine-in orders
   - Takeaway mode for takeout orders
   - Separate tabs for easy switching

2. **Hierarchical Category System**
   - Parent categories (e.g., Pizzas, Drinks)
   - Subcategories (e.g., 1.5L, 1L, 250ml under Drinks)
   - Custom icons for categories

3. **Sale Item Management**
   - Link items to recipes for automatic cost calculation
   - Auto-deduct inventory on sale
   - Set prices independently of inventory
   - Toggle item availability

4. **Discount System**
   - Predefined discount rules (percentage or fixed amount)
   - Ad-hoc custom discounts during checkout
   - Multiple discount stacking support
   - Quick discount application

5. **Smart Cart Management**
   - Add/remove items
   - Adjust quantities
   - Real-time total calculation
   - Clear cart functionality

6. **Flexible Payment Options**
   - Cash
   - Card
   - Digital Wallet

7. **Analytics Dashboard**
   - Daily/Weekly/Monthly revenue
   - Profit tracking
   - Top-selling items
   - Low-margin item alerts
   - Sales by order type and payment method

8. **Role-Based Access Control**
   - Admin: Full access to POS and management
   - Branch: POS access for their location
   - Warehouse: No POS access

### 🔧 Technical Implementation

#### Database Tables Created

1. **pos_categories**
   - Hierarchical category structure
   - Parent-child relationships
   - Display ordering
   - Icon support

2. **pos_items**
   - Sale items with pricing
   - Recipe linkage for auto-cost calculation
   - Category/subcategory assignment
   - Availability toggle

3. **discount_rules**
   - Predefined discount templates
   - Percentage or fixed amount
   - Active/inactive status

4. **pos_sales**
   - Complete sale records
   - Order number generation
   - Itemized sale details
   - Payment and order type tracking
   - Profit calculation

#### Automatic Features

- **Auto-Cost Calculation**: When a recipe is linked to a POS item, the cost is automatically calculated from recipe ingredients
- **Auto-Inventory Deduction**: On sale completion, inventory is automatically deducted based on recipe requirements
- **Order Number Generation**: Unique order numbers in format `ORD-YYYYMMDD-NNNN`

## Getting Started

### Initial Setup

1. **Run the Database Migration**
   ```bash
   # In your Supabase project, run the migration file:
   # supabase/migrations/20250411_create_pos_system.sql
   ```

2. **Create Categories**
   - Navigate to Admin > POS Categories
   - Create parent categories (e.g., Pizzas, Drinks, Sides)
   - Create subcategories under parents (e.g., 12 inch, 16 inch under Pizzas)

3. **Create Sale Items**
   - Navigate to Admin > POS Items
   - Add items with prices
   - Link to recipes (optional but recommended)
   - Assign to categories

4. **Create Discount Rules** (Optional)
   - Navigate to Admin > POS Discounts
   - Create predefined discounts (e.g., "Student Discount - 10%")

### Using the POS

1. **Access the POS**
   - Click "Point of Sale" in the sidebar (between Dashboard and Inventory)
   - Choose Dining or Takeaway tab

2. **Process an Order**
   - Select category to filter items
   - Click on items to add to cart
   - Adjust quantities as needed
   - Apply discounts if applicable
   - Click "Checkout"
   - Select payment method
   - Add notes (optional)
   - Complete sale

3. **View Order History**
   - Click the History icon in the POS interface
   - View recent orders with details

4. **View Analytics**
   - Navigate to POS > Analytics (or from the main POS page)
   - Select time period (Today, Last 7 Days, Last 30 Days)
   - View revenue, profit, and performance metrics

## Navigation Structure

```
Main Menu
├── Dashboard
├── Point of Sale ⭐ NEW
│   ├── Dining
│   ├── Takeaway
│   └── Analytics
├── Inventory
├── ...
└── Admin (Admin only)
    ├── POS Categories ⭐ NEW
    ├── POS Items ⭐ NEW
    └── POS Discounts ⭐ NEW
```

## File Structure

```
src/
├── types/
│   └── pos.ts                    # TypeScript interfaces
├── lib/
│   └── pos-utils.ts              # Utility functions
├── hooks/
│   ├── usePOS.tsx                # Cart state management
│   ├── usePOSCategories.tsx      # Categories & items
│   ├── usePOSSales.tsx           # Sales operations
│   └── usePOSAnalytics.tsx       # Analytics data
├── components/pos/
│   ├── CategoryGrid.tsx          # Category selection
│   ├── ItemGrid.tsx              # Item display
│   ├── OrderSummary.tsx          # Cart sidebar
│   ├── Calculator.tsx            # Built-in calculator
│   ├── DiscountPanel.tsx         # Discount controls
│   ├── CheckoutDialog.tsx        # Payment dialog
│   ├── OrderHistoryDialog.tsx   # Order history
│   └── ReceiptPrint.tsx          # Print layout
├── pages/pos/
│   ├── POSMain.tsx               # Main POS page
│   ├── POSDining.tsx             # Dining interface
│   ├── POSTakeaway.tsx           # Takeaway interface
│   └── POSAnalytics.tsx          # Analytics page
└── pages/admin/
    ├── pos-categories.tsx        # Category management
    ├── pos-items.tsx             # Item management
    └── pos-discounts.tsx         # Discount management
```

## Key Concepts

### Price vs Cost

- **Price**: What the customer pays (set by admin in POS Items)
- **Cost**: What the item costs to make (auto-calculated from recipe ingredients)
- **Profit**: Price - Cost (calculated automatically)

### Recipe Linkage

When you link a POS item to a recipe:
1. Cost is automatically calculated from recipe ingredients
2. On sale, inventory is deducted based on recipe requirements
3. Cost updates automatically if recipe ingredients change

### Currency Handling

Internally, all prices are stored in paisa (PKR cents) for precision:
- 1 PKR = 100 paisa
- This prevents floating-point errors in calculations
- The UI automatically converts for display

### Order Flow

1. Items added to cart
2. Discounts applied (optional)
3. Tax calculated (currently 0%)
4. Checkout initiated
5. Payment method selected
6. Sale created in database
7. **Trigger fires** → Inventory automatically deducted
8. Order number generated
9. Receipt available for printing

## Admin Management

### Managing Categories

**Create Parent Category:**
```
Name: Pizzas
Parent: None
Display Order: 1
Icon: 🍕
```

**Create Subcategory:**
```
Name: 12 inch
Parent: Pizzas
Display Order: 1
Icon: 
```

### Managing Items

**Create Sale Item:**
```
Name: 12 inch Pepperoni Pizza
Category: Pizzas
Subcategory: 12 inch
Price: 1200 PKR
Recipe: Pepperoni Pizza (12 inch)
Available: Yes
```

The cost will be automatically calculated from the linked recipe.

### Managing Discounts

**Create Discount Rule:**
```
Name: Student Discount
Type: Percentage
Value: 10
Active: Yes
```

This discount will appear in the POS discount panel for quick application.

## Best Practices

1. **Always Link Recipes**: Link POS items to recipes for accurate cost tracking and inventory management
2. **Regular Analytics Review**: Check analytics daily to understand sales patterns
3. **Update Item Availability**: Mark items as unavailable when ingredients are low
4. **Use Predefined Discounts**: Create rules for commonly used discounts
5. **Add Item Images**: Images improve the POS user experience

## Troubleshooting

### Item cost shows as 0
- Check if item is linked to a recipe
- Verify the recipe has ingredients with costs

### Inventory not deducting
- Ensure the item is linked to a recipe
- Check that the recipe has valid inventory items
- Verify database triggers are running

### Cannot access POS
- Check user role (Warehouse users cannot access POS)
- Verify user is logged in with correct permissions

## Future Enhancements

The system is structured to support:
- Delivery mode (currently prepared but not active)
- Hold orders feature
- Multi-terminal support
- Kitchen display integration
- Receipt printer integration
- Customer loyalty program
- Advanced reporting and exports

## Support

For issues or questions:
1. Check database migration ran successfully
2. Verify RLS policies are active
3. Check browser console for errors
4. Review Supabase logs for trigger execution

## Migration File Location

```
supabase/migrations/20250411_create_pos_system.sql
```

Make sure to run this migration in your Supabase project before using the POS system.

