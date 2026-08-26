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

  it('never gives one a picture, because they render as a checklist', () => {
    for (const e of ANCILLARY) expect(e.image, e.id).toBeNull();
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

  /**
   * A chain with a one-armed move in it must run whole down one side and then the
   * other. With `perSide: false` the engine expands each step into left and right in
   * place — Clean L, Clean R, Press L, Press R — which after the second clean leaves
   * the bell in the wrong hand and asks him to put it down and swap mid-chain. That
   * is the one thing a complex forbids.
   */
  it('runs any chain holding a unilateral move down one side at a time', () => {
    for (const c of COMBOS) {
      const unilateral = c.steps.some(
        (s) => EXERCISES.find((e) => e.id === s.exerciseId)!.unilateral);
      if (unilateral) expect(c.perSide, c.id).toBe(true);
    }
  });

  /**
   * `buildMain` overrides `defaultReps` with the step reps, so a carry — which has
   * `secondsPerRep: 0` and is prescribed in seconds — costs zero seconds as a chain
   * member, shows up as "5 reps" of a walk, and leaves the workout reporting a time
   * it will not take. `filterCombos` rejects one too; this is the belt to that brace.
   */
  it('never chains a carry, which would cost zero seconds and lie about the clock', () => {
    for (const c of COMBOS) {
      for (const s of c.steps) {
        const e = EXERCISES.find((x) => x.id === s.exerciseId)!;
        expect(e.mechanic, `${c.id} -> ${e.id}`).not.toBe('carry');
      }
    }
  });

  /**
   * Fatigue accumulates through a chain and again across rounds, so chain reps are
   * lower than the same move done on its own. Three to five is the working range for
   * a grind or a clean; a swing tops out the ceiling. Anything above it is a typo,
   * not a prescription.
   */
  it('keeps every step inside a sane rep range', () => {
    for (const c of COMBOS) {
      for (const s of c.steps) {
        expect(s.reps, `${c.id} -> ${s.exerciseId}`).toBeGreaterThanOrEqual(2);
        expect(s.reps, `${c.id} -> ${s.exerciseId}`).toBeLessThanOrEqual(10);
      }
    }
  });
});
