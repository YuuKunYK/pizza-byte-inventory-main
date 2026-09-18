# Restaurant OS — Product Requirements Document

**Product working name:** NYP Restaurant OS (evolve from “NYP Inventory”)  
**Codebase:** `pizza-byte-inventory-main`  
**Market:** Pakistan pizza / QSR / multi-branch restaurants (PKR, Asia/Karachi)  
**Audience for this document:** an implementation model (Fable 5 or similar) that will rebuild and extend the existing app into the only operations system a restaurant needs.

---

## 0. Instructions for the implementing model

Read this entire PRD before writing code.

This is a **brownfield upgrade**, not a greenfield demo.

1. **Keep the existing stack** unless a section explicitly says to replace it: React 18, Vite, TypeScript, TanStack Query, React Router 6, shadcn/ui + Tailwind, Supabase (Auth + Postgres + Realtime), react-hook-form + zod, recharts.
2. **Keep the working operational loop.** Recipes → POS items → `create_pos_order` RPC → ingredient deduction from that branch’s `stock_entries` → cancel restores stock → warehouse fulfills requests via `fulfill_stock_request` / `transfer_stock`. Do not go back to updating a global `inventory_items.current_stock` field.
3. **Money is integer paisa.** 100 paisa = 1 PKR. Never store rupees as floats.
4. **Server is the source of truth.** Any stock, payment, void, transfer, or permission check that today lives only in the client must move into Postgres RPCs / Edge Functions with RLS.
5. **Do not silently succeed.** If an RPC is missing, fail loudly. Today `src/lib/erp.ts` returns “stock OK” when `check_pos_stock_availability` does not exist. That is a production bug.
6. **Do not invent a second inventory model.** Extend `stock_entries` + `inventory_movements`.
7. **Ship in phases.** Phase 0 (hardening) before flashy features. A restaurant cannot run on a POS that sometimes does not deduct stock.
8. **Pakistan-first.** JazzCash / EasyPaisa / Raast, WhatsApp receipts, Urdu+English, FBR digital invoicing, Foodpanda/Cheetay-style aggregator tickets, Ramadan hours.
9. **Pizza-first, restaurant-general.** Half-and-half, crust, extra toppings, dough config, and size tags already exist. Generalize them into a modifier engine so the same product can run a cafe or a grill later.
10. **Preserve multi-location.** Admin / Branch / Warehouse is the correct backbone. Add finer permissions on top; do not collapse to a single-store POS.

When a current file already does the job, **extend it**. Do not rewrite `Recipes.tsx` (≈2000 lines) from scratch unless you first extract hooks/components. Prefer extraction over replacement.

---

## 1. Vision

Build one system a restaurant owner can run the entire business on:

- Guests order (counter, table, QR, phone, aggregator, website).
- Kitchen cooks from a live ticket.
- Cash, cards, and wallets are reconciled per shift.
- Ingredients leave the correct branch the moment food is sold.
- Warehouse restocks branches.
- Managers see today, this week, and this month in PKR and in food cost %.
- Staff clock in, managers approve voids, accountants export to FBR / Excel.
- Customers come back via WhatsApp, loyalty, and saved addresses.

If the owner still needs a separate spreadsheet, a separate KDS iPad app, a separate attendance app, a separate accounting tool, or a WhatsApp group for “send 10kg mozzarella to Ocean Mall,” this product is not done.

**North-star sentence:**  
*From dough in the warehouse to cash in the drawer, every action is one login, one ledger, one source of truth.*

---

## 2. What this project is today

A **multi-location pizza restaurant ERP prototype** branded **New York Pizza / NYP Inventory**, built for a Pakistan chain (Ocean Mall and other branches + warehouse).

It is **not** yet a full restaurant OS. It is a strong **inventory + recipe + basic POS + transfer** core with a kitchen-style order board.

### 2.1 Stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript + Vite 5 |
| Routing | react-router-dom v6 |
| Server state | TanStack React Query v5 |
| UI kit | shadcn/ui (Radix) + Tailwind |
| Backend | Supabase Auth, Postgres, Realtime |
| Forms | react-hook-form + zod |
| Charts | recharts |
| Domain money | integer paisa |

### 2.2 Roles (keep and extend)

| Role | Today | Keep? |
|---|---|---|
| `admin` | Catalog, users, locations, POS menu, all branches | Yes — becomes org owner / HQ |
| `branch` | POS, own-location inventory, recipes, stock requests | Yes — becomes store staff container |
| `warehouse` | Inventory, transfers, fulfilling requests; no POS | Yes |

Public self-signup is correctly disabled. Admins create staff.

### 2.3 Routes that exist

| Path | Page | Who |
|---|---|---|
| `/login` | Login | Public |
| `/` | Dashboard (inventory value, low stock, pending requests, recent logs) | Authed |
| `/inventory` | Location stock, receiving, adjustments | Authed |
| `/item-management` | Global SKU catalog + unit conversions | Admin |
| `/recipes` | Recipe CRUD, pizza tags, dough config | Admin, Branch |
| `/requests` | Branch → warehouse stock requests | Authed |
| `/transfers` | Direct inter-location transfers | Admin, Warehouse, Branch |
| `/pos` | Order board (dine-in / takeaway / delivery tabs) | Admin, Branch |
| `/pos/new-order` | Popup cart + checkout | Admin, Branch |
| `/pos/analytics` | Client-side POS analytics | Admin, Branch |
| `/admin/pos-categories` | Menu categories | Admin |
| `/admin/pos-items` | Sellable items, price, recipe link | Admin |
| `/admin/pos-discounts` | Discount rules | Admin |
| `/admin/users` | Staff CRUD | Admin |
| `/admin/locations` | Branches and warehouses | Admin |
| `/logs` | Activity log viewer | Admin |
| `/settings` | Restaurant name, tax %, timezone | Authed (write = admin) |
| `/reports` | Mixed inventory + POS report | Authed |

Legacy leftovers (do not keep as parallel UIs): `src/pages/Index.tsx`, `src/pages/ManageLocations.tsx`, `POSDining.tsx` / `POSTakeaway.tsx` as thin re-exports.

### 2.4 How the operational loop works (this is the product’s real value)

