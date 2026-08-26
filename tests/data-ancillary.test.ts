import { describe, it, expect } from 'vitest';
import { ANCILLARY, ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { EXERCISES } from '@/lib/data/exercises';
import { capabilityRank } from '@/lib/types';

describe('ancillary moves', () => {
  it('holds twelve bodyweight moves', () => {
    expect(ANCILLARY).toHaveLength(12);
    for (const e of ANCILLARY) expect(e.bells).toBe(0);
  });

  it('flags each as warm-up or cool-down, never both, never neither', () => {
    for (const e of ANCILLARY) {
      expect(e.warmupSuitable !== e.cooldownSuitable, e.id).toBe(true);
    }
  });

  it('offers at least four of each', () => {
    expect(ANCILLARY.filter((e) => e.warmupSuitable).length).toBeGreaterThanOrEqual(4);
    expect(ANCILLARY.filter((e) => e.cooldownSuitable).length).toBeGreaterThanOrEqual(4);
  });

  it('prescribes every one in seconds', () => {
    for (const e of ANCILLARY) expect(e.defaultWorkSeconds).toBeDefined();
  });

  it('combines into one list with no id collisions', () => {
    expect(ALL_EXERCISES).toHaveLength(EXERCISES.length + ANCILLARY.length);
    expect(new Set(ALL_EXERCISES.map((e) => e.id)).size).toBe(ALL_EXERCISES.length);
  });
});

describe('combos', () => {
  it('holds at least six chains of at least two moves', () => {
    expect(COMBOS.length).toBeGreaterThanOrEqual(6);
    for (const c of COMBOS) expect(c.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('only references real main exercises', () => {
    for (const c of COMBOS) {
      for (const s of c.steps) {
        expect(EXERCISES.some((e) => e.id === s.exerciseId), `${c.id} -> ${s.exerciseId}`).toBe(true);
      }
    }
  });

  it('never chains an exercise above the combo capability', () => {
    for (const c of COMBOS) {
      for (const s of c.steps) {
        const e = EXERCISES.find((x) => x.id === s.exerciseId)!;
        expect(capabilityRank(e.capability), `${c.id} -> ${e.id}`).toBeLessThanOrEqual(capabilityRank(c.capability));
      }
    }
  });

  it('loads to the weakest link, so no combo containing a press is heavy', () => {
    for (const c of COMBOS) {
      const hasPress = c.steps.some((s) => s.exerciseId.includes('press'));
      if (hasPress) expect(c.loadBand, c.id).not.toBe('heavy');
    }
  });
});
