import { describe, it, expect } from 'vitest';
import { filterPool, filterCombos, coverablePatterns, warmupPool, cooldownPool } from '@/lib/pool';
import {
  ex, req, kit, combo, FIXTURE_EXERCISES, FIXTURE_COMBOS, HOME_KIT, FULL_KIT,
} from './fixtures';

describe('filterPool', () => {
  it('drops exercises above the requested capability', () => {
    expect(filterPool([ex('a', { capability: 'advanced' })], req(), kit())).toEqual([]);
  });

  it('drops two-bell exercises without a matched pair', () => {
    const doubles = ex('d', { bells: 2 });
    expect(filterPool([doubles], req(), kit())).toEqual([]);
    expect(filterPool([doubles], req(), kit({ bells: [{ weightKg: 16, count: 2 }] }))).toHaveLength(1);
  });

  it('drops bench exercises without a bench', () => {
    const bench = ex('b', { needsBench: true });
    expect(filterPool([bench], req(), kit())).toEqual([]);
    expect(filterPool([bench], req(), kit({ hasBench: true }))).toHaveLength(1);
  });

  it('drops exercises that train none of the requested patterns', () => {
    expect(filterPool([ex('c', { patterns: ['core'] })], req({ patterns: ['hinge'] }), kit())).toEqual([]);
  });

  it('drops bell exercises when the kit is empty', () => {
    expect(filterPool([ex('a')], req(), kit({ bells: [] }))).toEqual([]);
  });

  it('excludes ancillary moves from the main pool', () => {
    expect(filterPool([ex('w', { warmupSuitable: true })], req(), kit())).toEqual([]);
    expect(filterPool([ex('c', { cooldownSuitable: true })], req(), kit())).toEqual([]);
  });

  it('keeps an exercise that satisfies everything', () => {
    expect(filterPool([ex('a')], req(), kit())).toHaveLength(1);
  });
});

describe('coverablePatterns', () => {
  it('names only the patterns the filtered pool can actually train', () => {
    const r = req({ patterns: ['hinge', 'carry'], capability: 'advanced' });
    // Every carry in the fixtures needs either two bells or is available with one.
    const pool = filterPool(FIXTURE_EXERCISES, r, HOME_KIT);
    const covered = coverablePatterns(pool, r);
    expect(covered).toContain('hinge');
    expect(coverablePatterns(filterPool(FIXTURE_EXERCISES, r, FULL_KIT), r)).toContain('carry');
  });

  it('is empty for an empty pool', () => {
    expect(coverablePatterns([], req())).toEqual([]);
  });

  it('drops a requested pattern the pool cannot train', () => {
    const pool = [ex('h', { patterns: ['hinge'] })];
    const covered = coverablePatterns(pool, req({ patterns: ['hinge', 'carry'] }));
    expect(covered).toEqual(['hinge']);
    expect(covered).not.toContain('carry');
  });
});

describe('filterCombos', () => {
  it('rejects a combo above the requested capability', () => {
    const c = combo('adv', { capability: 'advanced' });
    expect(filterCombos([c], FIXTURE_EXERCISES, req({ capability: 'beginner' }), kit())).toEqual([]);
  });

  it('rejects a two-bell combo when the kit has no matched pair', () => {
    const c = combo('double', { bells: 2 });
    expect(filterCombos([c], FIXTURE_EXERCISES, req(), kit())).toEqual([]);
  });

  it('rejects a combo whose member exercise ids do not all resolve', () => {
    const c = combo('missing', { steps: [{ exerciseId: 'nonexistent', reps: 3 }] });
    expect(filterCombos([c], FIXTURE_EXERCISES, req(), kit())).toEqual([]);
  });

  it('rejects a combo whose members are not all supported by the kit', () => {
    const c = combo('needs-bench', {
      steps: [{ exerciseId: 'f-split-squat', reps: 3 }, { exerciseId: 'f-press', reps: 3 }],
    });
    expect(filterCombos([c], FIXTURE_EXERCISES, req(), kit({ hasBench: false }))).toEqual([]);
  });

  /**
   * `buildMain` overrides `defaultReps` with the step reps, which sends `prescribe`
   * down its reps branch; a carry has `secondsPerRep: 0`, so the step costs nothing
   * and the workout reports a time it will not take. A carry can never be a member.
   */
  it('rejects a combo containing a carry', () => {
    const c = combo('with-carry', {
      steps: [{ exerciseId: 'f-clean', reps: 3 }, { exerciseId: 'f-racked-carry', reps: 5 }],
    });
    expect(filterCombos([c], FIXTURE_EXERCISES, req(), kit())).toEqual([]);
  });

  it('accepts a combo that satisfies everything', () => {
    const result = filterCombos(FIXTURE_COMBOS, FIXTURE_EXERCISES, req(), kit());
    expect(result).toContainEqual(expect.objectContaining({ id: 'f-combo-a' }));
  });
});

describe('warmupPool', () => {
  it('returns only warm-up moves', () => {
    const pool = warmupPool(FIXTURE_EXERCISES, HOME_KIT);
    expect(pool.length).toBeGreaterThan(0);
    for (const e of pool) expect(e.warmupSuitable).toBe(true);
  });

  it('keeps a bodyweight warm-up move even when the kit has no bells', () => {
    const move = ex('bw-warm', { bells: 0, warmupSuitable: true });
    expect(warmupPool([move], kit({ bells: [] }))).toEqual([move]);
  });
});

describe('cooldownPool', () => {
  it('returns only cool-down moves', () => {
    const pool = cooldownPool(FIXTURE_EXERCISES, HOME_KIT);
    expect(pool.length).toBeGreaterThan(0);
    for (const e of pool) expect(e.cooldownSuitable).toBe(true);
  });
});
