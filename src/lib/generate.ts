import type {
  Combo, Exercise, Format, HistoryEntry, KitProfile, Pattern, Workout, WorkoutRequest,
} from '@/lib/types';
import { createRng, shuffle } from '@/lib/rng';
import { isUnderSpecified } from '@/lib/kit';
import { cooldownPool, filterCombos, filterPool, warmupPool } from '@/lib/pool';
import { budget } from '@/lib/budget';
import { chooseFormat } from '@/lib/format';
import { selectCircuit, selectCombos, selectStrength } from '@/lib/select';
import { betweenRoundsRest, prescribe, estimateWork } from '@/lib/prescribe';
import { blockSeconds, deviation, roundDuration, trimToBudget } from '@/lib/fit';
import { buildSteps, planItems, type BlockPlan, type PlannedItem } from '@/lib/flatten';

export interface GenerateInput {
  request: WorkoutRequest;
  kit: KitProfile;
  exercises: Exercise[];
  combos: Combo[];
  history: HistoryEntry[];
  now: string;
}

const TOLERANCE = 0.1;
const ANCILLARY_CAP = 8;

/**
 * How much worse than the best fit a candidate may be and still count as an equal.
 * Two points of a thirty-minute session is about thirty seconds: real arithmetic,
 * but nothing a person performing the workout can feel.
 */
const CANDIDATE_SLACK = 0.02;

/** The stream the tie-break draws from; any fixed value distinct from a count. */
const TIE_STREAM = 9973;

/** Independent selections tried per item count. See the loop for why one is not enough. */
const SELECTION_ATTEMPTS = 4;

/**
 * Distinct streams per (seed, count). Plain `seed + count` aliases: the stream for
 * (s, c) is the stream for (s + 1, c - 1), which correlates candidates across the
 * search and, worse, across seeds.
 */
const streamSeed = (seed: number, count: number): number => (Math.imul(seed, 0x9e3779b1) + count) | 0;

const SEARCH: Record<Format, { counts: number[]; rounds: number[] }> = {
  circuit:  { counts: [3, 4, 5, 6, 7, 8], rounds: range(1, 12) },
  strength: { counts: [3, 4, 5],       rounds: range(2, 6) },
  // A complex is capped at six rounds, and may chain up to three complexes per round
  // instead. The search will happily stack twelve rounds of one short chain to fill a
  // long budget, and ten rounds of cleans and presses is not a prescription any coach
  // would write. Length now comes from the item count first and the rounds second,
  // which is the way round a coach would write it; where neither reaches the budget,
  // `shortOfBudget` says so honestly.
  complex:  { counts: [1, 2, 3],       rounds: range(1, 6) },
};

function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

const coveredCount = (items: Exercise[], patterns: Pattern[]): number =>
  patterns.filter((p) => items.some((e) => e.patterns.includes(p))).length;

/**
 * Fill an ancillary block from its pool, stopping at whichever item count sits
 * closest to the nominal budget. It does not have to hit that budget: the caller
 * measures what it actually cost and hands the remainder to the main block, so a
 * short warm-up pool lengthens the main work rather than shortening the session.
 */
function buildAncillary(
  pool: Exercise[], kit: KitProfile, block: 'Warm-up' | 'Cool-down',
  budgetSeconds: number, restSeconds: number, effort: WorkoutRequest['effort'], seed: number,
): BlockPlan {
  const items: PlannedItem[] = [];
  let used = 0;

  for (const e of shuffle(createRng(seed), pool)) {
    if (items.length >= ANCILLARY_CAP) break;
    const p = prescribe(e, 'circuit', effort, kit);
    const work = estimateWork(e, p) * (e.unilateral ? 2 : 1);
    const projected = items.length === 0 ? work : used + restSeconds + work;
    if (items.length > 0 && Math.abs(projected - budgetSeconds) >= Math.abs(used - budgetSeconds)) break;

    const planned = planItems(e, kit, 'circuit', effort, 'light');
    if (planned.length === 0) continue;
    items.push(...planned.map((i) => ({ ...i, restSeconds })));
    used = projected;
  }

  return { block, rounds: 1, betweenRoundsRest: 0, items };
}

