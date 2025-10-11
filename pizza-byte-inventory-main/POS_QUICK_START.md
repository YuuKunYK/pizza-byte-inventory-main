# POS System - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Run the Database Migration (1 min)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20250411_create_pos_system.sql`
4. Click **Run**
5. Verify: You should see "Success. No rows returned"

### Step 2: Create Your First Category (1 min)

1. Login to your app as Admin
2. Navigate to **Admin > POS Categories** (in sidebar)
3. Click **Add Category**
4. Fill in:
   - Name: `Pizzas`
   - Parent Category: `None (Main Category)`
   - Display Order: `1`
   - Icon: `🍕`
5. Click **Create**

### Step 3: Create a Subcategory (30 sec)

1. Still in POS Categories
2. Click **Add Category**
3. Fill in:
   - Name: `12 inch`
   - Parent Category: `Pizzas`
   - Display Order: `1`
4. Click **Create**

### Step 4: Create Your First Item (1 min)

1. Navigate to **Admin > POS Items** (in sidebar)
2. Click **Add Item**
3. Fill in:
   - Name: `12 inch Pepperoni Pizza`
   - Price: `1200` (PKR)
   - Category: `Pizzas`
   - Subcategory: `12 inch`
   - Recipe: Select an existing recipe (optional but recommended)
   - Available: `Yes`
4. Click **Create**

### Step 5: Make Your First Sale! (1 min)

1. Navigate to **Point of Sale** (in sidebar, between Dashboard and Inventory)
2. Click the **Dining** tab
3. You should see your item in the grid
4. Click on the item to add it to cart
5. Review the order summary on the right
6. Click **Checkout**
7. Select **Payment Method** (Cash, Card, or Wallet)
8. Click **Complete Sale**
9. Done! 🎉

## ✅ What Happened Behind the Scenes

When you completed that sale:
- ✅ Order number was generated (e.g., ORD-20251011-0001)
- ✅ Sale was recorded in the database
- ✅ If you linked a recipe, inventory was automatically deducted
- ✅ Profit was calculated and stored
- ✅ You can now see this sale in Analytics

## 📊 View Your Analytics

1. Navigate to **Point of Sale**
2. Look at the top cards showing:
   - Today's Revenue
   - Estimated Profit
   - Orders Today

Or click the **Analytics** button for detailed reports.

## 🎯 What's Next?

### Add More Items
- Create more categories (Drinks, Sides, Desserts)
- Create subcategories (1.5L, 1L, 250ml under Drinks)
- Add more items to sell

### Create Discount Rules
1. Navigate to **Admin > POS Discounts**
2. Create common discounts like:
   - Student Discount (10%)
   - Happy Hour (15%)
   - Loyalty Discount (PKR 100 off)
3. These will appear in the POS for quick application

### Link Items to Recipes
For accurate cost tracking and automatic inventory deduction:
1. Edit your POS items
2. Link them to existing recipes
3. Cost will be automatically calculated
4. Inventory will be automatically deducted on sale

## 💡 Pro Tips

1. **Use Categories Wisely**: Create a clear hierarchy (Parent → Subcategories)
2. **Always Link Recipes**: This enables auto-cost calculation and inventory tracking
3. **Check Analytics Daily**: Monitor performance and identify top sellers
4. **Create Discount Rules**: Faster than entering custom discounts each time
5. **Mark Out-of-Stock Items**: Toggle "Available" to No when ingredients are low

## 🆘 Common Issues

### "Item cost is 0"
**Solution**: Link the item to a recipe that has ingredients with costs.

### "Can't access POS"
**Solution**: Make sure you're logged in as Admin or Branch user (not Warehouse).

### "Inventory not deducting"
**Solution**: Ensure the item is linked to a recipe with valid inventory items.

## 📚 Need More Help?

- **Full Documentation**: See `POS_SYSTEM_README.md`
- **Technical Details**: See `POS_IMPLEMENTATION_SUMMARY.md`
- **Database Schema**: See `supabase/migrations/20250411_create_pos_system.sql`

## 🎉 You're Ready!

Start processing orders and watch your business data come to life in real-time analytics!

---

**Questions?** Check the README files or review the code comments for detailed explanations.

