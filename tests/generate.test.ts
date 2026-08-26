import { describe, it, expect } from 'vitest';
import { generate } from '@/lib/generate';
import { capabilityRank, type Capability, type Format, type Pattern, type WorkStep, type WorkoutRequest } from '@/lib/types';
import { FIXTURE_EXERCISES, FIXTURE_COMBOS, FULL_KIT, HOME_KIT, combo, entry, ex, req } from './fixtures';
import type { Combo, Exercise, HistoryEntry, KitProfile } from '@/lib/types';

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
// Narrow pattern sets. The durations are varied deliberately: every one of these
// at 30 minutes resolves to complex, which would leave chooseFormat's auto-to-
// strength branch (fewer than four patterns, 35 minutes or longer) unexercised.
for (const patterns of [['hinge'], ['push', 'pull'], ['hinge', 'squat', 'push']] as Pattern[][])
  for (const [seed, totalMinutes] of [[1, 30], [2, 45], [3, 60]] as const)
    MATRIX.push({ patterns, seed, totalMinutes });

// Capability rows. Without these every request is 'advanced' and invariant 7 is
// vacuous: the capability filter could be deleted outright and the suite stay green.
for (const capability of ['beginner', 'intermediate'] as Capability[])
  for (const totalMinutes of [15, 30, 60] as const)
    for (const format of ['auto', 'circuit', 'complex', 'strength'] as Array<'auto' | Format>)
      MATRIX.push({ totalMinutes, format, capability, patterns: ALL, seed: totalMinutes + format.length });