interface Candidate { plan: BlockPlan; coverage: number; dev: number }

/**
 * Coverage first, then time — but only to the precision a person can feel. Once two
 * candidates cover the same patterns and both land within a couple of points of the
 * best fit, they are equally good workouts and the seed picks between them. Ranking
 * on the last fraction of a per cent would hand every seed the same session, which
 * is what made a reroll a no-op. The cap never admits a candidate that misses the
 * budget while the optimum makes it, so the variety never costs a correct estimate.
 */
function chooseCandidate(candidates: Candidate[], seed: number): Candidate {
  const bestCoverage = Math.max(...candidates.map((c) => c.coverage));
  const covered = candidates.filter((c) => c.coverage === bestCoverage);
  const bestDev = Math.min(...covered.map((c) => c.dev));
  // Aim inside the tolerance, not at its edge. Admitting a candidate that sits
  // exactly on TOLERANCE leaves no margin at all, so the ceiling is nine tenths of it.
  const cap = Math.min(bestDev + CANDIDATE_SLACK, Math.max(bestDev, TOLERANCE * 0.9));
  const finalists = covered.filter((c) => c.dev <= cap);
  return finalists[Math.floor(createRng(streamSeed(seed, TIE_STREAM))() * finalists.length)];
}

/**
 * The true cost of a whole workout: what buildSteps will actually emit, summed.
 * Never sum blockSeconds across blocks — that misses the boundary rests and always
 * reads short.
 */
const wholeWorkoutSeconds = (plans: BlockPlan[]): number =>
  buildSteps(plans).reduce((a, s) => a + s.estSeconds, 0);

function buildMain(
  format: Format, pool: Exercise[], all: Exercise[], combos: Combo[], req: WorkoutRequest,
  kit: KitProfile, history: HistoryEntry[], target: number, seed: number,
  cost: (plan: BlockPlan) => number,
): { plan: BlockPlan; format: Format } {
  const search = SEARCH[format];
  const between = betweenRoundsRest(format, req.effort);
  const candidates: Candidate[] = [];

  for (const count of search.counts) {
    // Several draws per count, not one. How long a round runs depends on WHICH
    // exercises come back, not just how many: six bilateral moves are six items,
    // but six moves of which four are unilateral are ten, and that difference is
    // larger than the gap between one round and two. Sampling a single selection
    // per count left whole budgets unreachable while still covering every pattern.
    for (let attempt = 0; attempt < SELECTION_ATTEMPTS; attempt++) {
      const rng = createRng(streamSeed(seed, count * SELECTION_ATTEMPTS + attempt));
      let exercises: Exercise[];
      let items: PlannedItem[];

      if (format === 'complex') {
        const chosen = selectCombos(combos, rng, history, count);
        if (chosen.length === 0) continue;
        // Members are looked up in the WHOLE database, never in `pool`. `pool` is
        // filtered by the requested patterns, so looking up there dropped any member
        // whose pattern was not ticked: asking for hinge and squat shipped "Clean,
        // Press, Squat" without the press, while keeping the light load band that was
        // chosen FOR that press. A chain is fixed; it is not served in part.
        // `filterCombos` has already checked every member against the kit and the
        // capability, which is the gate that belongs here.
        exercises = chosen.flatMap((c) =>
          c.steps.map((s) => all.find((e) => e.id === s.exerciseId)).filter((e): e is Exercise => !!e));
        items = chosen.flatMap((c) => {
          // A per-side chain runs whole, one side at a time. Expanding each step into
          // left and right in place would emit Clean L, Clean R, Press L, ... which
          // asks him to put the bell down and swap hands mid-chain: the one thing a
          // complex forbids. Same work, same total, different order.
          const passes: Array<'left' | 'right' | undefined> = c.perSide ? ['left', 'right'] : [undefined];
          return passes.flatMap((side) =>
            c.steps.flatMap((s) => {
              const e = all.find((x) => x.id === s.exerciseId);
              if (!e) return [];
              return planItems({ ...e, defaultReps: s.reps }, kit, 'complex', req.effort, c.loadBand, side);
            }));
        });
      } else {
        exercises = format === 'strength'
          ? selectStrength(pool, rng, history, count)
          : selectCircuit(pool, req, rng, history, count);
        items = exercises.flatMap((e) => planItems(e, kit, format, req.effort));
      }

      if (items.length === 0) continue;
      const rd = roundDuration(items);
      const coverage = coveredCount(exercises, req.patterns);

      for (const rounds of search.rounds) {
        const plan: BlockPlan = { block: 'Main', rounds, betweenRoundsRest: between, items };
        // Cost the WHOLE workout, not this block in isolation.
        const offer = (p: BlockPlan) => candidates.push({ plan: p, coverage, dev: deviation(cost(p), target) });
        offer(plan);

        // The between-rounds rest is a real knob, so the search ranks the trimmed plan
        // alongside the nominal one rather than trimming only the winner afterwards.
        // Same principle as costing the whole workout: rank what will actually be
        // delivered. trimToBudget solves for the main block, so hand it the main-block
        // target — the whole-workout target less what the ancillary blocks cost.
        const trimmed = trimToBudget(plan, target - (cost(plan) - blockSeconds(plan)));
        if (trimmed.betweenRoundsRest !== plan.betweenRoundsRest) offer(trimmed);

        if (rd * rounds > target * 1.5) break;   // no point searching further out
      }
    }
  }

  if (candidates.length === 0) {
    return format === 'circuit'
      ? { plan: { block: 'Main', rounds: 1, betweenRoundsRest: between, items: [] }, format }
      : buildMain('circuit', pool, all, combos, req, kit, history, target, seed, cost);
  }

  // The trimmed variants were ranked alongside the nominal ones, so the winner is
  // already the plan that will be delivered. Nothing to adjust after the fact.
  return { plan: chooseCandidate(candidates, seed).plan, format };
}

