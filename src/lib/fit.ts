import type { BlockPlan, PlannedItem } from '@/lib/flatten';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const MIN_ROUND_REST = 30;
export const MAX_ROUND_REST = 180;

/** Work plus the rests that sit between items. No rest after the last item. */
export const roundDuration = (items: PlannedItem[]): number =>
  items.reduce((a, i) => a + i.estSeconds, 0) +
  items.slice(0, -1).reduce((a, i) => a + i.restSeconds, 0);

/**
 * Exactly what buildSteps will emit for this plan. The generator's whole search
 * trusts this number, so the two must not drift; a test asserts they agree.
 */
export const blockSeconds = (plan: BlockPlan): number =>
  plan.items.length === 0
    ? 0
    : plan.rounds * roundDuration(plan.items) + (plan.rounds - 1) * plan.betweenRoundsRest;

export const deviation = (actual: number, target: number): number =>
  target <= 0 ? Infinity : Math.abs(actual - target) / target;

/**
 * Close the last few per cent on the between-rounds rest rather than on reps.
 * Changing reps changes the training stimulus; changing rest inside a sane band
 * does not. A single-round block has no knob, so it is returned untouched.
 */
export function trimToBudget(plan: BlockPlan, targetSeconds: number): BlockPlan {
  if (plan.items.length === 0 || plan.rounds < 2) return plan;
  const work = plan.rounds * roundDuration(plan.items);
  const gaps = plan.rounds - 1;
  const rest = clamp(Math.round((targetSeconds - work) / gaps / 5) * 5, MIN_ROUND_REST, MAX_ROUND_REST);
  return { ...plan, betweenRoundsRest: rest };
}
