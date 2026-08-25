import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadKits, saveKits, loadHistory, pushHistory, loadPrefs, savePrefs,
  loadActive, saveActive, clearActive,
} from '@/lib/storage';
import { entry, req } from './fixtures';
import type { Workout } from '@/lib/types';

const workout = { id: 'w', createdAt: 'now', request: req(), format: 'circuit',
  steps: [], estimatedSeconds: 0, loadWarning: false, shortOfBudget: false } as Workout;

const activeFixture = (over: Partial<Parameters<typeof saveActive>[0]> = {}) => ({
  v: 1 as const, workout, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null,
  ...over,
});

const STORAGE_KEYS = {
  kits: 'kb.kits.v1', history: 'kb.history.v1', prefs: 'kb.prefs.v1', active: 'kb.active.v1',
} as const;

beforeEach(() => localStorage.clear());

describe('kits', () => {
  it('returns two profiles and beginner capability when nothing is stored', () => {
    const s = loadKits();
    expect(s.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
    expect(s.activeId).toBe('home');
    expect(s.capability).toBe('beginner');
  });

  it('round-trips what it saved', () => {
    const s = loadKits();
    s.profiles[0].bells = [{ weightKg: 20, count: 2 }];
    s.capability = 'advanced';
    saveKits(s);
    expect(loadKits().profiles[0].bells[0].weightKg).toBe(20);
    expect(loadKits().capability).toBe('advanced');
  });

  it('falls back to the defaults when the stored value is corrupt', () => {
    localStorage.setItem(STORAGE_KEYS.kits, '{not json');
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('falls back to the defaults when the stored value is the JSON literal null', () => {
    // JSON.parse('null') succeeds and returns null without throwing - a naive
    // "did parsing throw" guard is defeated by this exact input.
    localStorage.setItem(STORAGE_KEYS.kits, 'null');
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('discards a stored value from an older shape', () => {
    localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({ v: 0, profiles: [], activeId: 'x' }));
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('discards a POPULATED stored value from an older shape (version-gated, not the length guard)', () => {
    // Empty `profiles: []` would also be caught by the "profiles.length === 0"
    // fallback even with the version check deleted. Populated profiles isolate
    // the version check itself.
    localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({
      v: 0,
      profiles: [
        { id: 'home', name: 'Home', bells: [{ weightKg: 99, count: 9 }], hasBench: false },
        { id: 'gym', name: 'Gym', bells: [{ weightKg: 88, count: 8 }], hasBench: true },
      ],
      activeId: 'home',
      capability: 'advanced',
    }));
    expect(loadKits().profiles[0].bells).toEqual([]);
  });

  it('repairs an activeId that names no existing profile', () => {
    localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({
      ...loadKits(), activeId: 'gone',
    }));
    expect(loadKits().activeId).toBe('home');
  });

  it('discards a null entry inside the profiles array rather than crashing', () => {
    localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({ v: 1, profiles: [null], activeId: 'x' }));
    expect(() => loadKits()).not.toThrow();
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('never returns an undefined activeId even when every stored profile is invalid', () => {
    localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({ v: 1, profiles: [{}, {}], activeId: 'gone' }));
    expect(loadKits().activeId).toBe('home');
  });

  it('never mutates the shared default kit state', () => {
    const a = loadKits();
    a.profiles[0].bells.push({ weightKg: 999, count: 1 });
    a.capability = 'advanced';
    // Nothing was saved - a fresh read must be unaffected by mutating a
    // previous read's return value.
    const b = loadKits();
    expect(b.profiles[0].bells).toEqual([]);
    expect(b.capability).toBe('beginner');
  });
});

describe('history', () => {
  it('starts empty', () => expect(loadHistory()).toEqual([]));

  it('puts the newest entry first', () => {
    pushHistory(entry({ id: 'one' }));
    pushHistory(entry({ id: 'two' }));
    expect(loadHistory().map((h) => h.id)).toEqual(['two', 'one']);
  });

  it('keeps only the last thirty', () => {
    for (let i = 0; i < 35; i++) pushHistory(entry({ id: `e${i}` }));
    expect(loadHistory()).toHaveLength(30);
    expect(loadHistory()[0].id).toBe('e34');
  });

  it('keeps the whole workout, not a summary', () => {
    pushHistory(entry({ id: 'w1', workout }));
    expect(loadHistory()[0].workout.format).toBe('circuit');
  });

  it('stores history behind a version envelope, not a bare array', () => {
    pushHistory(entry({ id: 'x' }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.history)!);
    expect(raw.v).toBe(1);
    expect(Array.isArray(raw.entries)).toBe(true);
  });

  it('discards a stored history value from an older (unversioned, bare-array) shape', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify([{ id: 'old' }]));
    expect(loadHistory()).toEqual([]);
  });

  it('filters out non-entry garbage from stored history rather than crashing downstream', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify({
      v: 1, entries: [null, 5, { nope: 1 }, entry({ id: 'ok' })],
    }));
    expect(loadHistory().map((h) => h.id)).toEqual(['ok']);
  });
});

