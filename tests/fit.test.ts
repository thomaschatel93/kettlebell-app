import { describe, it, expect } from 'vitest';
import { roundDuration, blockSeconds, deviation, trimToBudget } from '@/lib/fit';
import { ex } from './fixtures';
import type { BlockPlan } from '@/lib/flatten';

const item = (est: number, rest: number) => ({
  exercise: ex('a'), bellKg: 16, reps: 10, restSeconds: rest, estSeconds: est,
});

describe('roundDuration', () => {
  it('sums the work and the rests between items, but not after the last', () => {
    expect(roundDuration([item(30, 20), item(30, 20), item(30, 20)])).toBe(130);
  });

  it('handles a single item', () => {
    expect(roundDuration([item(30, 20)])).toBe(30);
  });

  it('respects a rest that varies between items', () => {
    expect(roundDuration([item(10, 5), item(10, 40), item(10, 99)])).toBe(75);
  });
});

describe('blockSeconds', () => {
  it('counts the between-rounds rests, one fewer than the rounds', () => {
    const plan: BlockPlan = { block: 'Main', rounds: 3, betweenRoundsRest: 60, items: [item(30, 20), item(30, 20)] };
    expect(blockSeconds(plan)).toBe(3 * 80 + 2 * 60);
  });

  it('is zero for an empty block', () => {
    expect(blockSeconds({ block: 'Main', rounds: 3, betweenRoundsRest: 60, items: [] })).toBe(0);
  });
});

describe('deviation', () => {
  it('is a fraction of the target', () => {
    expect(deviation(110, 100)).toBeCloseTo(0.1);
    expect(deviation(90, 100)).toBeCloseTo(0.1);
  });
});

describe('trimToBudget', () => {
  const plan: BlockPlan = { block: 'Main', rounds: 4, betweenRoundsRest: 75, items: [item(30, 20), item(30, 20)] };

  it('closes the residual on the between-rounds rest', () => {
    const target = 4 * 80 + 3 * 100;              // wants a 100s round rest
    expect(trimToBudget(plan, target).betweenRoundsRest).toBe(100);
  });

  it('clamps the rest to a sane band', () => {
    expect(trimToBudget(plan, 10_000).betweenRoundsRest).toBe(180);
    expect(trimToBudget(plan, 100).betweenRoundsRest).toBe(30);
  });

  it('leaves a single-round block alone, because there is no knob', () => {
    const single = { ...plan, rounds: 1 };
    expect(trimToBudget(single, 9999)).toEqual(single);
  });
});
