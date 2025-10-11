<!-- 5934ae4d-c1ac-4562-933e-1379fc1c4a0c 24d9583a-555d-4413-8f4a-4d2c6c58ab67 -->
# POS System Integration Plan

## Overview

Replace the existing `/sales` route with a full-featured POS system that integrates seamlessly with the current inventory management system. The POS will be positioned in navigation between Dashboard and Inventory, accessible only to Admin and Branch users.

## Database Schema (Supabase Migrations)

### New Tables to Create

**1. pos_categories** - Hierarchical category system

```sql
- id (uuid, primary key)
- name (text)
- parent_category_id (uuid, nullable, references pos_categories)
- display_order (integer)
- icon (text, optional)
- created_at, updated_at
```

**2. pos_items** - Sale items with recipe linkage

```sql
- id (uuid, primary key)
- name (text)
- category_id (uuid, references pos_categories)
- subcategory_id (uuid, nullable, references pos_categories)
- price (integer) - in PKR (stored as cents for precision)
- recipe_id (uuid, nullable, references recipes)
- cost_per_item (integer) - auto-calculated from recipe
- available (boolean, default true)
- image_url (text, optional)
- description (text, optional)
- created_by (uuid, references auth.users)
- created_at, updated_at
```

**3. discount_rules** - Predefined discounts

```sql
- id (uuid, primary key)
- name (text)
- type (text) - 'percentage' or 'fixed'
- value (numeric)
- conditions (jsonb, optional) - for future advanced rules
- active (boolean, default true)
- created_by (uuid, references auth.users)
- created_at, updated_at
```

**4. sales** - Replace/upgrade existing sales table

```sql
- id (uuid, primary key)
- order_number (text, unique, auto-generated)
- items (jsonb) - array of {item_id, name, quantity, price, cost}
- subtotal (integer)
- discount_type (text) - 'percentage', 'fixed', or 'none'
- discount_value (numeric)
- discount_amount (integer)
- tax (integer)
- total_amount (integer)
- profit (integer) - calculated: total - sum(item_costs)
- payment_method (text) - 'cash', 'card', 'wallet'
- order_type (text) - 'dining', 'takeaway', 'delivery'
- branch_id (uuid, references locations)
- cashier_id (uuid, references auth.users)
- notes (text, optional)
- created_at, updated_at
```

### Database Functions/Triggers

**1. Auto-calculate cost_per_item** - Trigger on pos_items when recipe_id changes

**2. Auto-deduct inventory** - Function called on sale creation

**3. Low stock notification** - Trigger when stock falls below threshold

## Frontend Structure

### File Organization

```
src/
├── pages/
│   └── pos/
│       ├── POSMain.tsx           # Main POS page with tabs
│       ├── POSDining.tsx         # Dining mode interface
│       ├── POSTakeaway.tsx       # Takeaway mode interface
│       └── POSAnalytics.tsx      # Analytics dashboard
├── components/
│   └── pos/
│       ├── CategoryGrid.tsx      # Display categories
│       ├── ItemGrid.tsx          # Display sale items
│       ├── OrderSummary.tsx      # Right sidebar with order details
│       ├── Calculator.tsx        # Calculator panel
│       ├── DiscountPanel.tsx     # Discount controls
│       ├── CheckoutDialog.tsx    # Payment & finalize
│       ├── OrderHistoryDialog.tsx # View past orders
│       └── ReceiptPrint.tsx      # Print receipt layout
├── hooks/
│   ├── usePOS.tsx               # Main POS state management
│   ├── usePOSCategories.tsx     # Fetch categories & items
│   ├── usePOSSales.tsx          # Sales operations
│   └── usePOSAnalytics.tsx      # Analytics data
├── types/
│   └── pos.ts                   # All POS TypeScript interfaces
└── lib/
    └── pos-utils.ts             # Helper functions (tax calc, order number gen)
```

### Admin Pages

```
src/pages/admin/
├── pos-categories.tsx    # Manage categories & subcategories
├── pos-items.tsx         # Manage sale items
└── pos-discounts.tsx     # Manage discount rules
```

## Implementation Phases

### Phase 1: Database Setup

- Create migration file: `20250411_create_pos_system.sql`
- Define all tables with proper RLS policies
- Create helper functions for cost calculation
- Create inventory deduction function
- Add indexes for performance

### Phase 2: TypeScript Types & Utilities

- Define interfaces in `src/types/pos.ts`
- Create utility functions in `src/lib/pos-utils.ts`
- Order number generation (e.g., ORD-20251011-0001)
- Tax calculation helper
- Profit calculation helper

### Phase 3: Custom Hooks

- `usePOSCategories`: Fetch categories, subcategories, items
- `usePOS`: Main state manager (cart, selected items, totals)
- `usePOSSales`: Create sale, fetch sales history
- `usePOSAnalytics`: Dashboard metrics (revenue, profit, top items)

### Phase 4: POS Components

- Build reusable UI components
- CategoryGrid with subcategory expansion
- ItemGrid with search and filter
- OrderSummary with live calculations
- Calculator with discount application
- CheckoutDialog with payment options
- ReceiptPrint layout

### Phase 5: POS Main Pages

- POSMain: Tab navigation (Dining | Takeaway)
- POSDining: Full POS interface for dine-in
- POSTakeaway: Same interface, different order_type
- POSAnalytics: Revenue, profit, and sales metrics

