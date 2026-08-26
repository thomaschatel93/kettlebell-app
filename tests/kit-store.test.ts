/**
 * The shared kit store: one cached snapshot, one set of listeners, one answer
 * to "which bells does the user own". Tasks 18, 20 and 21 read the kit through
 * this module, so what is pinned here is what they inherit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribeKit, getKitSnapshot, getKitServerSnapshot, publishKit, isKitHydrated,
} from '@/lib/kit-store';
import { loadKits, KITS_KEY } from '@/lib/storage';

beforeEach(() => localStorage.clear());

describe('getKitServerSnapshot', () => {
  /**
   * The trap. React calls getServerSnapshot more than once during hydration and
   * compares the results by identity: hand back a fresh structuredClone each
   * call and it warns that the store mutated during render and then re-renders
   * for ever. The clone has to happen once, at module scope.
   */
  it('returns the very same object every call, not an equal one', () => {
    expect(getKitServerSnapshot()).toBe(getKitServerSnapshot());
  });

  it('is a placeholder that reports itself as not yet hydrated', () => {
    expect(isKitHydrated(getKitServerSnapshot())).toBe(false);
    expect(isKitHydrated(loadKits())).toBe(true);
  });

  it('is not the exported default itself, so nothing downstream can poison it', () => {
    const server = getKitServerSnapshot();
    server.profiles[0].bells.push({ weightKg: 999, count: 1 });
    expect(loadKits().profiles[0].bells).toEqual([]);
    server.profiles[0].bells.length = 0;
  });
});

describe('the snapshot', () => {
  it('is stable between calls, so React does not re-render on every read', () => {
    const stop = subscribeKit(() => {});
    expect(getKitSnapshot()).toBe(getKitSnapshot());
    stop();
  });

  it('is shared: a second subscriber sees the first one', () => {
    const stopA = subscribeKit(() => {});
    const first = getKitSnapshot();
    const stopB = subscribeKit(() => {});
    expect(getKitSnapshot()).toBe(first);
    stopA();
    stopB();
  });

  it('is re-read from storage when the first listener arrives', () => {
    const stop = subscribeKit(() => {});
    expect(getKitSnapshot().profiles[0].bells).toEqual([]);
    stop();

    // As another screen, or a previous mount, would have left it.
    const next = loadKits();
    next.profiles[0].bells = [{ weightKg: 12, count: 1 }];
    publishKit(next);

    const stopAgain = subscribeKit(() => {});
    expect(getKitSnapshot().profiles[0].bells).toEqual([{ weightKg: 12, count: 1 }]);
    stopAgain();
  });
});

describe('publishKit', () => {
  it('writes through to storage before telling anyone', () => {
    const seen: number[] = [];
    const stop = subscribeKit(() => seen.push(loadKits().profiles[0].bells.length));

    const next = loadKits();
    next.profiles[0].bells = [{ weightKg: 16, count: 1 }];
    publishKit(next);

    expect(seen).toEqual([1]);          // storage already had it when the listener ran
    expect(loadKits().profiles[0].bells).toEqual([{ weightKg: 16, count: 1 }]);
    stop();
  });

  it('notifies every listener, not just the newest', () => {
    const a = vi.fn();
    const b = vi.fn();
    const stopA = subscribeKit(a);
    const stopB = subscribeKit(b);

    publishKit({ ...loadKits(), capability: 'advanced' });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    stopB();
  });

  it('stops notifying a listener that has unsubscribed', () => {
    const gone = vi.fn();
    const stop = subscribeKit(gone);
    stop();

    publishKit({ ...loadKits(), capability: 'intermediate' });
    expect(gone).not.toHaveBeenCalled();
  });
});

describe('a write from another tab', () => {
  const fireStorage = (key: string | null) =>
    window.dispatchEvent(new StorageEvent('storage', { key }));

  it('refreshes the snapshot and tells every listener', () => {
    const listener = vi.fn();
    const stop = subscribeKit(listener);

    // The other tab writes the key directly; this tab hears about it.
    const next = loadKits();
    next.profiles[0].bells = [{ weightKg: 32, count: 1 }];
    localStorage.setItem(KITS_KEY, JSON.stringify(next));
    fireStorage(KITS_KEY);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getKitSnapshot().profiles[0].bells).toEqual([{ weightKg: 32, count: 1 }]);
    stop();
  });

  it('treats a whole-storage clear, which reports a null key, as ours', () => {
    const listener = vi.fn();
    const stop = subscribeKit(listener);
    publishKit({ ...loadKits(), capability: 'advanced' });
    listener.mockClear();

    localStorage.clear();
    fireStorage(null);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getKitSnapshot().capability).toBe('beginner');
    stop();
  });

  it('ignores a write to somebody else‘s key', () => {
    const listener = vi.fn();
    const stop = subscribeKit(listener);

    fireStorage('kb.history.v1');

    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('stops listening to the window once the last screen unmounts', () => {
    const listener = vi.fn();
    subscribeKit(listener)();          // subscribe, then immediately unsubscribe

    localStorage.setItem(KITS_KEY, JSON.stringify(loadKits()));
    fireStorage(KITS_KEY);

    expect(listener).not.toHaveBeenCalled();
  });
});