1. Admin defines **inventory items** (mozzarella, dough flour, Pepsi) with **base units** and **purchase conversions** (crate → pcs, liter → ml).
2. Admin (or branch) builds **recipes**: grams of each ingredient per dish, with pizza **size / type / flavor tags** and **dough configuration** tables for pizza and calzone sizes.
3. Admin creates **POS items** (menu) priced in paisa and optionally **linked to a recipe**.
4. Cashier opens **New Order** (popup window), adds items, optional discounts, checkout (cash / card / wallet).
5. Server RPC `create_pos_order` expands the recipe into ingredients and calls `apply_stock_delta` on that **branch’s** `stock_entries`.
6. Kitchen-style **order board** moves status: `pending → preparing → ready → served → completed` (or `cancelled`).
7. Cancel via `update_pos_order_status` **restores** stock (`sale_void`).
8. When a branch is low, it **requests** stock from a warehouse. Warehouse **fulfills** with `fulfill_stock_request` (atomic transfer).
9. Admins can also **transfer** stock directly.

**Critical business rule already documented in README:** if a sellable dish is not linked to a recipe, **stock will not move**. The new product must make that impossible to miss (block sale of unlinked items in production, or warn in staging).

---

## 3. What already works (do not break)

Treat these as assets. Tests should lock them in Phase 0.

### 3.1 Inventory ledger

- Per-location `stock_entries` with `closing_stock` as the live quantity.
- Movement types: warehouse receiving, local purchasing, transfer in/out, discarded.
- Low / critical vs `min_stock_threshold`.
- Unit conversion system (`src/lib/units.ts`) with presets (crate=12, L=1000ml) and “suspicious 1:1” warnings.
- Beverage conversion data fixes in migrations.
- Admin sees all locations; branch is locked to theirs.

### 3.2 Recipes (pizza-specific, unusually good)

- Recipe + `recipe_items` bill of materials.
- Ingredient sections: dough / sauce / toppings / other.
- Tags: size, type, flavor with one-tag-per-category enforcement for size/type.
- Dough config tables: `pizza_dough_config`, `calzone_dough_config`.
- Cost can be derived from ingredient `cost_per_unit`.

### 3.3 POS happy path (when ERP migration is applied)

- Hierarchical POS categories and items.
- Cart, quantity, stacked discounts, tax from business settings.
- Payment methods: cash, card, wallet.
- Order types: dining (requires table number), takeaway, delivery (tab exists).
- Order numbers `ORD-YYYYMMDD-NNNN`.
- Order board with search/filter, detail panel, status buttons.
- Browser receipt print.
- Stock availability check RPC (when deployed).
- Profit stored on the sale (price − recipe cost − discounts).

### 3.4 Multi-location ops

- Locations typed `branch` | `warehouse`.
- Stock requests with realtime notifications.
- Transfers with `inventory_movements` audit (ERP).
- Role-based nav (warehouse hides POS and Recipes).

### 3.5 ERP SQL (`supabase/migrations/20260814_erp_integrity_core.sql`)

This is the most important file in the repo. It:

- Adds `inventory_movements`.
- Implements `apply_stock_delta`, `expand_sale_ingredients`, `check_pos_stock_availability`, `create_pos_order`, `update_pos_order_status`, `adjust_location_stock`, `fulfill_stock_request`, `transfer_stock`.
- Fixes RLS to use `profiles.role` via `current_profile_role()` / `is_admin()` instead of JWT `role` (which is always `authenticated`).
- Drops the broken `deduct_inventory_on_sale` trigger that mutated `inventory_items.current_stock`.

**Required:** every environment must apply this migration. README already says so.

### 3.6 UX / product taste to preserve

- Order board as the main POS screen, New Order as a dedicated composer (good for pizza shops).
- Simple three-role model as the default; power users get extra permissions later.
- PKR, Karachi timezone, New York Pizza branding as defaults that settings can override.

---

## 4. What does not work, or is not production-ready

### 4.1 Blockers (fix before new features)

| ID | Problem | Why it matters | Required fix |
|---|---|---|---|
| B1 | **No base schema in repo.** Migrations assume `profiles`, `locations`, `stock_entries`, `recipes`, `recipe_items` already exist. Fresh install is impossible from git. | Cannot onboard a second restaurant or rebuild staging. | Add a numbered `000_baseline.sql` (or squash) that creates all core tables. |
| B2 | **Hardcoded Supabase URL + anon key** in `src/integrations/supabase/client.ts`. `.env.example` exists but the generated client ignores it. Duplicate client in `src/lib/supabase.ts`. | Secrets in git; cannot point at another project. | Single client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Empty generated `types.ts` must be regenerated. |
| B3 | **Silent RPC fallbacks** in `src/lib/erp.ts`: missing stock-check RPC → treat as OK; missing create/update RPC → insert/update `pos_sales` with **no stock movement**. | Inventory and sales diverge silently. | Fail closed. Show “ERP functions not installed”. Never sell without deduction in production. |
| B4 | **`auth.admin.*` called from the browser** in `admin/users.tsx` (update/delete users). Create uses `signUp` then `setSession` to restore admin — fragile. | Privilege escalation; breaks when anon key is correctly scoped. | Supabase Edge Function with service role: `createStaff`, `updateStaff`, `deactivateStaff`. |
| B5 | **POS items without recipes do not deduct stock**, with only a toast after the fact. | Food cost and inventory become fiction. | Configurable policy: `block` (default) or `allow_with_flag`. Dashboard widget: “unlinked menu items”. |
| B6 | **Legacy stock path** in `useInventory.updateStock` can patch `stock_entries` without `inventory_movements`. | Two write paths, audits lie. | One write path: always `adjust_location_stock`. |
| B7 | **Original POS RLS used `auth.jwt()->>'role'`.** Fixed only if ERP migration ran. | Branch users may see/edit everything, or nothing works. | Migration checklist + health page that probes RPCs and RLS. |
| B8 | **Zero automated tests** except `scripts/test-units.ts`. No CI. | Every new feature will regress stock. | Vitest for units, paisa math, discount stacking; SQL tests for RPCs (pgTAP or supabase test). |
| B9 | **`activity-logger.ts` is unused.** Logs are incomplete and inconsistently typed (`entity_type: 'inventory'` on stock requests). | Cannot investigate theft or voids. | Wire logging into every mutation; tighten `activity_logs` RLS to admin + own-location managers. |
| B10 | **Analytics pull all `pos_sales` into the browser.** | Will die at a few thousand orders. | SQL views / RPCs: `pos_daily_summary`, `pos_item_sales`, date-range filters server-side. Export currently stubbed. |

### 4.2 Security / RLS gaps that remain after ERP

- `recipe_tags`: any authenticated user can mutate tags.
- Dough config: any authenticated user can update.
- `activity_logs`: all authenticated users can SELECT all logs (ERP did not tighten).
- Organizations table exists; UI is not multi-tenant. Fine for v1 single-org, but `organization_id` must be on every new table so a later SaaS split is possible.

### 4.3 Product holes (features that look present but are not)

