import { describe, it, expect } from 'vitest';
import { filterPool, coverablePatterns, warmupPool } from '@/lib/pool';
import { ex, req, kit, FIXTURE_EXERCISES, HOME_KIT, FULL_KIT } from './fixtures';

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
});

describe('warmupPool', () => {
  it('returns only warm-up moves', () => {
    const pool = warmupPool(FIXTURE_EXERCISES, HOME_KIT);
    expect(pool.length).toBeGreaterThan(0);
    for (const e of pool) expect(e.warmupSuitable).toBe(true);
  });
});
