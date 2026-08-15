# Restaurant ERP

Multi-location restaurant operations: inventory, recipes, POS, stock transfers, and reporting.

## Setup

1. Install dependencies:

```
npm install
```

2. Copy environment variables (do not commit secrets):

```
cp .env.example .env
```

3. Apply database migrations in the Supabase SQL editor, including:

```
supabase/migrations/20260814_erp_integrity_core.sql
```

That migration is required for live POS stock deduction, cancel/restore, transfers, and request fulfillment.

4. Start the app:

```
npm run dev
```

## Accounts

Staff accounts are created by an administrator under **Manage Users**. Public self-signup is disabled.

Roles:

- **Admin** — catalog, locations, users, POS menu, all branches
- **Branch** — POS, own-location inventory, stock requests
- **Warehouse** — inventory, transfers, fulfilling requests (no POS)

## How the operational loop works

1. Recipes define ingredient quantities per dish.
2. POS items can be linked to a recipe.
3. Placing a POS order deducts those ingredients from **that branch's** `stock_entries`.
4. Cancelling an in-progress order restores the same stock.
5. Warehouses fulfill branch requests by transferring stock between locations in one transaction.

## Notes

- Link every sellable dish to a recipe or stock will not move.
- Low-stock and reports use the same branch ledger as POS.
- Never store live passwords in this README.