| Area | Illusion | Reality |
|---|---|---|
| Delivery tab | Third POS mode | Same as takeaway. No address, phone, rider, fee, ETA, aggregator. |
| Wallet payment | JazzCash-class | Unspecified “wallet”. No tender breakdown, no reference ID. |
| Tax | Settings field | Toast says it applies “on this device”. Mix of `organization_settings` + localStorage. Not FBR. |
| Receipts | Print exists | Browser print, not thermal ESC/POS. No NTN/STRN, no FBR QR. |
| KDS | Order board | Shared with cashier. No station routing (pizza vs drinks), no bump bar, no sound, no fullscreen kitchen theme. |
| New Order popup | `window.open` | Blocked by browsers, painful on iPad, no offline, two windows to babysit. |
| Admin POS location | Admin can use POS | Uses admin’s `locationId` if set; no explicit “I am ringing Ocean Mall”. Dangerous. |
| Export buttons | Icons on analytics/inventory | Not implemented. |
| Notifications | Realtime | In-app only. No WhatsApp, SMS, or push. |
| Settings | “Business profile” | Name, tax, timezone. No logo upload, receipt footer, NTN, phone, printers, stations. |
| Users | CRUD | Coarse roles. No cashier vs kitchen vs manager. No PIN. No clock-in. |

### 4.4 Engineering debt (will slow Fable 5 if ignored)

- `Recipes.tsx` is a monolith (~2000 LOC). Extract: tag editor, dough tables, ingredient grid, cost preview.
- Competing root SQL scripts: `AUTO_TAG_RECIPES.sql`, `COMPLETE_AUTO_TAGGING.sql`, `FIXED_TAGGING_SCRIPT.sql`, `FIXED_TAGGING_SCRIPT_V2.sql`, `run_tagging_migration.sql`, two activity-log “fixed” scripts. Archive or delete; one official path.
- Empty `src/integrations/supabase/types.ts` — no generated Database types.
- Dual toast systems (sonner + shadcn toaster + react-hot-toast dependency).
- POS docs (`POS_SYSTEM_README.md`) still describe the **pre-redesign** “items on the POS page” flow. They will mislead any model that reads them. Update or delete.
- Hardcoded seed: Ocean Mall + `yousufkhatri2006@gmail.com` profile not tied to `auth.users`. Remove from production migrations; keep in `seed`.
- Default restaurant name “New York Pizza” is fine as seed, not as unchangeable brand in code (`ReceiptPrint`, settings hook).

### 4.5 Honest capability score (today vs “only software they need”)

Scores are implementation completeness, not UI polish.

| Capability | Score | Notes |
|---|---|---|
| Inventory / warehouse | 70% | Best part of the app |
| Recipes / food cost ingredients | 65% | Pizza-specific, needs modifiers |
| POS order capture | 55% | No modifiers, holds, splits, tips |
| Kitchen tickets | 40% | Board exists, not a KDS |
| Transfers / requests | 75% | Strong if ERP applied |
| Auth / permissions | 40% | 3 roles, unsafe user admin |
| Reports | 30% | Client-side, no EOD |
| Menu management | 50% | Categories/items/discounts |
| Tables / floor | 5% | Table number string only |
| Delivery ops | 5% | Tab only |
| Payments / till | 20% | Method enum, no shift |
| Customers / loyalty | 0% | Name optional on order |
| Purchasing / vendors | 5% | “Local purchasing” movement only |
| Staff / HR | 0% | |
| Accounting / FBR | 0% | |
| Online / QR order | 0% | |
| Hardware / offline | 0% | |
| Notifications (WhatsApp) | 5% | In-app only |
| **Overall restaurant OS** | **~22%** | Core loop is real; the rest of the restaurant is missing |

---

## 5. Recommended changes to the *current* product (Phase 0)

Do these before adding “restaurant OS” modules. They make Fable 5’s later work safe.

1. **Baseline schema + generated types + env-based client.**
2. **Health check page** (admin): RPC exists? ERP migration version? Unlinked POS items? Locations without stock entries?
3. **Fail closed** in `erp.ts`. Feature flag `ALLOW_POS_WITHOUT_ERP=false` in production.
4. **Staff Edge Functions**; remove `auth.admin` from the browser.
5. **Force recipe link** on POS items that are `inventory_tracked=true` (new column; drinks in bottles may be 1:1 items instead of recipes).
6. **Support 1:1 POS item → inventory item** (Pepsi 1.5L sold = 1 stock unit) *in addition to* recipe expansion. Today beverages are awkward if they are not recipes.
7. **Replace `window.open` New Order** with a full-route / slide-over / second-screen that works on iPad Safari.
8. **Admin must pick a branch** before ringing. Persist `active_location_id` on the device session.
9. **Server-side daily summary RPC.** Kill full-table analytics fetch.
10. **Unify logging.** One `log_activity` helper; RLS; include POS voids, price changes, stock adjusts.
11. **Tighten RLS** on tags, dough, logs.
12. **Delete or archive** duplicate SQL and unused pages.
13. **Thermal receipt template** even if first printer is “browser print to 80mm PDF” — layout with NTN placeholder.
14. **Tests** for: paisa rounding, discount stack order, `expand_sale_ingredients`, cancel restores stock, transfer atomicity, branch cannot deduct another branch.

---

## 6. Target users and jobs

### 6.1 Personas

| Persona | Device | Jobs |
|---|---|---|
| Cashier / waiter | POS tablet / desktop | Ring orders fast, apply discounts with manager PIN, take cash, print, send to kitchen |
| Kitchen (pizza / tandoor / drinks) | Wall tablet | See only their tickets, bump when done, see modifiers (no onion, extra cheese) |
| Branch manager | Laptop + phone | Open/close shift, approve voids, 86 items, request stock, see today’s sales vs labor |
| Warehouse / commissary | Laptop | Receive purchases, portion dough, fulfill branch requests, count stock |
| HQ / owner (admin) | Laptop | All branches, menu, recipes, users, P&L, food cost, FBR |
| Rider | Phone (later) | Assigned deliveries, cash collect, status |
| Guest | Phone | QR order at table, WhatsApp order status, loyalty |
| Accountant | Laptop | Z-report, tax, export |

### 6.2 Jobs the current app already helps

- Know mozzarella kg at Ocean Mall vs warehouse.
- Convert a crate of Pepsi into sellable units.
- Cost a 12" BBQ chicken pizza from ingredients + dough weight.
- Ring a dine-in order and see it on a board.
- Pull stock from warehouse to a branch.

### 6.3 Jobs owners still do outside this app (must pull in)