### Phase 6: Admin Management Pages

- Categories management (CRUD with parent/child)
- Sale items management (link to recipes, set prices)
- Discount rules management (predefined discounts)

### Phase 7: Integration & Polish

- Replace SalesEntry.tsx with redirect to new POS
- Update Layout.tsx navigation order
- Add role-based access control (Admin, Branch only)
- Real-time inventory sync via Supabase subscriptions
- Toast notifications for low stock during sales
- Export sales data (CSV/PDF)

## Key Features

### Auto-Cost Calculation

- When admin links a recipe to a pos_item, trigger calculates cost from recipe ingredients
- Cost = sum of (ingredient.cost_per_unit * recipe_item.quantity)

### Inventory Deduction

- On sale completion, call Supabase function
- Function fetches all recipe ingredients
- Deducts quantities from branch's stock_entries
- Updates closing_stock for current day
- Triggers low-stock notifications if threshold crossed

### Discount System

- Predefined rules (e.g., "10% Off", "Student Discount")
- Ad-hoc manual entry (percentage or fixed amount)
- Can stack multiple discounts (applied sequentially)
- Shows discount breakdown in order summary

### Analytics Dashboard

- Daily/Weekly/Monthly filters
- Total revenue, estimated profit, order count
- Top-selling items (by quantity and revenue)
- Low-margin items
- Low-stock alerts from inventory
- Branch comparison (Admin only)

### Role-Based Access

- **Admin**: Full access to POS, admin pages, all analytics
- **Branch**: Access to POS for their location, own analytics
- **Warehouse**: No access to POS module

## UI/UX Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  [Dining] [Takeaway]               Daily: PKR 50,000    │
├───────────────────────────────┬─────────────────────────┤
│                               │   ORDER SUMMARY         │
│  Search: [_________] 🔍      │   • Item 1    x2  500   │
│                               │   • Item 2    x1  300   │
│  Categories:                  │                         │
│  [Pizzas] [Drinks] [Sides]   │   Subtotal:    800      │
│                               │   Discount:    -80      │
│  ┌─────┐ ┌─────┐ ┌─────┐    │   Tax (5%):    36       │
│  │ 🍕  │ │ 🍕  │ │ 🍕  │    │   ─────────────────     │
│  │Item1│ │Item2│ │Item3│    │   Total:       756      │
│  │ 500 │ │ 300 │ │ 450 │    │                         │
│  └─────┘ └─────┘ └─────┘    │   [Calculator 🧮]       │
│                               │   [Discounts 🏷️]       │
│  ┌─────┐ ┌─────┐ ┌─────┐    │                         │
│  │ 🥤  │ │ 🥤  │ │ 🍟  │    │   [Hold Order]          │
│  │Item4│ │Item5│ │Item6│    │   [Checkout ✓]          │
│  │ 150 │ │ 200 │ │ 250 │    │                         │
│  └─────┘ └─────┘ └─────┘    │                         │
└───────────────────────────────┴─────────────────────────┘
```

### Design Consistency

- Use existing Tailwind theme and shadcn/ui components
- Match dark theme from current app
- Use Card, Button, Badge, Dialog from shadcn/ui
- Smooth animations with Framer Motion
- Responsive grid layouts

## Navigation Update

Update `src/components/Layout.tsx`:

```typescript
const commonMenuItems = [
  { icon: Home, text: 'Dashboard', to: '/' },
  { icon: CreditCard, text: 'Point of Sale', to: '/sales' }, // NEW POSITION
  { icon: Package, text: 'Inventory', to: '/inventory' },
  // ... rest
];
```

## Testing Checklist

- [ ] Categories can be created with subcategories
- [ ] Sale items link to recipes and auto-calculate cost
- [ ] Adding items to cart updates totals
- [ ] Discounts apply correctly (predefined + ad-hoc)
- [ ] Checkout creates sale and deducts inventory
- [ ] Low stock triggers notifications
- [ ] Analytics show correct revenue/profit
- [ ] Role-based access enforced
- [ ] Real-time updates work across terminals
- [ ] Receipt prints correctly

### To-dos

- [ ] Create Supabase migration with pos_categories, pos_items, discount_rules, and upgraded sales table with proper RLS policies
- [ ] Create database functions for auto-cost calculation, inventory deduction, and low-stock triggers
- [ ] Define TypeScript interfaces for POS entities in src/types/pos.ts
- [ ] Create helper functions in src/lib/pos-utils.ts for order numbers, tax, profit calculations
- [ ] Build custom hooks: usePOSCategories, usePOS, usePOSSales, usePOSAnalytics
- [ ] Create reusable POS components: CategoryGrid, ItemGrid, OrderSummary, Calculator, DiscountPanel, CheckoutDialog, ReceiptPrint
- [ ] Build main POS pages: POSMain with tabs, POSDining, POSTakeaway, POSAnalytics
- [ ] Create admin management pages for categories, sale items, and discount rules
- [ ] Update Layout.tsx navigation to position POS between Dashboard and Inventory, replace SalesEntry route in App.tsx
- [ ] Implement role-based access control for Admin and Branch users only
- [ ] Add real-time inventory sync and low-stock notifications using Supabase subscriptions
- [ ] Implement sales data export functionality (CSV/PDF) in analytics page