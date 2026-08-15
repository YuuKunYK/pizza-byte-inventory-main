import {
  convertSi,
  describeConversion,
  effectivePurchaseFactor,
  formatStock,
  purchaseToBase,
  quantityToBase,
} from '../src/lib/units.ts';

const cases: Array<{ name: string; pass: boolean; detail: string }> = [];

const check = (name: string, actual: unknown, expected: unknown) => {
  const pass = Object.is(actual, expected) || actual === expected;
  cases.push({ name, pass, detail: pass ? 'ok' : `expected ${expected}, got ${actual}` });
};

check('1 L = 1000 ml', convertSi(1, 'liter', 'ml'), 1000);
check('1000 ml = 1 L', convertSi(1000, 'ml', 'liter'), 1);
check('1 kg = 1000 g', convertSi(1, 'kg', 'grams'), 1000);
check('2 crates of 12 = 24 bottles', purchaseToBase(2, {
  base_unit: 'pcs',
  purchase_unit: 'crate',
  purchase_conversion_value: 12,
}), 24);
check('1 liter milk stored as ml even if conversion leftover is 1', purchaseToBase(1, {
  base_unit: 'ml',
  purchase_unit: 'liter',
  purchase_conversion_value: 1,
}), 1000);
check('1 liter milk with conversion 1000', purchaseToBase(1, {
  base_unit: 'ml',
  purchase_unit: 'liter',
  purchase_conversion_value: 1000,
}), 1000);
check('dozen alias', purchaseToBase(1, {
  base_unit: 'pcs',
  purchase_unit: 'dozen',
}), 12);
check('NYP dough packet 1050 g', purchaseToBase(1, {
  base_unit: 'grams',
  purchase_unit: 'packet',
  purchase_conversion_value: 1050,
}), 1050);
check('receive 1 crate as purchase qty', quantityToBase(1, {
  base_unit: 'pcs',
  purchase_unit: 'crate',
  purchase_conversion_value: 12,
}, 'purchase'), 12);
check('enter 12 bottles as base qty', quantityToBase(12, {
  base_unit: 'pcs',
  purchase_unit: 'crate',
  purchase_conversion_value: 12,
}, 'base'), 12);
check('Pepsi factor', effectivePurchaseFactor({
  base_unit: 'pcs',
  purchase_unit: 'crate',
  purchase_conversion_value: 12,
}), 12);
check('format crate stock', formatStock(24, {
  base_unit: 'pcs',
  purchase_unit: 'crate',
  purchase_conversion_value: 12,
}), '24 pcs (2 crate)');
check('format milk stock', formatStock(1000, {
  base_unit: 'ml',
  purchase_unit: 'liter',
  purchase_conversion_value: 1000,
}), '1000 ml (1 liter)');
check('describe soda crate', describeConversion({
  base_unit: 'pcs',
  purchase_unit: 'crate',
  purchase_conversion_value: 12,
}), '1 crate = 12 pcs');
check('describe milk', describeConversion({
  base_unit: 'ml',
  purchase_unit: 'liter',
  purchase_conversion_value: 1000,
}), '1 liter = 1000 ml');

const failed = cases.filter((c) => !c.pass);
for (const c of cases) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : ` — ${c.detail}`}`);
}
if (failed.length) {
  console.error(`\n${failed.length} conversion check(s) failed`);
  process.exit(1);
}
console.log(`\n${cases.length} conversion checks passed`);
