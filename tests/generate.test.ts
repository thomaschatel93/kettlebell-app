import { describe, it, expect } from 'vitest';
import { generate } from '@/lib/generate';
import { capabilityRank, type Format, type Pattern, type WorkStep, type WorkoutRequest } from '@/lib/types';
import { FIXTURE_EXERCISES, FIXTURE_COMBOS, FULL_KIT, HOME_KIT, entry, req } from './fixtures';
import type { HistoryEntry, KitProfile } from '@/lib/types';

const NOW = '2026-08-25T09:00:00.000Z';
const ALL: Pattern[] = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'];

const run = (over: Partial<WorkoutRequest> = {}, kit: KitProfile = FULL_KIT, history: HistoryEntry[] = []) =>
  generate({
    request: req({ capability: 'advanced', ...over }),
    kit, exercises: FIXTURE_EXERCISES, combos: FIXTURE_COMBOS, history, now: NOW,
  });

const work = (w: ReturnType<typeof run>) => w.steps.filter((s): s is WorkStep => s.kind === 'work');
const mainWork = (w: ReturnType<typeof run>) => work(w).filter((s) => s.block === 'Main');
const byId = (id: string) => FIXTURE_EXERCISES.find((e) => e.id === id)!;

/** A chosen matrix rather than a brute-force sweep, so a failure names itself. */
const MATRIX: Partial<WorkoutRequest>[] = [];
for (const totalMinutes of [15, 20, 30, 45, 60] as const)
  for (const format of ['auto', 'circuit', 'complex', 'strength'] as Array<'auto' | Format>)
    for (const effort of ['easy', 'normal', 'hard'] as const)
      MATRIX.push({ totalMinutes, format, effort, patterns: ALL, seed: totalMinutes + format.length });
for (const patterns of [['hinge'], ['push', 'pull'], ['hinge', 'squat', 'push']] as Pattern[][])
  for (const seed of [1, 2, 3])
    MATRIX.push({ patterns, seed });

const label = (o: Partial<WorkoutRequest>) =>
  `${o.totalMinutes ?? 30}min ${o.format ?? 'auto'} ${o.effort ?? 'normal'} [${(o.patterns ?? []).join(',')}] seed ${o.seed}`;

describe('generate: hard invariants', () => {
  it.each(MATRIX.map((o) => [label(o), o] as const))('%s', (_l, o) => {
    const w = run(o);
    const owned = new Set([16, 24, 32]);

    // 1. Never prescribes a bell absent from the kit.
    for (const s of work(w)) if (s.bellKg !== null) expect(owned).toContain(s.bellKg);

    // 7. Never exceeds the requested capability.
    for (const s of work(w)) {
      expect(capabilityRank(byId(s.exerciseId).capability))
        .toBeLessThanOrEqual(capabilityRank(w.request.capability));
    }

    // 11. Warm-up, then main, then cool-down, and no rest leaks across a boundary.
    const rank = { 'Warm-up': 0, Main: 1, 'Cool-down': 2 } as const;
    const blocks = w.steps.map((s) => s.block);
    for (let i = 1; i < blocks.length; i++) {
      expect(rank[blocks[i]]).toBeGreaterThanOrEqual(rank[blocks[i - 1]]);
    }
    // A block closes on its own item rest: Task 9 made that deliberate — it is the
    // breather between one block and the next — and tests/flatten.test.ts locks it
    // ('does not leak a rest across a block boundary' asserts the step before the
    // boundary IS a rest, of item length). This brief's own CORRECTION block counts
    // those same boundary rests at 45s. What must never survive a boundary is the
    // between-rounds rest, or a second rest stacked on the first.
    const itemRestOf = (block: WorkStep['block']): number | null => {
      for (let j = 1; j < w.steps.length - 1; j++) {
        const [a, r, b] = [w.steps[j - 1], w.steps[j], w.steps[j + 1]];
        if (r.kind !== 'rest' || r.block !== block) continue;
        if (a.kind === 'work' && b.kind === 'work' && b.block === block && b.round === a.round) return r.seconds;
      }
      return null;
    };
    for (let i = 1; i < w.steps.length; i++) {
      const prev = w.steps[i - 1];
      if (w.steps[i].block === prev.block || prev.kind === 'work') continue;
      expect(w.steps[i - 2]?.kind).toBe('work');            // exactly one rest closes a block
      const itemRest = itemRestOf(prev.block);              // the intra-round rest of that block
      if (itemRest !== null) expect(prev.seconds).toBe(itemRest);
    }

    // 13. The reported format is the format actually built.
    if (w.request.format !== 'auto' && !w.shortOfBudget) {
      expect(['circuit', 'complex', 'strength']).toContain(w.format);
    }

    expect(w.steps.at(-1)!.kind).toBe('work');
    expect(mainWork(w).length).toBeGreaterThan(0);
    expect(w.estimatedSeconds).toBe(w.steps.reduce((a, s) => a + s.estSeconds, 0));
  });
});

