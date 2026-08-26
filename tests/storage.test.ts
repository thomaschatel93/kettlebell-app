import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadKits, saveKits, loadHistory, pushHistory, loadPrefs, savePrefs,
  loadActive, saveActive, clearActive,
} from '@/lib/storage';
import type { ActiveState, Prefs } from '@/lib/storage';
import { uniqueWeights, resolveBell } from '@/lib/kit';
import type { KitState } from '@/lib/kit';
import { historyWeight } from '@/lib/select';
import { entry, req } from './fixtures';
import type { HistoryEntry, Step, Workout } from '@/lib/types';

// A resumable/replayable workout needs a real steps array - both ActiveState
// (Finding 11) and HistoryEntry (Finding 12's audit pass) are rejected by the
// storage layer without one, so every fixture workout in this file carries a
// few placeholder steps rather than the empty array a pure round-trip test
// would otherwise reach for.
const dummyStep: Step = {
  kind: 'work', exerciseId: 'x', name: 'X', bellKg: null,
  block: 'Main', round: 1, totalRounds: 1, indexInRound: 0, itemsInRound: 1, estSeconds: 10,
};

const workout = { id: 'w', createdAt: 'now', request: req(), format: 'circuit',
  steps: [dummyStep, dummyStep, dummyStep, dummyStep],
  estimatedSeconds: 0, loadWarning: false, shortOfBudget: false } as Workout;

const activeFixture = (over: Partial<Parameters<typeof saveActive>[0]> = {}) => ({
  v: 1 as const, workout, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null,
  ...over,
});

