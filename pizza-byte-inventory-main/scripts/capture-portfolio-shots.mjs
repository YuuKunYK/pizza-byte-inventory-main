import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const base = process.env.APP_URL || 'http://127.0.0.1:5173';
const outDir = process.env.ARTIFACTS_DIR || '/opt/cursor/artifacts';

const routes = [
  { path: '/reports', file: 'screenshot_reports_food_cost_demo.png' },
  { path: '/inventory', file: 'screenshot_branch_inventory_demo.png' },
  { path: '/pos/analytics', file: 'screenshot_pos_analytics_margins_demo.png' },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const { path, file } of routes) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/${file}`, fullPage: false });
  console.log('saved', file);
}

await browser.close();
