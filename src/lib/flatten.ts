import type { Block, Effort, Exercise, Format, KitProfile, Step } from '@/lib/types';
import { resolveBell } from '@/lib/kit';
import { estimateWork, prescribe } from '@/lib/prescribe';

export interface PlannedItem {
  exercise: Exercise;
  bellKg: number | null;
  reps?: number;
  seconds?: number;
  side?: 'left' | 'right';
  restSeconds: number;
  estSeconds: number;
}

export interface BlockPlan {
  block: Block;
  rounds: number;
  betweenRoundsRest: number;
  items: PlannedItem[];
}

/**
 * Turns one exercise into the items that will actually be performed. A unilateral
 * exercise becomes two, one per side, so the app holds his place instead of asking
 * him to remember which arm he is on while breathing hard. It also means the
 * estimate is a plain sum over items, with no doubling applied anywhere else.
 *
 * `side` is for a chain that runs down one side before it changes. Supply it and
 * the exercise yields ONE item on that side, because the caller is walking the
 * sides itself; leave it out and a unilateral exercise expands in place as usual.
 * A bilateral exercise never carries a side label, whoever asks: a goblet squat
 * done during the left-hand pass is still just a goblet squat.
 */
export function planItems(
  exercise: Exercise, kit: KitProfile, format: Format, effort: Effort,
  bandOverride?: Exercise['loadBand'], side?: 'left' | 'right',
): PlannedItem[] {
  const bellKg = exercise.bells === 0 ? null : resolveBell(bandOverride ?? exercise.loadBand, kit);
  if (exercise.bells > 0 && bellKg === null) return [];

  const p = prescribe(exercise, format, effort, kit);
  const base = {
    exercise, bellKg, reps: p.reps, seconds: p.seconds,
    restSeconds: p.restSeconds, estSeconds: estimateWork(exercise, p),
  };

  if (side !== undefined) return [exercise.unilateral ? { ...base, side } : base];

  return exercise.unilateral
    ? [{ ...base, side: 'left' as const }, { ...base, side: 'right' as const }]
    : [base];
}

export function buildSteps(plans: BlockPlan[]): Step[] {
  const steps: Step[] = [];

  for (const plan of plans) {
    if (plan.items.length === 0) continue;

    for (let round = 1; round <= plan.rounds; round++) {
      plan.items.forEach((item, i) => {
        steps.push({
          kind: 'work',
          exerciseId: item.exercise.id,
          name: item.exercise.name,
          bellKg: item.bellKg,
          reps: item.reps,
          seconds: item.seconds,
          side: item.side,
          block: plan.block,
          round,
          totalRounds: plan.rounds,
          indexInRound: i + 1,
          itemsInRound: plan.items.length,
          estSeconds: item.estSeconds,
        });

        const lastOfRound = i === plan.items.length - 1;
        const lastRound = round === plan.rounds;
        // The final round never gets a between-rounds rest. Emitting one there is
        // what previously leaked a whole round rest across the block boundary and
        // broke every time estimate. The final item of the final round still gets
        // its own item rest, which is the breather between one block and the next;
        // the trailing trim below removes it when nothing follows.
        const rest = lastOfRound && !lastRound ? plan.betweenRoundsRest : item.restSeconds;
        if (rest > 0) {
          steps.push({ kind: 'rest', seconds: rest, nextName: '', block: plan.block, estSeconds: rest });
        }
      });
    }
  }

  while (steps.length && steps.at(-1)!.kind === 'rest') steps.pop();

  let nextName = '';
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.kind === 'work') nextName = s.name;
    else s.nextName = nextName;
  }

  return steps;
}