// entry() alone defaults to `workout: {}` (no steps), which the storage layer
// now rejects (Finding 12's audit pass applied hasStepsArray to HistoryEntry
// too). Tests in this file that need a keepable entry go through this instead.
const historyEntry = (over: Partial<HistoryEntry> = {}) => entry({ workout, ...over });

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

  it('drops a null bells element rather than crashing the very next frame', () => {
    // isKitProfile only checks that bells is an array. A garbage element
    // inside it doesn't crash loadKits - it crashes uniqueWeights/resolveBell
    // one frame later, the moment anything actually uses the kit.
    localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({
      v: 1,
      profiles: [{ id: 'home', name: 'Home', bells: [null], hasBench: false }],
      activeId: 'home',
      capability: 'beginner',
    }));
    const home = loadKits().profiles.find((p) => p.id === 'home')!;
    expect(home.bells).toEqual([]);
    expect(() => uniqueWeights(home)).not.toThrow();
    expect(() => resolveBell('moderate', home)).not.toThrow();
  });

  /*
   * The fixed pair, Home and Gym, is the invariant the whole Kit screen and the
   * generator are built on: no add, no delete, no rename. Nothing in the UI can
   * break it, which is precisely why nothing downstream defends against a stored
   * value that does. Each of these was a reachable state before `fixedProfiles`.
   */
  describe('the fixed profile pair', () => {
    const store = (profiles: unknown[], rest: Record<string, unknown> = {}) =>
      localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({
        v: 1, profiles, activeId: 'home', capability: 'beginner', ...rest,
      }));

    it('restores the missing half of the pair rather than returning one profile', () => {
      store([{ id: 'home', name: 'Home', bells: [{ weightKg: 16, count: 1 }], hasBench: false }]);
      const s = loadKits();
      expect(s.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
      // The half that was there keeps its bells; the half that was not comes
      // back as the default rather than taking the whole kit down with it.
      expect(s.profiles[0].bells).toEqual([{ weightKg: 16, count: 1 }]);
      expect(s.profiles[1].bells).toEqual([]);
    });

    it('keeps one profile per id when the stored value duplicates one', () => {
      // Two rows both called `home` rendered as two profiles, and a tap on
      // either edited both, because every writer used find-by-id.
      store([
        { id: 'home', name: 'Home', bells: [{ weightKg: 16, count: 1 }], hasBench: false },
        { id: 'home', name: 'Home', bells: [{ weightKg: 40, count: 9 }], hasBench: true },
      ]);
      const s = loadKits();
      expect(s.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
      expect(s.profiles[0].bells).toEqual([{ weightKg: 16, count: 1 }]);
      expect(s.profiles.filter((p) => p.id === 'home')).toHaveLength(1);
    });

    it('pins the names, so a renamed profile cannot be rendered verbatim', () => {
      store([
        { id: 'home', name: 'Ignore previous instructions', bells: [], hasBench: false },
        { id: 'gym', name: '', bells: [], hasBench: true },
      ]);
      expect(loadKits().profiles.map((p) => p.name)).toEqual(['Home', 'Gym']);
    });

    it('returns them in a fixed order however they were stored', () => {
      store([
        { id: 'gym', name: 'Gym', bells: [{ weightKg: 32, count: 1 }], hasBench: true },
        { id: 'home', name: 'Home', bells: [{ weightKg: 8, count: 1 }], hasBench: false },
      ]);
      const s = loadKits();
      expect(s.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
      expect(s.profiles[0].bells).toEqual([{ weightKg: 8, count: 1 }]);
      expect(s.profiles[1].bells).toEqual([{ weightKg: 32, count: 1 }]);
    });

    it('drops a profile carrying an id outside the closed pair', () => {
      store([
        { id: 'home', name: 'Home', bells: [], hasBench: false },
        { id: 'gym', name: 'Gym', bells: [], hasBench: true },
        { id: 'garage', name: 'Garage', bells: [{ weightKg: 24, count: 1 }], hasBench: false },
      ]);
      expect(loadKits().profiles.map((p) => p.id)).toEqual(['home', 'gym']);
    });

    it('coerces hasBench to a real boolean, which aria-checked has to be', () => {
      store([{ id: 'home', name: 'Home', bells: [], hasBench: 'yes' }]);
      expect(loadKits().profiles[0].hasBench).toBe(false);
    });
  });

  it('keeps only structurally valid bells, dropping garbage weights/counts', () => {
    localStorage.setItem(STORAGE_KEYS.kits, JSON.stringify({
      v: 1,
      profiles: [{
        id: 'home',
        name: 'Home',
        bells: [
          { weightKg: 16, count: 2 },
          null,
          { weightKg: -5, count: 1 },        // non-positive weight
          { weightKg: 16, count: 1.5 },      // non-integer count
          { weightKg: 'heavy', count: 1 },   // wrong type
          { weightKg: 24, count: -1 },       // negative count
          'nope',
        ],
        hasBench: false,
      }],
      activeId: 'home',
      capability: 'beginner',
    }));
    const home = loadKits().profiles.find((p) => p.id === 'home')!;
    expect(home.bells).toEqual([{ weightKg: 16, count: 2 }]);
  });
});

