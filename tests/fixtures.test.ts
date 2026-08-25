import { describe, it, expect } from 'vitest';
import { FIXTURE_EXERCISES, FIXTURE_COMBOS } from './fixtures';
import { PATTERNS } from '@/lib/types';

describe('fixture database', () => {
  it('has unique ids', () => {
    const ids = FIXTURE_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers at least three main candidates for every pattern', () => {
    for (const p of PATTERNS) {
      const n = FIXTURE_EXERCISES.filter(
        (e) => !e.warmupSuitable && !e.cooldownSuitable && e.patterns[0] === p,
      ).length;
      expect(n, `pattern ${p}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('resolves every combo step', () => {
    for (const c of FIXTURE_COMBOS) {
      for (const s of c.steps) {
        expect(FIXTURE_EXERCISES.some((e) => e.id === s.exerciseId), `${c.id} -> ${s.exerciseId}`).toBe(true);
      }
    }
  });

  it('gives every exercise a way to be prescribed', () => {
    for (const e of FIXTURE_EXERCISES) expect(e.defaultReps ?? e.defaultWorkSeconds).toBeDefined();
  });
});