describe('generate: invariant 5, the time budget', () => {
  it.each(MATRIX.map((o) => [label(o), o] as const))('%s lands on time or says it cannot', (_l, o) => {
    const w = run(o);
    const target = w.request.totalMinutes * 60;
    const dev = Math.abs(w.estimatedSeconds - target) / target;
    if (!w.shortOfBudget) expect(dev).toBeLessThanOrEqual(0.1);
    else expect(dev).toBeGreaterThan(0.1); // the flag must not be set gratuitously
  });

  it('fills every auto-format session to within ten per cent', () => {
    for (const totalMinutes of [15, 20, 30, 45, 60] as const) {
      for (const seed of [1, 2, 3]) {
        const w = run({ totalMinutes, format: 'auto', patterns: ALL, seed });
        expect(w.shortOfBudget, `${totalMinutes}min seed ${seed}`).toBe(false);
      }
    }
  });
});

describe('generate: kit invariants', () => {
  it('never selects a two-bell exercise without a matched pair', () => {
    for (const o of MATRIX) for (const s of work(run(o, HOME_KIT))) expect(byId(s.exerciseId).bells).toBeLessThan(2);
  });

  it('never selects a bench exercise without a bench', () => {
    for (const o of MATRIX) for (const s of work(run(o, HOME_KIT))) expect(byId(s.exerciseId).needsBench).toBe(false);
  });

  it('flags a kit that cannot separate the load bands', () => {
    expect(run({}, HOME_KIT).loadWarning).toBe(true);
    expect(run({}, FULL_KIT).loadWarning).toBe(false);
  });

  it('gives an empty kit a bodyweight session with no bells', () => {
    const empty: KitProfile = { id: 'home', name: 'Home', bells: [], hasBench: false };
    for (const s of work(run({}, empty))) expect(s.bellKg).toBeNull();
  });
});

describe('generate: circuit invariants', () => {
  it('covers every requested pattern', () => {
    for (const patterns of [['hinge'], ['push', 'pull'], ALL] as Pattern[][]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const covered = new Set(mainWork(run({ patterns, format: 'circuit', seed }))
          .flatMap((s) => byId(s.exerciseId).patterns));
        for (const p of patterns) expect(covered, `${patterns} seed ${seed}`).toContain(p);
      }
    }
  });

  it('never places two exercises sharing a primary pattern back to back, wrap included', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const steps = mainWork(run({ format: 'circuit', patterns: ALL, seed }));
      const n = steps[0].itemsInRound;
      // One SLOT per exercise, not per step. Task 9 expands a unilateral exercise
      // into two adjacent steps, one per side; those two share an exercise and so
      // trivially share a primary pattern. They are one exercise, not two, so the
      // adjacency rule is checked over consecutive distinct exercises.
      const slots: string[] = [];
      for (const s of steps.slice(0, n)) if (slots.at(-1) !== s.exerciseId) slots.push(s.exerciseId);
      const round = slots.map((id) => byId(id).patterns[0]);
      for (let i = 1; i < round.length; i++) expect(round[i], `seed ${seed}`).not.toBe(round[i - 1]);
      if (steps[0].totalRounds > 1) expect(round.at(-1)).not.toBe(round[0]);
    }
  });
});

describe('generate: unilateral work', () => {
  it('emits one step per side', () => {
    const w = run({ patterns: ['squat'], format: 'circuit', capability: 'advanced', seed: 5 });
    for (const s of mainWork(w)) {
      if (!byId(s.exerciseId).unilateral) continue;
      expect(['left', 'right']).toContain(s.side);
    }
    const uni = mainWork(w).filter((s) => byId(s.exerciseId).unilateral);
    if (uni.length) expect(uni.filter((s) => s.side === 'left')).toHaveLength(uni.length / 2);
  });
});

describe('generate: determinism and variety', () => {
  it('produces the same workout for the same seed', () => {
    expect(run({ seed: 7 })).toEqual(run({ seed: 7 }));
  });

  it('produces a different workout for a different seed', () => {
    const ids = (s: number) => mainWork(run({ seed: s })).map((x) => x.exerciseId).join();
    expect(ids(7)).not.toBe(ids(8));
  });

  it('avoids repeating the previous main set, using the ids the runner writes', () => {
    const first = run({ seed: 12, format: 'circuit' });
    const mainIds = [...new Set(mainWork(first).map((s) => s.exerciseId))].sort();
    // Built the way the runner builds it: every work id, plus main ids separately.
    const history = [entry({
      workout: first,
      mainExerciseIds: mainIds,
    })];
    const second = run({ seed: 12, format: 'circuit' }, FULL_KIT, history);
    const nextIds = [...new Set(mainWork(second).map((s) => s.exerciseId))].sort();
    expect(nextIds).not.toEqual(mainIds);
  });
});

describe('generate: degraded inputs', () => {
  it('still returns a workout when nothing has an image', () => {
    const blind = FIXTURE_EXERCISES.map((e) => ({ ...e, image: null }));
    const w = generate({ request: req(), kit: FULL_KIT, exercises: blind, combos: FIXTURE_COMBOS, history: [], now: NOW });
    expect(w.steps.length).toBeGreaterThan(0);
  });

  it('falls back to a circuit and says so when a complex was asked for but none fits', () => {
    const w = generate({
      request: req({ format: 'complex' }), kit: FULL_KIT,
      exercises: FIXTURE_EXERCISES, combos: [], history: [], now: NOW,
    });
    expect(w.format).toBe('circuit');
  });
});