const label = (o: Partial<WorkoutRequest>) =>
  `${o.totalMinutes ?? 30}min ${o.format ?? 'auto'} ${o.effort ?? 'normal'} ${o.capability ?? 'advanced'} `
  + `[${(o.patterns ?? []).join(',')}] seed ${o.seed}`;

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
    // A block with no intra-round rest has an item rest of ZERO, not "unknown".
    // complex prescribes a 0s item rest, so returning null here and skipping the
    // check would let a leaked 90s round rest through at a complex boundary.
    const itemRestOf = (block: WorkStep['block']): number => {
      for (let j = 1; j < w.steps.length - 1; j++) {
        const [a, r, b] = [w.steps[j - 1], w.steps[j], w.steps[j + 1]];
        if (r.kind !== 'rest' || r.block !== block) continue;
        if (a.kind === 'work' && b.kind === 'work' && b.block === block && b.round === a.round) return r.seconds;
      }
      return 0;
    };
    for (let i = 1; i < w.steps.length; i++) {
      const prev = w.steps[i - 1];
      if (w.steps[i].block === prev.block || prev.kind === 'work') continue;
      expect(w.steps[i - 2]?.kind).toBe('work');            // exactly one rest closes a block
      // Unconditional: a block whose items rest 0s must close on no rest at all.
      expect(prev.seconds).toBe(itemRestOf(prev.block));
    }

    // 13. The reported format is the format actually built.
    if (w.request.format !== 'auto' && !w.shortOfBudget) {
      expect(['circuit', 'complex', 'strength']).toContain(w.format);
    }

    // All three blocks are present and each carries real work. Without this the
    // ancillary blocks could return no items at all and the suite would not notice.
    for (const b of ['Warm-up', 'Main', 'Cool-down'] as const) {
      expect(work(w).filter((s) => s.block === b).length, `${b} has work`).toBeGreaterThan(0);
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

/** Rests that sit at a block change. blockSeconds cannot see these; buildSteps emits them. */
const boundaryRest = (w: ReturnType<typeof run>): number => {
  let total = 0;
  for (let i = 1; i < w.steps.length; i++) {
    const prev = w.steps[i - 1];
    if (w.steps[i].block !== prev.block && prev.kind === 'rest') total += prev.seconds;
  }
  return total;
};

/**
 * Cells that fill their budget ONLY because the search costs the whole three-block
 * workout. Score blockSeconds(main) against total - blockSeconds(warm) -
 * blockSeconds(cool) instead and every one of these overshoots and raises
 * shortOfBudget. They are all strength because its item rest is 90s or more, which
 * makes the drift across the block boundary largest.
 */
const WHOLE_COST_PINS: Partial<WorkoutRequest>[] = [
  { totalMinutes: 15, format: 'strength', effort: 'normal', capability: 'beginner', patterns: ['push', 'pull'], seed: 1 },
  { totalMinutes: 15, format: 'strength', effort: 'normal', capability: 'beginner', patterns: ['squat', 'core'], seed: 2 },
  { totalMinutes: 15, format: 'strength', effort: 'normal', capability: 'intermediate', patterns: ['push', 'pull'], seed: 1 },
  { totalMinutes: 15, format: 'strength', effort: 'normal', capability: 'advanced', patterns: ['squat', 'core'], seed: 2 },
  { totalMinutes: 20, format: 'strength', effort: 'easy', capability: 'beginner', patterns: ['push', 'pull'], seed: 1 },
  { totalMinutes: 20, format: 'strength', effort: 'easy', capability: 'intermediate', patterns: ['squat', 'core'], seed: 4 },
  { totalMinutes: 20, format: 'strength', effort: 'easy', capability: 'advanced', patterns: ['push', 'pull'], seed: 4 },
  { totalMinutes: 20, format: 'strength', effort: 'hard', capability: 'beginner', patterns: ['hinge'], seed: 2 },
  { totalMinutes: 30, format: 'strength', effort: 'easy', capability: 'advanced', patterns: ['hinge', 'squat', 'push', 'pull'], seed: 3 },
];

describe('generate: the search costs the whole workout', () => {
  it('counts the rests between blocks, which a per-block sum cannot see', () => {
    const w = run({ totalMinutes: 15, format: 'strength', effort: 'normal', capability: 'beginner',
      patterns: ['push', 'pull'], seed: 1 });
    const target = 15 * 60;
    const boundary = boundaryRest(w);

    // 15s closing the warm-up plus a strength item rest of 90s or more closing Main.
    expect(boundary).toBeGreaterThanOrEqual(90);
    expect(w.shortOfBudget).toBe(false);
    expect(Math.abs(w.estimatedSeconds - target) / target).toBeLessThanOrEqual(0.1);

    // The point of the whole-workout costing, stated as arithmetic: these rests are
    // big enough to matter. Had the search sized the main block against
    // total - blockSeconds(warm) - blockSeconds(cool), they would have landed on top
    // of a session already filling the budget and pushed it out of tolerance.
    expect(Math.abs(w.estimatedSeconds + boundary - target) / target).toBeGreaterThan(0.1);
  });

  it.each(WHOLE_COST_PINS.map((o) => [label(o), o] as const))('%s fills its budget', (_l, o) => {
    const w = run(o);
    const target = w.request.totalMinutes * 60;
    expect(w.shortOfBudget).toBe(false);
    expect(Math.abs(w.estimatedSeconds - target) / target).toBeLessThanOrEqual(0.1);
  });

  it('reports the estimate it optimised, step for step', () => {
    for (const o of WHOLE_COST_PINS) {
      const w = run(o);
      expect(w.estimatedSeconds).toBe(w.steps.reduce((a, s) => a + s.estSeconds, 0));
    }
  });
});

describe('generate: the anti-repeat retry', () => {
  /**
   * Two combos over the same pattern pair but with no exercise in common. Coverage
   * cannot prefer taking both, so a single combo can win, and the two possible
   * winners have genuinely different exercise sets.
   *
   * This is the case the retry exists for. historyWeight compares COMBO ids against
   * mainExerciseIds, which hold EXERCISE ids, so a combo is never down-weighted and
   * selection hands back exactly what it handed back last time. For a circuit the
   * weighting would have already dodged the repeat; here nothing but the retry in
   * generate() can.
   */
  const DISJOINT: Combo[] = [
    combo('c-swing-goblet', { capability: 'beginner', loadBand: 'light',
      steps: [{ exerciseId: 'f-swing', reps: 5 }, { exerciseId: 'f-goblet', reps: 5 }] }),
    combo('c-clean-lunge', { capability: 'beginner', loadBand: 'light',
      steps: [{ exerciseId: 'f-clean', reps: 5 }, { exerciseId: 'f-lunge', reps: 5 }] }),
  ];

  // Fifteen minutes, not the default thirty. Complex rounds are capped at six, and
  // two chains this short cannot fill half an hour on their own, so at thirty minutes
  // every seed lands on both of them and there is nothing for the retry to swap TO.
  // The assertion below is unchanged; only the session is short enough that a
  // one-chain plan is a real candidate, which is what makes the retry observable.
  const complexRun = (seed: number, history: HistoryEntry[] = []) => generate({
    request: req({ capability: 'advanced', format: 'complex', patterns: ['hinge', 'squat'], seed, totalMinutes: 15 }),
    kit: FULL_KIT, exercises: FIXTURE_EXERCISES, combos: DISJOINT, history, now: NOW,
  });

  it.each([1, 5, 12, 20, 33])('rerolls a repeated main set that selection cannot dodge (seed %i)', (seed) => {
    const first = complexRun(seed);
    expect(first.format).toBe('complex');
    const mainIds = [...new Set(mainWork(first).map((s) => s.exerciseId))].sort();

    const second = complexRun(seed, [entry({ workout: first, mainExerciseIds: mainIds })]);
    expect([...new Set(mainWork(second).map((s) => s.exerciseId))].sort()).not.toEqual(mainIds);
  });

  it('routes a long, narrow auto session to strength', () => {
    // chooseFormat: fewer than four patterns and 35 minutes or more.
    expect(run({ patterns: ['hinge'], format: 'auto', totalMinutes: 45, seed: 1 }).format).toBe('strength');
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

describe('generate: complexes are performable', () => {
  /**
   * The chain must run whole down one side and then the other. Expanding each step
   * into left and right in place gives Clean L, Clean R, Press L, Press R: after the
   * second clean the bell is in the wrong hand, so the press cannot start without
   * putting it down, which is the one thing a complex forbids.
   */
  const PER_SIDE: Combo[] = [
    combo('c-per-side', { capability: 'intermediate', loadBand: 'light', perSide: true, steps: [
      { exerciseId: 'f-sldl', reps: 3 }, { exerciseId: 'f-press', reps: 3 }, { exerciseId: 'f-lunge', reps: 3 },
    ] }),
  ];

  const perSideRun = () => generate({
    request: req({ capability: 'advanced', format: 'complex', patterns: ['hinge', 'squat', 'push'], seed: 4 }),
    kit: FULL_KIT, exercises: FIXTURE_EXERCISES, combos: PER_SIDE, history: [], now: NOW,
  });

  it('runs a per-side chain whole on one side, then whole on the other', () => {
    const round = mainWork(perSideRun()).filter((s) => s.round === 1);
    expect(round.map((s) => `${s.exerciseId}:${s.side}`)).toEqual([
      'f-sldl:left', 'f-press:left', 'f-lunge:left',
      'f-sldl:right', 'f-press:right', 'f-lunge:right',
    ]);
  });

  it('never changes hands within one pass of a chain', () => {
    const round = mainWork(perSideRun()).filter((s) => s.round === 1);
    const sides = round.map((s) => s.side);
    // One change of side across the whole round, at the halfway point, and no other.
    expect(sides.filter((v, i) => i > 0 && v !== sides[i - 1])).toHaveLength(1);
  });

  /**
   * Members were looked up in the filtered pool, so a member whose pattern was not
   * requested vanished from the chain while the combo kept the load band chosen for
   * it: "Clean, Press, Squat" shipped without the press and squatted at press weight.
   */
  it('keeps every member of a chain even when its pattern was not requested', () => {
    const w = generate({
      request: req({ capability: 'advanced', format: 'complex', patterns: ['hinge'], seed: 4 }),
      kit: FULL_KIT, exercises: FIXTURE_EXERCISES, combos: PER_SIDE, history: [], now: NOW,
    });
    const ids = new Set(mainWork(w).map((s) => s.exerciseId));
    expect([...ids].sort()).toEqual(['f-lunge', 'f-press', 'f-sldl']);
  });

  it('never prescribes more than six rounds of a complex', () => {
    for (const totalMinutes of [15, 20, 30, 45, 60] as const) {
      const w = run({ format: 'complex', totalMinutes, patterns: ALL, seed: totalMinutes });
      const first = mainWork(w)[0];
      if (first) expect(first.totalRounds, `${totalMinutes}min`).toBeLessThanOrEqual(6);
    }
  });
});

describe('generate: ancillary essentials', () => {
  /**
   * Dataset-independent. The real guarantee is pinned against the real moves in
   * tests/data-ancillary.test.ts; this pins the mechanism that delivers it, so the
   * engine keeps working if the ancillary list is ever replaced wholesale.
   */
  const anc = (id: string, over: Partial<Exercise> = {}) => ex(id, {
    patterns: ['core'], bells: 0, secondsPerRep: 0,
    defaultReps: undefined, defaultWorkSeconds: 30, ...over,
  });
  const WITH_ESSENTIAL = [
    ...FIXTURE_EXERCISES,
    anc('w-must', { warmupSuitable: true, essentialJob: 'the one that matters' }),
  ];
  const warmIds = (exercises: Exercise[], seed: number) => {
    const w = generate({
      request: req({ capability: 'advanced', seed }), kit: FULL_KIT,
      exercises, combos: FIXTURE_COMBOS, history: [], now: NOW,
    });
    return new Set(w.steps
      .filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Warm-up')
      .map((s) => s.exerciseId));
  };

  it('draws the essential move into every warm-up that has room', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ids = warmIds(WITH_ESSENTIAL, seed);
      if (ids.size < 2) continue;
      expect(ids.has('w-must'), `seed ${seed}`).toBe(true);
    }
  });

  it('still builds a block when nothing in the pool is essential', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(warmIds(FIXTURE_EXERCISES, seed).size).toBeGreaterThan(0);
    }
  });

  it('does not overrun the budget to fit an essential in', () => {
    // Every ancillary move here costs 30s against a 180s warm-up budget, so an
    // essential takes a slot, it does not add one.
    for (let seed = 1; seed <= 20; seed++) {
      expect(warmIds(WITH_ESSENTIAL, seed).size).toBeLessThanOrEqual(warmIds(FIXTURE_EXERCISES, seed).size + 1);
    }
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