- “Make this pizza half fajita half tikka, stuffed crust, no olives.”
- Split a bill three ways; add 8% service; tip out.
- Open cash drawer; count till; record petty cash; close shift.
- 86 mushroom; 86 should hide on POS and QR instantly.
- Foodpanda tablet vs in-house POS double-cooking.
- WhatsApp the customer “your order is ready.”
- Schedule 12 staff for Friday night; overtime.
- FBR invoice.
- Pay the mozzarella supplier; record invoice; three-way match.
- Table 7 has been sitting 40 minutes.
- Online order from Instagram / website.

---

## 7. Product principles

1. **Speed at the counter beats beauty.** Three taps to a cheese pizza. Modifiers are progressive disclosure, not a wall of checkboxes.
2. **One ledger.** Sales, waste, transfers, purchases, comps all hit `inventory_movements` with a reason code.
3. **Station-aware.** Pizza make line should not see bottled drinks tickets.
4. **Offline-tolerant POS.** Local queue; sync; never double-charge; never double-deduct.
5. **Permissions are verbs.** `pos.void`, `pos.discount.above_10`, `stock.adjust`, `recipe.edit`, `fbr.submit`.
6. **Pakistan default, white-label capable.** NYP branding is a tenant theme, not hardcoded strings in 20 files.
7. **Pizza modifiers are a first-class object**, not notes in a text field. Notes are for “birthday candle,” not “extra cheese” (extra cheese has cost and inventory).
8. **Every number drillable.** Dashboard “revenue 180,000” → orders → items → recipe explosion → stock movement IDs.
9. **Idempotent server writes.** `client_sale_uuid` so retries do not duplicate orders.
10. **Urdu + English** on guest-facing surfaces; staff UI English first, Urdu optional.

---

## 8. Information architecture (target)

```
Login / PIN lock
├── Home (role-aware)
├── Front of house
│   ├── Register (POS)
│   ├── Floor / tables
│   ├── Kitchen (KDS)
│   ├── Expo / packing
│   └── Delivery board
├── Menu
│   ├── Categories, items, modifiers, combos
│   ├── Recipes & dough
│   ├── Availability / 86
│   └── Discounts, happy hour, coupons
├── Inventory
│   ├── On-hand by location
│   ├── Catalog & conversions
│   ├── Requests & transfers
│   ├── Purchasing & vendors
│   ├── Counts & variance
│   └── Waste / prep production
├── People
│   ├── Staff & permissions
│   ├── Clock in/out
│   └── Shifts / schedule
├── Customers
│   ├── Directory & addresses
│   ├── Loyalty & gift cards
│   └── Feedback
├── Money
│   ├── Shifts & cash drawer
│   ├── Payments & settlements
│   ├── Expenses
│   └── Tax / FBR
├── Insights
│   ├── Live day
│   ├── Sales & product mix
│   ├── Food cost & theoretical vs actual
│   └── Branch comparison
└── Admin
    ├── Locations & stations
    ├── Hardware (printers, cash drawer)
    ├── Integrations (WhatsApp, aggregators, FBR)
    ├── Organization settings
    └── Audit log
```

Warehouse users never see Register/KDS. Kitchen PIN users only see KDS. Cashier PIN users only see Register + tables.

---

## 9. Feature specifications

Each module: **goal, user stories, functional requirements, data, acceptance, priority.**  
P0 = Phase 0–1 must. P1 = makes it a real restaurant. P2 = makes it the *only* system. P3 = moat / later.

---

### M0. Platform, tenancy, identity, permissions

**Goal:** One org (NYP) with many locations; later other restaurants without a rewrite.

**Requirements**

- `organizations` (already seeded `default`) is the tenant. Every business table gets `organization_id`.
- Locations: branch, warehouse, dark kitchen, commissary. Add `phone`, `ntn`, `strn`, `fbr_pos_id`, `receipt_footer`, `timezone` override.
- `profiles`: add `pin_hash`, `is_active`, `hourly_rate` (optional), `permissions[]` or role templates.
- Role templates (P0):
  - Owner / Admin
  - Branch manager
  - Cashier
  - Waiter
  - Kitchen
  - Warehouse
  - Accountant (reports + FBR, no POS discount override)
- PIN login on POS devices after a device is “opened” with email (P1). Fast cashier switch.
- Device sessions: named terminals (`Ocean Mall Counter 1`) with `active_location_id`.
- Invite staff via email; no public signup (keep).
- Session timeout on idle POS (configurable, default 5 min to PIN screen, not full logout).

**Acceptance**

- A cashier cannot open another branch’s register.
- A kitchen user hitting `/pos/new-order` is redirected to KDS.
- Deactivating a user ends sessions.

**Priority:** P0

---

### M1. Menu, modifiers, combos (replace “flat POS items”)

**Goal:** Ring any pizza the shop actually sells, with correct price and inventory.

**Today:** `pos_items` are flat SKUs. A 12" BBQ and a 12" BBQ stuffed crust are two catalog rows, or cashiers type notes that do not deduct cheese.

**Target model**

