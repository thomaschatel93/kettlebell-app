import '@testing-library/jest-dom/vitest';

/**
 * Node's own built-in `localStorage` global (stable in recent Node versions) is
 * what `'localStorage' in globalThis` sees. Vitest's jsdom environment only
 * copies a window property onto the Node global when that property is NOT
 * already present there (`getWindowKeys` uses `k in global`) - so with Node's
 * native `localStorage` already present, jsdom's fully working Storage instance
 * on `window` is never copied across, and Node's inert stub (no clear/getItem/
 * setItem, degraded because no `--localstorage-file` was given) wins instead.
 *
 * Fix: delegate straight to jsdom's real window instance, which vitest exposes
 * as `globalThis.jsdom.window`. This is the actual per-test-file Storage object
 * (not a hand-rolled substitute), so `instanceof Storage` holds, `sessionStorage`
 * is fixed for free, and nothing leaks across test files sharing a worker.
 */
interface JSDOMGlobal {
  window: { localStorage: Storage; sessionStorage: Storage };
}
const jsdomGlobal = (globalThis as unknown as { jsdom?: JSDOMGlobal }).jsdom;

if (jsdomGlobal && typeof globalThis.localStorage?.clear !== 'function') {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      get: () => jsdomGlobal.window[key],
      configurable: true,
    });
  }
}
