/** Portfolio / offline verification only — never enable in production deploys. */
export const isDemoMode = (): boolean =>
  import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_DEMO_MODE === '1';

export const DEMO_STORAGE_KEY = 'pizza-byte-demo-v1';