const mainIdsOf = (plan: BlockPlan) => [...new Set(plan.items.map((i) => i.exercise.id))].sort();

export function generate(input: GenerateInput): Workout {
  const { request, kit, exercises, combos, history, now } = input;
  const total = request.totalMinutes * 60;
  const nominal = budget(request.totalMinutes);

  // Ancillary blocks first, so the main block can be given the true remainder.
  const warm = buildAncillary(
    warmupPool(exercises, kit), kit, 'Warm-up', nominal.warmupSeconds, 15, request.effort, request.seed + 101);
  const cool = buildAncillary(
    cooldownPool(exercises, kit), kit, 'Cool-down', nominal.cooldownSeconds, 10, request.effort, request.seed + 202);

  const pool = filterPool(exercises, request, kit);
  const usableCombos = filterCombos(combos, exercises, request, kit);
  const wanted = chooseFormat(request, usableCombos.length > 0);

  // Every candidate is costed as the whole workout it would produce.
  const cost = (plan: BlockPlan) => wholeWorkoutSeconds([warm, plan, cool]);

  let seed = request.seed;
  let built = buildMain(wanted, pool, exercises, usableCombos, request, kit, history, total, seed, cost);

  const previous = history[0] ? [...history[0].mainExerciseIds].sort() : null;
  for (let i = 0; i < 5 && previous && mainIdsOf(built.plan).join() === previous.join(); i++) {
    seed += 1;
    built = buildMain(wanted, pool, exercises, usableCombos, request, kit, history, total, seed, cost);
  }

  const steps = buildSteps([warm, built.plan, cool]);
  const estimatedSeconds = steps.reduce((a, s) => a + s.estSeconds, 0);

  return {
    id: `w-${seed}-${now}`,
    createdAt: now,
    request: { ...request, seed },
    format: built.format,
    steps,
    estimatedSeconds,
    loadWarning: isUnderSpecified(kit),
    shortOfBudget: deviation(estimatedSeconds, total) > TOLERANCE,
  };
}