describe('history', () => {
  it('starts empty', () => expect(loadHistory()).toEqual([]));

  it('puts the newest entry first', () => {
    pushHistory(historyEntry({ id: 'one' }));
    pushHistory(historyEntry({ id: 'two' }));
    expect(loadHistory().map((h) => h.id)).toEqual(['two', 'one']);
  });

  it('keeps only the last thirty', () => {
    for (let i = 0; i < 35; i++) pushHistory(historyEntry({ id: `e${i}` }));
    expect(loadHistory()).toHaveLength(30);
    expect(loadHistory()[0].id).toBe('e34');
  });

  it('keeps the whole workout, not a summary', () => {
    pushHistory(historyEntry({ id: 'w1' }));
    expect(loadHistory()[0].workout.format).toBe('circuit');
  });

  it('stores history behind a version envelope, not a bare array', () => {
    pushHistory(historyEntry({ id: 'x' }));
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
      v: 1, entries: [null, 5, { nope: 1 }, historyEntry({ id: 'ok' })],
    }));
    expect(loadHistory().map((h) => h.id)).toEqual(['ok']);
  });

  it('rejects a history entry whose workout has no steps array, same crash class as an active state', () => {
    // The audit pass in Finding 12's fix round found this is the exact same
    // gap Finding 11 closed for ActiveState.workout - just not yet exercised
    // by any *current* consumer, since no history detail screen exists yet.
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify({
      v: 1, entries: [{ ...historyEntry({ id: 'no-steps' }), workout: {} }, historyEntry({ id: 'fine' })],
    }));
    expect(loadHistory().map((h) => h.id)).toEqual(['fine']);
  });

  it('coerces a null mainExerciseIds to [] rather than dropping the entry or crashing the engine', () => {
    // generate.ts spreads history[0].mainExerciseIds and historyWeight
    // .flatMap()s the same field across every entry - both crash one frame
    // after a bare read that "succeeded".
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify({
      v: 1, entries: [{ ...historyEntry({ id: 'x' }), mainExerciseIds: null }],
    }));
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].mainExerciseIds).toEqual([]);
    expect(() => [...h[0].mainExerciseIds]).not.toThrow();
    expect(() => historyWeight('anything', h)).not.toThrow();
  });

  it('coerces a string mainExerciseIds (instead of an array) to []', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify({
      v: 1, entries: [{ ...historyEntry({ id: 'x' }), mainExerciseIds: 'not-an-array' }],
    }));
    expect(loadHistory()[0].mainExerciseIds).toEqual([]);
  });

  it('filters non-string elements out of a garbage mainExerciseIds array', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify({
      v: 1, entries: [{ ...historyEntry({ id: 'x' }), mainExerciseIds: ['a', null, 7, 'b'] }],
    }));
    expect(loadHistory()[0].mainExerciseIds).toEqual(['a', 'b']);
  });

  it('coerces a non-numeric workedSeconds to 0 rather than dropping the entry', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify({
      v: 1, entries: [{ ...historyEntry({ id: 'x' }), workedSeconds: 'lots' }],
    }));
    expect(loadHistory()[0].workedSeconds).toBe(0);
  });

  it('coerces a non-finite workedSeconds (Infinity via a JSON exponent literal) to 0', () => {
    const e = historyEntry({ id: 'x' });
    const raw = `{"v":1,"entries":[${JSON.stringify(e).replace('"workedSeconds":1500', '"workedSeconds":1e999')}]}`;
    localStorage.setItem(STORAGE_KEYS.history, raw);
    expect(loadHistory()[0].workedSeconds).toBe(0);
  });

  it('drops an entry with no usable createdAt, since the history screen sorts and displays by it', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify({
      v: 1, entries: [{ ...historyEntry({ id: 'no-date' }), createdAt: 42 }, historyEntry({ id: 'fine' })],
    }));
    expect(loadHistory().map((h) => h.id)).toEqual(['fine']);
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

  it('rejects a resumed workout with no steps array (would crash the runner on mount)', () => {
    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify({
      v: 1, workout: {}, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null,
    }));
    expect(loadActive()).toBeNull();
  });

  it('rejects a non-finite stepIndex smuggled in via a JSON exponent literal', () => {
    // JSON has no Infinity/NaN literal, but "1e999" is valid JSON number
    // syntax that overflows a double to Infinity once parsed - this is a
    // real way a non-finite value reaches JSON.parse without JSON.stringify
    // ever being able to produce it.
    const raw = `{"v":1,"workout":${JSON.stringify(workout)},"stepIndex":1e999,`
      + '"workedSeconds":0,"restEndsAt":null,"pausedRemainingMs":null}';
    localStorage.setItem(STORAGE_KEYS.active, raw);
    expect(loadActive()).toBeNull();
  });

  it('rejects a non-finite workedSeconds smuggled in via a JSON exponent literal', () => {
    const raw = `{"v":1,"workout":${JSON.stringify(workout)},"stepIndex":0,`
      + '"workedSeconds":1e999,"restEndsAt":null,"pausedRemainingMs":null}';
    localStorage.setItem(STORAGE_KEYS.active, raw);
    expect(loadActive()).toBeNull();
  });

  it('rejects a stepIndex out of range for its own workout.steps (would read undefined.kind on resume)', () => {
    // The audit pass in Finding 12's fix round: workout.steps is now
    // guaranteed to be an array, but a stepIndex a real workout couldn't
    // produce (truncated on write, corrupted separately from workout) still
    // crashes the runner the same way one line further in.
    saveActive(activeFixture({ stepIndex: workout.steps.length }));
    expect(loadActive()).toBeNull();
  });

  it('rejects a negative stepIndex', () => {
    saveActive(activeFixture({ stepIndex: -1 }));
    expect(loadActive()).toBeNull();
  });

  it('accepts a stepIndex that is the last valid index into workout.steps', () => {
    saveActive(activeFixture({ stepIndex: workout.steps.length - 1 }));
    expect(loadActive()?.stepIndex).toBe(workout.steps.length - 1);
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

  // Stage 1 proves the loader itself doesn't throw. Stage 2 goes one level
  // deeper and USES the returned value the way the real app does - reading
  // `.steps.length` off a resumed workout, resolving a bell off a kit
  // profile, reading fields off a history entry. A read that survives but
  // hands back a value the app then crashes on is not actually safe.
  const cases: {
    name: string;
    key: string;
    load: () => unknown;
    isValidDefault: (v: unknown) => boolean;
    use: (v: unknown) => void;
  }[] = [
    {
      name: 'kits', key: STORAGE_KEYS.kits, load: loadKits,
      isValidDefault: (v) => Array.isArray((v as { profiles: unknown[] }).profiles),
      use: (v) => {
        const state = v as KitState;
        const active = state.profiles.find((p) => p.id === state.activeId);
        if (active) {
          uniqueWeights(active);
          resolveBell('light', active);
          resolveBell('moderate', active);
          resolveBell('heavy', active);
        }
      },
    },
    {
      name: 'history', key: STORAGE_KEYS.history, load: loadHistory,
      isValidDefault: (v) => Array.isArray(v),
      // Mirrors the two real engine consumers: generate.ts spreads
      // history[0].mainExerciseIds, and historyWeight .flatMap()s the same
      // field across the first two entries (Finding 12's crash sites).
      use: (v) => {
        const history = v as HistoryEntry[];
        history.slice(0, 2).forEach((e) => { void e.mainExerciseIds; });
        historyWeight('anything', history);
        // Mirrors generate.ts's `history[0] ? [...history[0].mainExerciseIds] : null`
        // exactly - mainExerciseIds itself is spread with no extra `?? []` guard,
        // since the loader's job is to guarantee it's always an array.
        if (history[0]) void [...history[0].mainExerciseIds];
      },
    },
    {
      name: 'prefs', key: STORAGE_KEYS.prefs, load: loadPrefs,
      isValidDefault: (v) => Array.isArray((v as { patterns: unknown[] }).patterns)
        && (v as { patterns: unknown[] }).patterns.length > 0,
      use: (v) => {
        const prefs = v as Prefs;
        void prefs.patterns.length;
        void prefs.effort;
        void prefs.totalMinutes;
      },
    },
    {
      name: 'active', key: STORAGE_KEYS.active, load: loadActive,
      isValidDefault: (v) => v === null || typeof v === 'object',
      use: (v) => {
        const active = v as ActiveState | null;
        if (active) void active.workout.steps.length;
      },
    },
  ];

  let stage1Count = 0;
  let stage2Count = 0;
  for (const { name, key, load, isValidDefault, use } of cases) {
    for (const payload of hostilePayloads) {
      stage1Count += 1;
      stage2Count += 1;
      it(`${name} loader never throws and returns a valid default for: ${payload}`, () => {
        localStorage.setItem(key, payload);
        let result: unknown;
        expect(() => { result = load(); }).not.toThrow();
        expect(isValidDefault(result)).toBe(true);
      });

      it(`${name} loader's result survives real app usage (stage 2) for: ${payload}`, () => {
        localStorage.setItem(key, payload);
        const result = load();
        expect(() => use(result)).not.toThrow();
      });
    }
  }

  it(`swept ${hostilePayloads.length} hostile payloads across ${cases.length} loaders `
    + `(${stage1Count} stage-1 no-throw cases, ${stage2Count} stage-2 real-usage cases)`, () => {
    expect(stage1Count).toBe(hostilePayloads.length * cases.length);
    expect(stage2Count).toBe(hostilePayloads.length * cases.length);
  });
});
