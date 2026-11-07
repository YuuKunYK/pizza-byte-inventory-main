import { UserRole } from '@/types/auth';

export const DEMO_LABEL = 'DEMO — synthetic Pizza Byte data';

export const demoAdminUser = {
  id: 'demo-admin-001',
  email: 'demo.admin@pizza-byte.demo',
  name: 'Demo Admin (Portfolio)',
  role: UserRole.ADMIN,
  locationId: 'loc-gulberg-demo',
  locationName: 'Gulberg Branch (Demo)',
  locationType: 'branch',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function buildDemoSeed() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const locations = [
    {
      id: 'loc-warehouse-demo',
      name: 'Central Warehouse (Demo)',
      type: 'warehouse',
      address: 'Demo Industrial Zone',
    },
    {
      id: 'loc-gulberg-demo',
      name: 'Gulberg Branch (Demo)',
      type: 'branch',
      address: 'Demo Main Boulevard',
    },
    {
      id: 'loc-dha-demo',
      name: 'DHA Branch (Demo)',
      type: 'branch',
      address: 'Demo Phase 5',
    },
  ];

  const categories = [
    { id: 'cat-dairy-demo', name: 'Dairy (Demo)' },
    { id: 'cat-dough-demo', name: 'Dough (Demo)' },
    { id: 'cat-sauce-demo', name: 'Sauces (Demo)' },
  ];

  const inventoryItems = [
    {
      id: 'item-mozzarella-demo',
      name: 'Mozzarella — shredded (Demo)',
      category_id: 'cat-dairy-demo',
      category: { id: 'cat-dairy-demo', name: 'Dairy (Demo)' },
      unit_type: 'weight',
      base_unit: 'g',
      cost_per_unit: 0.85,
      min_stock_threshold: 8000,
      conversion_value: 1,
    },
    {
      id: 'item-dough-demo',
      name: 'Pizza dough ball 12" (Demo)',
      category_id: 'cat-dough-demo',
      category: { id: 'cat-dough-demo', name: 'Dough (Demo)' },
      unit_type: 'count',
      base_unit: 'ea',
      cost_per_unit: 95,
      min_stock_threshold: 40,
      conversion_value: 1,
    },
    {
      id: 'item-sauce-demo',
      name: 'Marinara base (Demo)',
      category_id: 'cat-sauce-demo',
      category: { id: 'cat-sauce-demo', name: 'Sauces (Demo)' },
      unit_type: 'weight',
      base_unit: 'g',
      cost_per_unit: 0.42,
      min_stock_threshold: 5000,
      conversion_value: 1,
    },
  ];

  /** Closing balances after synthetic POS deductions (see README operational loop). */
  const stockEntries = [
    {
      id: 'se-moz-gulberg',
      item_id: 'item-mozzarella-demo',
      location_id: 'loc-gulberg-demo',
      closing_stock: 6200,
      date: now.toISOString(),
    },
    {
      id: 'se-dough-gulberg',
      item_id: 'item-dough-demo',
      location_id: 'loc-gulberg-demo',
      closing_stock: 28,
      date: now.toISOString(),
    },
    {
      id: 'se-sauce-gulberg',
      item_id: 'item-sauce-demo',
      location_id: 'loc-gulberg-demo',
      closing_stock: 4800,
      date: now.toISOString(),
    },
    {
      id: 'se-moz-warehouse',
      item_id: 'item-mozzarella-demo',
      location_id: 'loc-warehouse-demo',
      closing_stock: 42000,
      date: now.toISOString(),
    },
  ];

  const posSales = [
    {
      id: 'sale-demo-1',
      branch_id: 'loc-gulberg-demo',
      status: 'completed',
      order_type: 'dining',
      payment_method: 'cash',
      total_amount: 249900,
      profit: 118400,
      discount_amount: 0,
      inventory_deducted: true,
      created_at: new Date(weekAgo.getTime() + 86400000 * 2).toISOString(),
      items: [
        {
          item_id: 'pos-margherita-demo',
          name: 'Margherita 12" (Demo)',
          quantity: 2,
          cost: 32000,
          total: 159900,
        },
      ],
    },
    {
      id: 'sale-demo-2',
      branch_id: 'loc-gulberg-demo',
      status: 'completed',
      order_type: 'takeaway',
      payment_method: 'card',
      total_amount: 189900,
      profit: 76200,
      discount_amount: 15000,
      inventory_deducted: true,
      created_at: new Date(weekAgo.getTime() + 86400000 * 4).toISOString(),
      items: [
        {
          item_id: 'pos-pepperoni-demo',
          name: 'Pepperoni Feast (Demo)',
          quantity: 1,
          cost: 41000,
          total: 189900,
        },
      ],
    },
    {
      id: 'sale-demo-3',
      branch_id: 'loc-gulberg-demo',
      status: 'completed',
      order_type: 'dining',
      payment_method: 'cash',
      total_amount: 329800,
      profit: 141200,
      discount_amount: 0,
      inventory_deducted: true,
      created_at: now.toISOString(),
      items: [
        {
          item_id: 'pos-margherita-demo',
          name: 'Margherita 12" (Demo)',
          quantity: 1,
          cost: 32000,
          total: 129900,
        },
        {
          item_id: 'pos-pepperoni-demo',
          name: 'Pepperoni Feast (Demo)',
          quantity: 1,
          cost: 41000,
          total: 199900,
        },
      ],
    },
  ];

  const inventoryMovements = [
    {
      id: 'mov-transfer-out-1',
      movement_type: 'transfer_out',
      item_id: 'item-mozzarella-demo',
      location_id: 'loc-warehouse-demo',
      quantity: -5000,
      notes: 'Demo transfer to Gulberg',
      created_at: new Date(weekAgo.getTime() + 86400000).toISOString(),
      inventory_items: { name: 'Mozzarella — shredded (Demo)' },
      locations: { name: 'Central Warehouse (Demo)' },
    },
    {
      id: 'mov-transfer-in-1',
      movement_type: 'transfer_in',
      item_id: 'item-mozzarella-demo',
      location_id: 'loc-gulberg-demo',
      quantity: 5000,
      notes: 'Demo transfer from warehouse',
      created_at: new Date(weekAgo.getTime() + 86400000).toISOString(),
      inventory_items: { name: 'Mozzarella — shredded (Demo)' },
      locations: { name: 'Gulberg Branch (Demo)' },
    },
  ];

  /** Illustrates recipe-theoretical usage vs ledger (not a full variance module). */
  const consumptionNote = {
    label: DEMO_LABEL,
    period: 'Last 7 days (Demo)',
    theoreticalMozzarellaG: 6800,
    actualLedgerUsageG: 7200,
    varianceG: 400,
    varianceCostPkr: 340,
    explanation:
      'Synthetic snapshot for portfolio: theoretical from recipe × POS qty; actual from stock ledger / POS deduction RPC.',
  };

  return {
    locations,
    categories,
    inventoryItems,
    stockEntries,
    posSales,
    inventoryMovements,
    consumptionNote,
    seededAt: now.toISOString(),
  };
}

export type DemoSeed = ReturnType<typeof buildDemoSeed>;
