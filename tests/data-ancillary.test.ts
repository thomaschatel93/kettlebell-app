import { describe, it, expect } from 'vitest';
import {
  ANCILLARY, ALL_EXERCISES, COOLDOWN_ESSENTIALS, WARMUP_ESSENTIALS,
} from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { EXERCISES } from '@/lib/data/exercises';
import { capabilityRank, type KitProfile, type WorkStep } from '@/lib/types';
import { generate } from '@/lib/generate';

describe('ancillary moves', () => {
  it('holds fourteen bodyweight moves', () => {
    // Twelve in the brief. Two more because the warm-up needed a second pulse raiser
    // and an unloaded hinge, and the two moves that would otherwise have made room for
    // them — the glute bridge and the thoracic twist — each do a job nothing else does.
    expect(ANCILLARY).toHaveLength(14);
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

describe('the jobs a block may not leave to chance', () => {
  const ESSENTIALS = [...WARMUP_ESSENTIALS, ...COOLDOWN_ESSENTIALS];

  /**
   * Deliberately a change detector. Every other test here iterates the lists, so
   * deleting an entry deletes its own check and the guarantee evaporates in silence —
   * which is how the thoracic rotation was lost the first time. Removing a job should
   * mean editing this line on purpose and saying why in the commit.
   */
  it('does not quietly stop guaranteeing a job', () => {
    expect(WARMUP_ESSENTIALS.map((g) => g.job).sort())
      .toEqual(['pulse raiser', 'unloaded hinge']);
    expect(COOLDOWN_ESSENTIALS.map((g) => g.job).sort())
      .toEqual(['hips and hamstrings', 'thoracic rotation']);
  });

  it('names only moves that exist, so a typo cannot silently drop a guarantee', () => {
    for (const g of ESSENTIALS) {
      expect(g.ids.length, g.job).toBeGreaterThan(0);
      for (const id of g.ids) {
        expect(ANCILLARY.some((e) => e.id === id), `${g.job} -> ${id}`).toBe(true);
      }
    }
  });

  it('puts each named move in the block whose job it is', () => {
    for (const g of WARMUP_ESSENTIALS)
      for (const id of g.ids) expect(ANCILLARY.find((e) => e.id === id)!.warmupSuitable, id).toBe(true);
    for (const g of COOLDOWN_ESSENTIALS)
      for (const id of g.ids) expect(ANCILLARY.find((e) => e.id === id)!.cooldownSuitable, id).toBe(true);
  });

  /**
   * The guarantee itself, read off real generated workouts rather than asserted about
   * the data. A block with room for two moves must spend them on the two jobs that
   * cannot be missed; before this the raiser turned up in 77% of short warm-ups and the
   * cool-down reached the thoracic rotation in 40%.
   */
  const KIT: KitProfile = {
    id: 'home', name: 'Home', hasBench: false,
    bells: [{ weightKg: 12, count: 1 }, { weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }],
  };

  const blockIds = (seed: number, totalMinutes: 15 | 20 | 30 | 45 | 60, block: string) => {
    const w = generate({
      request: { kitProfileId: 'home', patterns: ['hinge', 'squat', 'push'], capability: 'intermediate',
        effort: 'normal', totalMinutes, format: 'auto', seed },
      kit: KIT, exercises: ALL_EXERCISES, combos: COMBOS, history: [], now: 'n',
    });
    return [...new Set(w.steps
      .filter((s): s is WorkStep => s.kind === 'work' && s.block === block)
      .map((s) => s.exerciseId))];
  };

  const DURATIONS = [15, 20, 30, 45, 60] as const;
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

  it.each(DURATIONS)('always warms up with a pulse raiser and an unloaded hinge (%imin)', (totalMinutes) => {
    for (const seed of SEEDS) {
      const ids = blockIds(seed, totalMinutes, 'Warm-up');
      if (ids.length < 2) continue;
      for (const g of WARMUP_ESSENTIALS) {
        expect(g.ids.some((id) => ids.includes(id)), `${totalMinutes}min seed ${seed}: ${g.job}`).toBe(true);
      }
    }
  });

  it.each(DURATIONS)('always cools down with rotation and a hip or hamstring stretch (%imin)', (totalMinutes) => {
    for (const seed of SEEDS) {
      const ids = blockIds(seed, totalMinutes, 'Cool-down');
      if (ids.length < 2) continue;
      for (const g of COOLDOWN_ESSENTIALS) {
        expect(g.ids.some((id) => ids.includes(id)), `${totalMinutes}min seed ${seed}: ${g.job}`).toBe(true);
      }
    }
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