describe('prefs', () => {
  it('defaults to a sensible first workout', () => {
    const p = loadPrefs();
    expect(p.totalMinutes).toBe(30);
    expect(p.effort).toBe('normal');
    expect(p.patterns.length).toBeGreaterThan(0);
  });

  it('falls back to defaults when the stored value is the JSON literal null', () => {
    localStorage.setItem(STORAGE_KEYS.prefs, 'null');
    expect(loadPrefs().patterns.length).toBeGreaterThan(0);
    expect(loadPrefs().effort).toBe('normal');
  });

  it('round-trips', () => {
    savePrefs({ patterns: ['pull'], effort: 'hard', totalMinutes: 45 });
    expect(loadPrefs().effort).toBe('hard');
  });

  it('rejects a stored empty pattern list rather than disabling the app', () => {
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ v: 1, patterns: [], effort: 'normal', totalMinutes: 30 }));
    expect(loadPrefs().patterns.length).toBeGreaterThan(0);
  });

  it('filters non-pattern garbage out of a stored pattern list, keeping the valid entries', () => {
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({
      v: 1, patterns: ['hinge', 'nope', null, 7, 'pull'], effort: 'normal', totalMinutes: 30,
    }));
    expect(loadPrefs().patterns).toEqual(['hinge', 'pull']);
  });

  it('rejects a garbage effort value', () => {
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ v: 1, patterns: ['hinge'], effort: 'ultra', totalMinutes: 30 }));
    expect(loadPrefs().effort).toBe('normal');
  });

  it('rejects a garbage totalMinutes value', () => {
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ v: 1, patterns: ['hinge'], effort: 'normal', totalMinutes: 999 }));
    expect(loadPrefs().totalMinutes).toBe(30);
  });
});

describe('active workout', () => {
  it('is null when nothing is in progress', () => expect(loadActive()).toBeNull());

  it('round-trips and clears', () => {
    saveActive(activeFixture({ stepIndex: 3, workedSeconds: 120 }));
    expect(loadActive()?.stepIndex).toBe(3);
    clearActive();
    expect(loadActive()).toBeNull();
  });

  it('keeps an absolute rest deadline, not a counter', () => {
    saveActive(activeFixture({ stepIndex: 1, restEndsAt: 1_800_000_000_000 }));
    expect(loadActive()?.restEndsAt).toBe(1_800_000_000_000);
  });

  it('discards a stored value from an older shape', () => {
    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify({ workout, stepIndex: 2 }));
    expect(loadActive()).toBeNull();
  });

  it('rejects an active workout whose restEndsAt is neither null nor a finite number', () => {
    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify({
      v: 1, workout, stepIndex: 0, workedSeconds: 0, restEndsAt: 'soon', pausedRemainingMs: null,
    }));
    expect(loadActive()).toBeNull();
  });

  it('does not throw even if the underlying removeItem call fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => clearActive()).not.toThrow();
    spy.mockRestore();
  });
});

describe('storage keys', () => {
  it('persists under the exact versioned key names the module contract promises', () => {
    saveKits(loadKits());
    expect(localStorage.getItem('kb.kits.v1')).not.toBeNull();

    savePrefs(loadPrefs());
    expect(localStorage.getItem('kb.prefs.v1')).not.toBeNull();

    pushHistory(entry());
    expect(localStorage.getItem('kb.history.v1')).not.toBeNull();

    saveActive(activeFixture());
    expect(localStorage.getItem('kb.active.v1')).not.toBeNull();
  });
});

describe('write return values', () => {
  it('returns true from every save when the write succeeds', () => {
    expect(saveKits(loadKits())).toBe(true);
    expect(savePrefs(loadPrefs())).toBe(true);
    expect(pushHistory(entry())).toBe(true);
    expect(saveActive(activeFixture())).toBe(true);
  });

  it('returns false rather than throwing when the underlying write fails (quota, private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(saveKits(loadKits())).toBe(false);
    expect(savePrefs(loadPrefs())).toBe(false);
    expect(pushHistory(entry())).toBe(false);
    expect(saveActive(activeFixture())).toBe(false);
    spy.mockRestore();
  });
});

describe('hostile input sweep', () => {
  // The exact nine shapes a corrupt/adversarial localStorage value can take,
  // per key. Every loader must survive every one of these without throwing,
  // and must return a structurally valid default.
  const hostilePayloads = [
    '{not json',                                                    // malformed JSON
    'null',                                                         // JSON literal null
    '[]',                                                           // array where an object is expected
    '"just a string"',                                              // bare string
    '42',                                                           // bare number
    JSON.stringify({}),                                             // missing v
    JSON.stringify({ v: 99 }),                                      // wrong v
    JSON.stringify({ v: 1 }),                                       // right v, missing fields
    JSON.stringify({ v: 1, a: { b: { c: [null, { d: 'e' }] } } }),  // deeply nested rubbish
  ];

  const cases: {
    name: string;
    key: string;
    load: () => unknown;
    isValidDefault: (v: unknown) => boolean;
  }[] = [
    {
      name: 'kits', key: STORAGE_KEYS.kits, load: loadKits,
      isValidDefault: (v) => Array.isArray((v as { profiles: unknown[] }).profiles),
    },
    {
      name: 'history', key: STORAGE_KEYS.history, load: loadHistory,
      isValidDefault: (v) => Array.isArray(v),
    },
    {
      name: 'prefs', key: STORAGE_KEYS.prefs, load: loadPrefs,
      isValidDefault: (v) => Array.isArray((v as { patterns: unknown[] }).patterns)
        && (v as { patterns: unknown[] }).patterns.length > 0,
    },
    {
      name: 'active', key: STORAGE_KEYS.active, load: loadActive,
      isValidDefault: (v) => v === null || typeof v === 'object',
    },
  ];

  let sweepCount = 0;
  for (const { name, key, load, isValidDefault } of cases) {
    for (const payload of hostilePayloads) {
      sweepCount += 1;
      it(`${name} loader never throws and returns a valid default for: ${payload}`, () => {
        localStorage.setItem(key, payload);
        let result: unknown;
        expect(() => { result = load(); }).not.toThrow();
        expect(isValidDefault(result)).toBe(true);
      });
    }
  }

  it(`swept ${hostilePayloads.length} hostile payloads across ${cases.length} loaders`, () => {
    expect(sweepCount).toBe(hostilePayloads.length * cases.length);
  });
});
