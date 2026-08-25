import { describe, it, expect } from 'vitest';
import { uniqueWeights, resolveBell, hasMatchedPair, isUnderSpecified, DEFAULT_KIT_STATE } from '@/lib/kit';
import type { KitProfile } from '@/lib/types';

const kit = (bells: { weightKg: number; count: number }[]): KitProfile => ({
  id: 'home', name: 'Home', bells, hasBench: false,
});

describe('uniqueWeights', () => {
  it('sorts ascending and removes duplicates', () => {
    expect(uniqueWeights(kit([{ weightKg: 24, count: 1 }, { weightKg: 16, count: 2 }]))).toEqual([16, 24]);
  });

  it('ignores a weight with a count of zero', () => {
    expect(uniqueWeights(kit([{ weightKg: 16, count: 0 }]))).toEqual([]);
  });
});

describe('resolveBell', () => {
  it('maps the three bands across three bells', () => {
    const k = kit([{ weightKg: 16, count: 2 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 }]);
    expect(resolveBell('light', k)).toBe(16);
    expect(resolveBell('moderate', k)).toBe(24);
    expect(resolveBell('heavy', k)).toBe(32);
  });

  it('maps every band to the only bell in a one-bell kit', () => {
    const k = kit([{ weightKg: 20, count: 1 }]);
    expect(['light', 'moderate', 'heavy'].map((b) => resolveBell(b as 'light', k))).toEqual([20, 20, 20]);
  });

  it('rounds the middle down with an even number of bells', () => {
    expect(resolveBell('moderate', kit([{ weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }]))).toBe(16);
  });

  it('returns null for an empty kit', () => {
    expect(resolveBell('light', kit([]))).toBeNull();
  });
});

describe('hasMatchedPair', () => {
  it('is true only when two bells share a weight', () => {
    expect(hasMatchedPair(kit([{ weightKg: 16, count: 2 }]))).toBe(true);
    expect(hasMatchedPair(kit([{ weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }]))).toBe(false);
  });
});

describe('isUnderSpecified', () => {
  it('flags a kit that cannot separate the three load bands', () => {
    expect(isUnderSpecified(kit([{ weightKg: 24, count: 1 }]))).toBe(true);
    expect(isUnderSpecified(kit([{ weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }]))).toBe(true);
    expect(isUnderSpecified(kit([
      { weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 },
    ]))).toBe(false);
  });
});

describe('DEFAULT_KIT_STATE', () => {
  it('ships exactly two fixed profiles, both empty, Home active', () => {
    expect(DEFAULT_KIT_STATE.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
    for (const p of DEFAULT_KIT_STATE.profiles) expect(p.bells).toEqual([]);
    expect(DEFAULT_KIT_STATE.activeId).toBe('home');
  });

  it('starts at the lowest capability', () => {
    expect(DEFAULT_KIT_STATE.capability).toBe('beginner');
  });
});
