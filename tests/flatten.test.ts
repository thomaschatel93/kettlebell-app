import { describe, it, expect } from 'vitest';
import { buildSteps, planItems, type BlockPlan } from '@/lib/flatten';
import { blockSeconds } from '@/lib/fit';
import { ex, kit, FULL_KIT } from './fixtures';
import type { WorkStep } from '@/lib/types';

const item = (id: string, est: number, rest: number) => ({
  exercise: ex(id), bellKg: 16, reps: 10, restSeconds: rest, estSeconds: est,
});

const plan: BlockPlan = {
  block: 'Main', rounds: 2, betweenRoundsRest: 60,
  items: [item('a', 20, 30), item('b', 20, 30)],
};

describe('planItems', () => {
  it('emits one item for a bilateral exercise', () => {
    expect(planItems(ex('a'), FULL_KIT, 'circuit', 'normal')).toHaveLength(1);
  });

  it('emits one item per side for a unilateral exercise', () => {
    const out = planItems(ex('u', { unilateral: true }), FULL_KIT, 'circuit', 'normal');
    expect(out.map((i) => i.side)).toEqual(['left', 'right']);
    expect(out[0].estSeconds).toBe(out[1].estSeconds);
  });

  it('gives a bodyweight move no bell', () => {
    expect(planItems(ex('w', { bells: 0 }), FULL_KIT, 'circuit', 'normal')[0].bellKg).toBeNull();
  });

  it('resolves the bell from the load band', () => {
    expect(planItems(ex('h', { loadBand: 'heavy' }), FULL_KIT, 'circuit', 'normal')[0].bellKg).toBe(32);
    expect(planItems(ex('l', { loadBand: 'light' }), FULL_KIT, 'circuit', 'normal')[0].bellKg).toBe(16);
  });

  it('returns no items when the kit has no bell for a loaded exercise', () => {
    expect(planItems(ex('a'), kit({ bells: [] }), 'circuit', 'normal')).toEqual([]);
  });
});

describe('buildSteps', () => {
  const steps = buildSteps([plan]);

  it('runs every item in every round', () => {
    const names = steps.filter((s): s is WorkStep => s.kind === 'work').map((s) => s.name);
    expect(names).toEqual(['A', 'B', 'A', 'B']);
  });

  it('never ends on a rest', () => {
    expect(steps.at(-1)!.kind).toBe('work');
  });

  it('uses the between-rounds rest at the end of a round, but never after the last', () => {
    expect(steps.filter((s) => s.kind === 'rest').map((s) => s.seconds)).toEqual([30, 60, 30]);
  });

  it('does not leak a rest across a block boundary', () => {
    const two = buildSteps([
      { ...plan, block: 'Main' },
      { block: 'Cool-down', rounds: 1, betweenRoundsRest: 0, items: [item('z', 30, 10)] },
    ]);
    const idx = two.findIndex((s) => s.block === 'Cool-down');
    expect(two[idx - 1].kind).toBe('rest');
    // The rest before the boundary is an item rest, not the Main block's round rest.
    const boundary = two[idx - 1];
    expect(boundary.kind === 'rest' && boundary.seconds).toBe(30);
  });

  it('names what comes next on every rest, across blocks', () => {
    const two = buildSteps([
      { block: 'Warm-up', rounds: 1, betweenRoundsRest: 0, items: [item('a', 30, 15)] },
      { block: 'Main', rounds: 1, betweenRoundsRest: 0, items: [item('z', 20, 30)] },
    ]);
    const rest = two.find((s) => s.kind === 'rest');
    expect(rest && rest.kind === 'rest' && rest.nextName).toBe('Z');
  });

  it('records the position within the round', () => {
    const first = steps[0] as WorkStep;
    expect([first.round, first.totalRounds, first.indexInRound, first.itemsInRound]).toEqual([1, 2, 1, 2]);
  });

  it('carries the side onto the step', () => {
    const uni = buildSteps([{
      block: 'Main', rounds: 1, betweenRoundsRest: 0,
      items: planItems(ex('u', { unilateral: true }), FULL_KIT, 'circuit', 'normal'),
    }]);
    expect(uni.filter((s): s is WorkStep => s.kind === 'work').map((s) => s.side)).toEqual(['left', 'right']);
  });

  it('skips a block with no items', () => {
    expect(buildSteps([{ block: 'Main', rounds: 2, betweenRoundsRest: 60, items: [] }])).toEqual([]);
  });

  it('agrees exactly with blockSeconds', () => {
    const total = buildSteps([plan]).reduce((a, s) => a + s.estSeconds, 0);
    expect(total).toBe(blockSeconds(plan));
  });
});
