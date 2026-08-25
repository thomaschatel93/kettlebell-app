import { describe, it, expect } from 'vitest';
import { createRng, pick, shuffle } from '@/lib/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42), b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs across seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('stays between zero and one', () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('keeps every element and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(createRng(3), input);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('pick', () => {
  it('returns a member of the list', () => {
    expect([1, 2, 3]).toContain(pick(createRng(9), [1, 2, 3]));
  });
});
