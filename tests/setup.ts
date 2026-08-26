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

/**
 * jsdom ships no media stack at all: `play`, `pause` and `load` are stubs that
 * shout "Not implemented" at the virtual console and return undefined. The run
 * screen plays three countdown cues, so without this every runner test buries
 * its real output under forty lines of that.
 *
 * Stubbed rather than silenced, and `play` returns a real promise, because the
 * production code branches on whether one comes back. A stub that returned
 * undefined would leave that branch untested in exactly the environment meant
 * to test it.
 */
const media = globalThis.HTMLMediaElement?.prototype;
if (media) {
  Object.defineProperties(media, {
    play: { configurable: true, writable: true, value: function play(this: HTMLMediaElement) { return Promise.resolve(); } },
    pause: { configurable: true, writable: true, value: function pause(this: HTMLMediaElement) {} },
    load: { configurable: true, writable: true, value: function load(this: HTMLMediaElement) {} },
  });
}
