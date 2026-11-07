import { DEMO_STORAGE_KEY, isDemoMode } from './demoMode';
import { buildDemoSeed, type DemoSeed } from './demoSeed';

function readStore(): DemoSeed | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSeed;
  } catch {
    return null;
  }
}

function writeStore(data: DemoSeed) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
}

export function ensureDemoStore(): DemoSeed {
  if (!isDemoMode()) {
    return buildDemoSeed();
  }
  const existing = readStore();
  if (existing) return existing;
  const seed = buildDemoSeed();
  writeStore(seed);
  return seed;
}

export function resetDemoStore(): DemoSeed {
  const seed = buildDemoSeed();
  writeStore(seed);
  return seed;
}

export function getDemoStore(): DemoSeed {
  return ensureDemoStore();
}
