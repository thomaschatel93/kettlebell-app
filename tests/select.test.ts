import { describe, it, expect } from 'vitest';
import { historyWeight, orderCircuit, selectCircuit, selectStrength } from '@/lib/select';
import { createRng, shuffle } from '@/lib/rng';
import { ex, req, entry, FIXTURE_EXERCISES } from './fixtures';
import { filterPool } from '@/lib/pool';
import { FULL_KIT } from './fixtures';
import type { Exercise, Pattern } from '@/lib/types';

const adjacentOk = (out: Exercise[], wrap: boolean): boolean => {
  for (let i = 1; i < out.length; i++) if (out[i].patterns[0] === out[i - 1].patterns[0]) return false;
  if (wrap && out.length > 1 && out[0].patterns[0] === out.at(-1)!.patterns[0]) return false;
  return true;
};

/**
 * A circuit admits an ordering when no single pattern holds more than half the slots.
 * Half means floor, not ceil, because the wrap-around makes this a circle: n slots
 * need n separators, so three of five is already one too many. Ceil is the bound for
 * a straight line, where the two ends never meet.
 */
const solvable = (items: Exercise[]): boolean => {
  const counts = new Map<Pattern, number>();
  for (const e of items) counts.set(e.patterns[0], (counts.get(e.patterns[0]) ?? 0) + 1);
  return Math.max(...counts.values()) <= Math.floor(items.length / 2);
};

describe('historyWeight', () => {
  it('penalises anything in the last two workouts, compared on main ids', () => {
    const h = [entry({ mainExerciseIds: ['a'] }), entry({ mainExerciseIds: ['b'] }), entry({ mainExerciseIds: ['c'] })];
    expect(historyWeight('a', h)).toBe(0.25);
    expect(historyWeight('b', h)).toBe(0.25);
    expect(historyWeight('c', h)).toBe(1);
    expect(historyWeight('z', h)).toBe(1);
  });
});

describe('orderCircuit', () => {
  it('opens on a ballistic when one is present', () => {
    const out = orderCircuit([
      ex('carry', { mechanic: 'carry', patterns: ['carry'] }),
      ex('press', { patterns: ['push'] }),
      ex('swing', { mechanic: 'ballistic', patterns: ['hinge'] }),
    ]);
    expect(out[0].id).toBe('swing');
  });

  it('puts carries and core last', () => {
    const out = orderCircuit([
      ex('carry', { mechanic: 'carry', patterns: ['carry'] }),
      ex('press', { patterns: ['push'] }),
      ex('swing', { mechanic: 'ballistic', patterns: ['hinge'] }),
    ]);
    expect(out.at(-1)!.id).toBe('carry');
  });

  it('finds a valid ordering whenever one exists, wrap-around included', () => {
    const patterns: Pattern[] = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'];
    let checked = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const rng = createRng(seed);
      const n = 4 + Math.floor(rng() * 3);
      const items = Array.from({ length: n }, (_, i) =>
        ex(`e${i}`, { patterns: [patterns[Math.floor(rng() * patterns.length)]] }));
      if (!solvable(items)) continue;
      checked++;
      expect(adjacentOk(orderCircuit(items), true), `seed ${seed}`).toBe(true);
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('still returns every item when no valid ordering exists', () => {
    const four = Array.from({ length: 4 }, (_, i) => ex(`h${i}`, { patterns: ['hinge'] }));
    expect(orderCircuit(four)).toHaveLength(4);
  });
});

describe('selectCircuit', () => {
  const pool = filterPool(FIXTURE_EXERCISES, req({ patterns: ['hinge', 'squat', 'push'], capability: 'advanced' }), FULL_KIT);

  it('returns exactly the count asked for', () => {
    expect(selectCircuit(pool, req(), createRng(1), [], 5)).toHaveLength(5);
  });

  it('covers every requested pattern', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const out = selectCircuit(pool, req(), createRng(seed), [], 4);
      const covered = new Set(out.flatMap((e) => e.patterns));
      for (const p of req().patterns) expect(covered, `seed ${seed}`).toContain(p);
    }
  });

  it('prefers an exercise not used in the last two workouts', () => {
    const small = [ex('a', { patterns: ['hinge'] }), ex('b', { patterns: ['hinge'] })];
    const out = selectCircuit(small, req({ patterns: ['hinge'] }), createRng(11), [entry({ mainExerciseIds: ['a'] })], 1);
    expect(out.map((e) => e.id)).toEqual(['b']);
  });

  it('spreads the fill across under-represented patterns', () => {
    const out = selectCircuit(pool, req({ patterns: ['hinge'] }), createRng(3), [], 4);
    const primaries = out.map((e) => e.patterns[0]);
    expect(new Set(primaries).size).toBeGreaterThan(1);
  });

  it('never repeats an exercise', () => {
    const out = selectCircuit(pool, req(), createRng(6), [], 6);
    expect(new Set(out.map((e) => e.id)).size).toBe(out.length);
  });

  it('returns what it can when the pool is smaller than the count', () => {
    expect(selectCircuit(pool.slice(0, 2), req(), createRng(2), [], 6)).toHaveLength(2);
  });
});

describe('selectStrength', () => {
  const pool = filterPool(FIXTURE_EXERCISES, req({ capability: 'advanced' }), FULL_KIT);

  it('returns the count asked for, opening on a grind', () => {
    const out = selectStrength(pool, createRng(1), [], 3);
    expect(out).toHaveLength(3);
    expect(out[0].mechanic).toBe('grind');
  });

  it('prefers distinct primary patterns', () => {
    const out = selectStrength(pool, createRng(4), [], 3);
    expect(new Set(out.map((e) => e.patterns[0])).size).toBeGreaterThan(1);
  });
});
