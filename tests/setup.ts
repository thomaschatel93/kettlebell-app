import '@testing-library/jest-dom/vitest';

// Node's own built-in `localStorage` global (stable in recent Node versions) runs
// inside vitest's worker process and shadows jsdom's working implementation with
// an inert stub — an object with no clear/getItem/setItem methods. Polyfill only
// when that stub is detected, so a correctly configured environment is untouched.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  class MemoryStorage {
    private store = new Map<string, string>();
    get length() { return this.store.size; }
    clear() { this.store.clear(); }
    getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
    key(index: number) { return [...this.store.keys()][index] ?? null; }
    removeItem(key: string) { this.store.delete(key); }
    setItem(key: string, value: string) { this.store.set(key, String(value)); }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage() as unknown as Storage,
    configurable: true,
    writable: true,
  });
}
