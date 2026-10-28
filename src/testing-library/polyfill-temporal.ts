import { Temporal } from 'temporal-polyfill/implementation';

// Hosts without a native Temporal, such as Safari, run evalex on the polyfill, so the suite runs on it too.
Object.defineProperty(globalThis, 'Temporal', { value: Temporal, writable: true, configurable: true });