- `menu_items` (evolve `pos_items`): name, category, base price, recipe_id OR inventory_item_id, tax class, stations[], available, 86 flag, channel visibility (pos, qr, aggregator, online).
- `modifier_groups`: e.g. Size, Crust, Extra toppings, Sauce, Half-and-half, Remove toppings, Spice, Drink size.
- `modifiers`: price_delta_paisa, cost_delta or `recipe_delta` (add 40g mozzarella), max selections, required.
- **Half-and-half:** special group type `split_recipe`. Inventory = 50% recipe A + 50% recipe B + shared dough of selected size.
- **Combos / deals:** `combo_id` with slots (any 12" pizza + drink). Inventory explodes child items.
- **Variants vs modifiers:** Size can stay as tagged recipes (you already have size tags) *or* become a required modifier that swaps `recipe_id`. Pick one model and migrate. Recommendation: **size is a required modifier that points at a recipe**, types/flavors are item families.
- Images, display order, color, kitchen name vs receipt name (`chz pza` vs “Cheese Pizza”).
- Channel prices: dine-in vs takeaway vs Foodpanda (aggregator markup).
- **86 / sold out** at item or modifier level, per location, with optional auto-86 when stock of a critical ingredient hits 0.

**POS UX**

- Tap item → if required groups exist, modal: Size → Crust → extras. Defaults preselected (12", regular crust).
- Extra cheese is a modifier with inventory, not a note.
- “Notes” field remains for non-cost text, max 80 chars, prints on ticket in highlight.

**Acceptance**

- Half fajita / half tikka 12" stuffed crust deducts the right dough weight from dough config + half toppings of each.
- Extra cheese +40g mozzarella on that branch.
- Combo “Family deal” deducts 2 pizzas + 1.5L drink.
- 86 Pepperoni hides it on POS and QR within 2 seconds (realtime).

**Priority:** P0 (modifiers + 1:1 inventory link), P1 (combos, channel prices, half-and-half), P2 (auto-86)

---

### M2. Register / POS

**Goal:** Fast, complete, recoverable order taking.

**Keep:** cart math, discounts, paisa, order types, checkout dialog, receipt component as starting points.

**Replace:** `window.open` composer. Use `/pos/register` full screen with optional second window for customer display later.

**Requirements**

- **Held orders / park.** Cashier answers the phone, parks, takes walk-in, resumes.
- **Order types:** dine-in (table + guest count), takeaway, delivery, pickup, catering / bulk (P2).
- **Guest count** for dine-in (covers) — needed for labor and average.
- **Send to kitchen immediately** vs **hold fire** (don’t make the pizza until guests are seated / paid — configurable per type).
- **Course flags** optional (starter / main) — P2.
- **Item-level discount** and **check-level discount**. Manager PIN if over threshold.
- **Comps / house guest / spoilage after fire** as reason-coded non-revenue with inventory still deducted or restored (configurable).
- **Voids:** before send = silent; after send = manager PIN + reason; stock restore only if kitchen confirms not made.
- **Split bill:** by item, by seat, by amount, equal N ways.
- **Merge / move table.**
- **Tips:** none / % / amount; optional service charge (e.g. 5–8% dine-in) as a separate tax-like line with its own GL.
- **Multiple payments** on one check: 500 cash + rest JazzCash.
- **Cash tender** and change (you have `amount_tendered` — finish the UX).
- **Payment methods (Pakistan):** Cash, Card (Visa/MC), JazzCash, EasyPaisa, Raast / bank transfer, Credit (house account P2), Aggregator prepaid (Foodpanda already paid).
- **Reference ID** required for wallet/bank.
- **Reprint** last receipt; open drawer (no sale).
- **Search** menu by name and by barcode / SKU (P1).
- **Quantity keypad** and existing calculator — keep.
- **Customer attach:** phone lookup (M7).
- **Offline queue** with `client_sale_uuid` (M16).
- **Age-restricted** items optional — P3.
- **iPad / 10" landscape** as primary layout; 14" desktop; 7" not required.
- **Customer-facing display** (second screen: items + total) — P2.

**Order status** (evolve, don’t throw away)

```
draft (held)
  → fired (sent to kitchen)     [inventory deducts HERE, not at pay, for dine-in]
  → preparing
  → ready
  → served | packed | out_for_delivery
  → completed
  → cancelled / void
```

**Important policy decision (must be configurable per order type):**

- **Dine-in:** deduct stock when ticket is **fired**, not when paid (they may pay at the end). Payment can happen before or after.
- **Takeaway / delivery:** usually pay then fire; deduct on fire still, so unpaid drafts do not eat stock.
- Never deduct on “add to cart.”

Today you deduct at `create_pos_order` with status `pending`. That is acceptable if create = fire. Held drafts must **not** call `create_pos_order` until fire.

**Acceptance**

- 20-item Friday night: add, modify, fire, pay split, reprint, under 45 seconds for a simple 2-pizza takeaway.
- Killing the browser mid-checkout does not duplicate the order (idempotency key).
- Void after fire with “already made” does not restore cheese.

**Priority:** P0 (fire vs pay, PIN voids, multi-pay, hold, branch picker, no popup), P1 (split, tips, service charge, park), P2 (customer display, barcode)

---

### M3. Floor plan and tables

**Goal:** Waiters and cashiers see the room.

**Requirements**

- Visual floor editor: rooms, tables with seats, mergeable.
- Table states: free, seated, ordered, food-out, billed, dirty.
- Elapsed time since seat / since fire (color after threshold).
- Open check from table tap.
- Optional waitlist / quote time (P2).
- Reservations (P2): name, phone, time, table hold, WhatsApp reminder.

**Acceptance**

- Manager sees Table 12 seated 55 minutes, food not served.
- Two 2-tops merged into a 4.

**Priority:** P1 floor; P2 reservations/waitlist

---

### M4. Kitchen Display System (KDS)

**Goal:** Cooks never look at a paper ticket unless the printer is backup.

**Today:** cashier order board is a proto-KDS.

**Requirements**

- Fullscreen dark kitchen UI, huge type, no chrome.
- **Stations:** Pizza, Oven, Drinks, Desserts, Packing. Item routing from menu.
- Tickets show: order #, type, table or customer, elapsed time, modifiers in bold, notes in another color, allergens (P1).
- Bump / unbump. Optional physical bump bar key mapping.
- Sound on new ticket; optional speech — P2.
- Expo station sees all, packs delivery bags, marks packed.
- Recall last 20 bumped tickets.
- Printer fallback: kitchen chit on fire if station `print_on_fire=true`.
- Load balancer: if pizza station has 12 open tickets, flash “behind.”
- Never show prices on kitchen screens.

**Acceptance**

- Drinks station does not see pizza tickets.
- Bump is < 200ms on LAN.
- New ticket appears without refresh (Realtime, not 15s poll — today the board polls 15s; that is too slow for kitchen).

**Priority:** P0 realtime + fullscreen + stations; P1 expo/packing; P2 bump bar / sound

---

### M5. Inventory (evolve existing)

**Goal:** Theoretical vs actual food cost the owner can trust.

**Keep:** items, categories, conversions, stock_entries, movements, location scoping, thresholds.

**Add**

- **Lots / expiry** (P2) for dairy: FIFO suggestion on waste.
- **Par levels** per location per weekday (Friday par ≠ Monday).
- **Prep / production:** “make 40 dough balls” converts bulk flour → dough_ball SKU in one movement pair (P1). This matches your dough config beautifully.
- **Butcher / yield** optional — P3.
- **Cycle counts:** full or by category; freeze movements; variance report; require manager sign-off (P1).
- **Waste reasons:** burn, drop, expiry, staff meal, quality. Hits movements + P&L (P0).
- **Staff meal** as a POS order type that deducts recipe but revenue 0 or at cost (P1).
- **Barcode** on receiving (P2).
- **Min/max alerts** via WhatsApp to manager when critical (P1).
- **Inventory value** using cost_per_unit; add **weighted average cost** update on purchase (P1). Today cost is a static field.
- **Location item list:** not every SKU exists at every branch (you add via Add Existing Item — keep, make it the explicit catalog-per-location).

**Acceptance**

- After 10 pizza sales, mozzarella theoretical usage matches `expand_sale_ingredients` sum.
- Count says −200g vs theoretical → variance report, not silent overwrite without a movement.

**Priority:** P0 waste + single write path; P1 counts, prep, WAC, pars; P2 lots/expiry

---

### M6. Purchasing and vendors

**Goal:** Stop recording “local purchasing” as a naked stock bump.

**Requirements**

- Vendors: name, phone, NTN, payment terms, items they supply, last price.
- Purchase orders: draft → sent (WhatsApp/PDF) → partial receive → closed.
- Receiving against PO: quantities, expiry, price; updates WAC; `warehouse_receiving` movement.
- Invoice capture: total, tax, due date; payment status.
- Credit notes / returns.
- Suggested PO from par vs on-hand + open sales forecast (P2).
- Multi-location: PO to warehouse, then transfer out.

**Acceptance**

- Receiving 20kg mozzarella at 1200/kg updates cost and stock in one transaction.
- Cannot receive a random SKU without a vendor price the first time (warning, not hard block).

**Priority:** P1

---

### M7. Customers, CRM, loyalty, gift cards

**Goal:** Phone number is the customer ID (Pakistan reality).

**Requirements**

- Customer: name, phones, WhatsApp opt-in, addresses, allergens, notes, last order, LTV.
- Attach to POS order; auto-create on first phone entry.
- Order history on profile.
- **Loyalty:** points per PKR, redeem as discount; simple tiers later (P2).
- **Gift cards / store credit** (P2).
- **House accounts** for offices (P3).
- Marketing: segment “haven’t ordered in 30 days” → WhatsApp campaign (P2) with opt-in enforcement.
- No spam without opt-in (legal + deliverability).

**Acceptance**

- Enter `03xx`, see last 3 orders and favorite pizza, 1 tap reorder.

**Priority:** P1 directory + history + reorder; P2 loyalty/gift; P3 house accounts

---

### M8. Delivery and aggregators

**Goal:** Delivery is an operation, not a tab.

**In-house delivery**

- Address, area, delivery fee (flat / by area), packing notes, phone.
- Dispatch board: ready → assigned rider → picked up → delivered / failed.
- Rider app or mobile web (P1 mobile web, P2 native).
- COD vs prepaid; cash due from rider at shift end (settlement).
- ETA and SMS/WhatsApp to guest.
- Geo optional (P2).

**Aggregators (Foodpanda, Cheetay, etc.)**

- Manual “aggregator ticket” intake if no API: cashier enters Foodpanda order #, items, **already paid**, zero cash drawer, still fire kitchen, still deduct stock, commission % as expense (P1).
- Channel-specific prices and unavailable items.
- Later: official APIs / email parsing — P3. Do not block on APIs.

**Acceptance**

- Foodpanda order does not add cash to the till but does add sales (channel = aggregator) and does deduct stock.
- Rider cash-on-hand report at night matches COD orders.

**Priority:** P1 in-house + manual aggregator; P2 rider app; P3 APIs

---

### M9. Online ordering, QR, call center

**Goal:** Own the order so aggregators are optional.

**Requirements**

- **QR table ordering:** guest scans, sees menu, sends to kitchen, waiter confirms payment or pay-online (P1).
- **Takeaway web menu** (PWA) with WhatsApp login or OTP (P1).
- **Call center / Instagram order entry** is just POS with customer + type=delivery (already covered if POS is good).
- Stock / 86 sync from the same menu.
- No full marketplace in v1.

**Acceptance**

- Table 9 QR order appears on KDS pizza station in < 3s.
- 86 on POS hides on QR.

**Priority:** P1 QR + PWA; P2 saved cards (Stripe/Payfast/etc. as available in PK)

---

### M10. Shifts, cash, and end of day

**Goal:** The drawer is always explainable.

**Requirements**

- Open shift: opening float, cashier(s), terminal, location.
- Cash in/out (petty: gas, veggies from mandi).
- Expected cash = opening + cash sales − cash refunds − cash-out + COD received − change.
- Close shift: counted cash, card batch, JazzCash total, variance reason.
- **Z-report** (end of day) and **X-report** (mid-shift snapshot).
- Parked orders cannot exist at close (force decide).
- Next day cannot open POS without previous close (configurable).
- Tips declared.
- Safe drops.

**Acceptance**

- Z-report: orders, voids, discounts, tax, by tender, by type, theoretical cash vs counted, food cost theoretical.
- Variance > threshold notifies owner.

**Priority:** P0 (even a simple version); this is what makes POS real

---

### M11. People: clock, schedule, permissions

**Goal:** Labor is the second-biggest cost after food.

**Requirements**

- Clock in/out from POS PIN (P1).
- Live who’s on the floor.
- Schedule by location / role / week (P2).
- Overtime flags.
- Sales per labor hour on dashboard (P1, even without full scheduler — use clock).
- Tip pool optional (P3).
- Documents / CNIC storage — P3.

**Acceptance**

- Manager sees 6 people clocked in, labor hours today, sales/labor hour.

**Priority:** P1 clock; P2 schedule

---

### M12. Insights and reporting

**Goal:** Owner opens the app, not a spreadsheet.

**Live day (P0)**

- Net sales, orders, AOV, by channel, by tender, voids, discounts, current open tickets, 86 list, low stock, labor on clock.

**Product mix (P1)**

- Top items, categories, pizza flavors, size mix, modifier attach rate (extra cheese %).
- Daypart (lunch vs dinner vs late).
- Day of week.

**Food cost (P1)**

- Theoretical cost from recipe explosions.
- Actual from purchases + beginning/ending counts.
- Variance by SKU.
- Menu engineering: star / plowhorse / puzzle / dog (margin vs popularity).

**Branch compare (P1)**

- Same metrics side by side; HQ view.

**Exports (P0)**

- CSV/XLSX of sales, items, stock movements, Z-report PDF.

**Do not** fetch all `pos_sales` into the client. Materialized views or RPCs with date + location params.

**Priority:** P0 live + export; P1 mix, food cost, branches; P2 forecasting

---

### M13. Tax, FBR, accounting

**Goal:** Legal to operate in Pakistan without a second invoicing tool.

**Requirements**

- Tax classes: taxable / exempt; rate from settings per location (provincial SST vs GST as configured).
- Receipt: restaurant name, address, phone, NTN, STRN, FBR invoice number, QR when integrated.
- **FBR Digital Invoicing / POS integration** (P1 research, P2 implement to current FBR spec). This changes; isolate behind an adapter.
- Credit notes for voids after invoice issued.
- Chart of accounts light: sales, cash, card clearing, wallet clearing, inventory, COGS, waste, discounts, tax payable.
- Export journal CSV for an accountant (P1).
- Expense entry (rent, utilities) for a simple P&L (P2).

**Acceptance**

- Receipt has legal fields.
- Daily tax total on Z-report matches sum of invoices.
- Adapter can be no-op in dev.

**Priority:** P0 legal receipt fields; P1 journal export; P2 FBR live

---

### M14. WhatsApp and notifications

**Goal:** The restaurant already lives on WhatsApp. Join it.

**Events to send (opt-in)**

- Order confirmed, cooking, ready, out for delivery, delivered.
- Branch: low stock, request fulfilled, shift variance.
- Vendor: PO PDF.
- Guest marketing: only opted-in.

**Implementation**

- Provider-agnostic: WhatsApp Cloud API / other. Queue in `notification_outbox`.
- In-app notifications stay (you have the table).

**Priority:** P1 order status + low stock; P2 marketing / PO

---

### M15. Hardware

**Goal:** Counter feels like a real POS.

| Device | Support |
|---|---|
| 80mm thermal printer | ESC/POS over USB/LAN/Bluetooth; receipt + kitchen chit |
| 58mm | Optional |
| Cash drawer | Pulse via printer kick |
| Customer display | P2 |
| Barcode scanner | Keyboard wedge P1 |
| Scale | P3 |
| Kitchen bump bar | P2 |
| Android/iPad | PWA first; “Add to Home Screen” |

**Print templates:** receipt, kitchen, packing slip, Z-report, PO, transfer note.

**Priority:** P1 thermal + drawer; rest P2+

---

### M16. Offline, reliability, performance

**Requirements**

- POS register works if internet drops for N minutes: local draft DB (IndexedDB), queue fires when back.
- Conflict: server idempotency on `client_sale_uuid`.
- If stock check cannot run offline, allow sale with `stock_check=deferred` and reconcile; manager report of offline sales (P1).
- Realtime for KDS; fall back to 3s poll if socket dies (today 15s is too slow).
- Pagination everywhere.
- Image CDN; compress menu photos.
- `EXPLAIN` on dashboard queries; no N+1.

**Priority:** P1 offline drafts; P0 realtime KDS + pagination of reports

---

### M17. White-label, franchise, multi-brand (P2–P3)

- Theme: logo, colors, name (already partly in settings).
- Franchisee sees only their locations; franchisor sees all + royalty % (P3).
- Menu inheritance: HQ publishes menu, branch can 86 but not change price (configurable).

---

### M18. Pizza- and Pakistan-specific extras

Include as first-class, not plugins.

- Dough production planner from forecasted pizza mix × dough config weights (you already store the weights).
- Make-line ticket grouping by oven capacity.
- Ramadan mode: hours, iftar combo, delayed fire (“fire at 18:40”).
- Deal calendar: “Monday 12" + drink.”
- Urdu receipt names optional.
- Area-based delivery fees (DHA, Clifton, etc. as data, not code).
- Peak Friday/Saturday staffing hint from last 8 weeks (P2).

---

## 10. Data model — keep and extend

### 10.1 Keep (current)

```
organizations, organization_settings
locations
profiles
categories, inventory_items
stock_entries, inventory_movements
recipes, recipe_items
recipe_tags, recipe_tag_assignments
pizza_dough_config, calzone_dough_config
pos_categories, pos_items, discount_rules, pos_sales
stock_requests
notifications, activity_logs
```

### 10.2 Add (minimum for restaurant OS)

```
permission_templates, user_permissions
terminals, device_sessions
menu_modifier_groups, menu_modifiers, menu_item_modifier_groups
combo_groups, combo_slots
order_checks          -- evolve pos_sales into header
order_line_items      -- stop storing only jsonb; jsonb can remain a cache
order_line_modifiers
payments              -- split tenders
shift_sessions, cash_movements, z_reports
tables, floor_layouts, reservations
kds_stations, ticket_station_states
vendors, purchase_orders, purchase_order_lines, receiving_events
stock_counts, stock_count_lines
waste_events, production_batches
customers, customer_addresses, loyalty_accounts, loyalty_ledger
delivery_jobs
aggregator_orders
clock_events, schedules
tax_invoices, fbr_submissions
notification_outbox
client_idempotency_keys
```

**Do not** keep `pos_sales.items` jsonb as the *only* line-item source. Dual-write jsonb for speed in Phase 1, but lines + modifiers must be queryable tables for reports and FBR.

### 10.3 Money and units (invariants)

- All money: `bigint` paisa.
- All stock: numeric in **base unit**.
- All timestamps: `timestamptz`.
- Display timezone: location or org (`Asia/Karachi`).

---

## 11. UX specifications (cross-cutting)

- **POS:** landscape, 48px tap targets, high contrast, no sidebar during register (escape hatch: “Back to board”).
- **KDS:** dark, 10m+ readable at 1.5m, no prices.
- **HQ:** current sidebar is fine; regroup into the IA in §8.
- **Empty states:** “Link a recipe to this pizza or mark it as a 1:1 stock item” instead of silent no-op.
- **Errors:** human + copyable error id; never “Something went wrong” alone.
- **Confirmation:** destructive (void, discard stock, delete recipe) needs typed reason.
- **Keyboard:** numpad, F-keys optional for power users (P2).
- **A11y:** not a kiosk legal requirement, but contrast and focus for cashiers with gloves/oil — large type theme.

---

## 12. Non-functional requirements

| NFR | Target |
|---|---|
| POS add-to-cart | < 50ms local |
| Fire order (online) | < 500ms p95 |
| KDS appear | < 1s p95 |
| Uptime | POS local-first so kitchen continues on WAN drop |
| Audit | Immutable movements; no DELETE of sales, only void |
| Security | RLS on every table; no service role in browser; no hardcoded keys |
| Backup | Supabase PITR; nightly CSV dump of sales+stock for owner |
| Privacy | Customer phone hashed in exports optional; WhatsApp opt-in |
| i18n | `en` + `ur` strings file; dates `dd MMM yyyy`, `h:mm a` Karachi |
| Support | Admin “impersonate location” not impersonate user |

---

## 13. Phased roadmap

### Phase 0 — Make the current shop trustworthy (1–2 weeks of focused work)

Baseline schema, env client, generated types, fail-closed ERP, staff Edge Functions, health page, recipe-or-SKU link policy, admin branch picker, New Order not a popup, activity log wiring, RLS tighten, Z-report v0 (even if shift is “the calendar day”), tests for stock loop, delete duplicate SQL, update README/POS docs.

**Exit:** A branch can sell a recipe-linked pizza, stock matches, cancel restores, warehouse can fulfill, owner can download today’s sales CSV. No silent fallbacks.

### Phase 1 — Real restaurant (the jump from inventory app → OS)

Modifiers + half-and-half + 1:1 SKU sales, fire vs pay, holds, multi-tender (JazzCash/EasyPaisa + ref), manager PIN voids/discounts, shifts + cash count, KDS stations + realtime, waste reasons, server analytics, customers by phone, delivery address + fee + rider assignment (simple), aggregator manual intake, thermal receipt layout + NTN, WhatsApp “order ready”, clock-in, par + low-stock WhatsApp.

**Exit:** Friday night: waiters, kitchen, delivery, drawer close, mozzarella theoretically correct.

### Phase 2 — Only system they need

Floor plan, QR ordering PWA, PO/vendors/WAC, cycle counts, prep/dough batches, loyalty, FBR adapter, offline queue, menu engineering, branch P&L, schedule, gift cards, customer display, printer kick drawer, Ramadan mode, Urdu receipts.

**Exit:** Spreadsheet retired; Foodpanda is an intake channel not a second brain; accountant gets a journal; FBR path exists.

### Phase 3 — Moat

Aggregator APIs, franchise, lots/expiry FIFO, forecasting, native rider app, scale, advanced CRM campaigns, multi-brand HQ, AI demand / auto-PO (only after data is clean).

---

## 14. What Fable 5 should implement first (suggested tickets)

Use this as the build order inside Phase 0–1:

1. Platform hygiene (B1–B4, B6–B8).
2. `order_checks` + `order_line_items` + idempotency; keep UI.
3. Deduct on **fire**; drafts don’t deduct.
4. Menu modifiers + pizza half-and-half + inventory item direct link.
5. Terminal `active_location_id` + PIN users.
6. Shift open/close + Z-report.
7. KDS by station + realtime.
8. Payments table + split tender.
9. Waste + staff meal.
10. Customers + delivery fields.
11. Server reports + CSV.
12. WhatsApp outbox.
13. Purchasing.
14. QR PWA.
15. FBR adapter shell.

---

## 15. Acceptance of the overall product (“only software”)

The owner can **turn off**:

- Excel stock sheets  
- Separate KDS app  
- Paper kitchen tickets (optional backup printer only)  
- WhatsApp groups for branch replenishment  
- Separate attendance register  
- Separate invoicing / FBR workaround (once adapter live)  
- Aggregator tablet double-entry (once intake is smooth)  
- Personal “notes” for discounts and comps  

They may still use:

- A bank app  
- Payroll bank transfer (until P3 payroll)  
- Foodpanda as a demand channel  
- An accountant (but fed by this system)  

---

## 16. Explicit non-goals (do not distract Fable 5)

- Building a consumer Super-App to compete with Foodpanda marketplace.
- Full payroll, EOBI, tax filing of employees.
- IoT ovens.
- Crypto payments.
- Replacing Supabase in v1.
- Multi-country VAT engines (Pakistan + one extra currency is enough).
- Native iOS/Android rewrite before PWA is excellent.
- AI recipe generation. Use AI later for forecasting, not for inventing mozzarella quantities.

---

## 17. Copy, branding, localization

- Product name in UI: **{Restaurant Name}** from settings, not “NYP Inventory” except as default seed.
- Default seed remains New York Pizza, PKR, Asia/Karachi, paisa.
- Receipt footer configurable.
- Error copy in English for staff; guest WhatsApp can be Urdu.
- Avoid “ERP” in the cashier UI. Say “stock,” “register,” “kitchen.” Keep ERP in admin health.

---

## 18. Testing matrix (must exist)

| Layer | Cases |
|---|---|
| Unit | paisa round, discount stack, purchaseToBase, half-and-half explosion |
| RPC | create/fire deducts; cancel restores; cancel after “made” does not; transfer atomic; branch isolation; request fulfill partial |
| RLS | cashier cannot read other branch stock; warehouse cannot create POS; kitchen cannot void |
| E2E | login → fire pizza with extra cheese → KDS bump → pay cash+JazzCash → Z-report cash expected |
| Regression | unlinked item blocked; RPC down → POS refuses; offline retry no duplicate |

---

## 19. Current file map (for the implementing model)

| Path | Role |
|---|---|
| `src/App.tsx` | Routes |
| `src/components/Layout.tsx` | Nav by role |
| `src/contexts/AuthContext.tsx` | Session + profile |
| `src/components/auth/RoleGuard.tsx` | Route ACL |
| `src/lib/erp.ts` | RPC wrappers (**must fail closed**) |
| `src/lib/units.ts` | Conversions |
| `src/hooks/useInventory.tsx` | Stock queries/mutations |
| `src/hooks/usePOS.tsx` | Cart |
| `src/hooks/usePOSSales.tsx` | Sales |
| `src/pages/pos/POSMain.tsx` | Order board |
| `src/pages/pos/NewOrder.tsx` | Composer (replace popup) |
| `src/pages/Recipes.tsx` | Extract, don’t rewrite blindly |
| `src/pages/Inventory.tsx` | On-hand |
| `src/pages/Transfers.tsx` / `StockRequests.tsx` | Logistics |
| `src/pages/admin/*` | Users, locations, POS catalog |
| `src/integrations/supabase/client.ts` | **Move to env** |
| `supabase/migrations/20260814_erp_integrity_core.sql` | **Canonical stock engine** |

---

## 20. Open decisions (defaults if the owner is silent)

| Decision | Default |
|---|---|
| Deduct stock | On kitchen **fire**, not on payment |
| Unlinked menu items | **Block** sale |
| Offline sales | Allow with deferred stock check + manager report |
| Aggregators | Manual intake first, APIs later |
| FBR | Adapter interface now; live submit when credentials exist |
| Multi-tenant SaaS | Single org in v1, `organization_id` on all new rows |
| New Order UX | Fullscreen route, not `window.open` |
| Half-and-half | 50/50 recipe split + size dough from dough config |
| Language | English staff UI; Urdu guest messages optional |
| Service charge | Off by default; per-location % |
| Tips | Optional line; not in tax base unless configured |

---

## 21. Success metrics

| Metric | Target after Phase 1 |
|---|---|
| Stock variance mozzarella (weekly count vs theoretical) | < 5% |
| Time to ring 2-pizza takeaway | < 45s |
| KDS ticket show | < 1s |
| Shift cash variance | Explainable 100% (every PKR has a reason) |
| Orders missing a recipe/SKU link | 0 |
| Owner tools outside this app for daily ops | 0 (except bank) |

---

*End of PRD. Implement Phase 0 before any greenfield module. The stock loop is the product; everything else hangs off it.*
