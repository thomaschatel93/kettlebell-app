import type { Effort, Exercise, Format, KitProfile } from '@/lib/types';
import { isUnderSpecified } from '@/lib/kit';

export interface Prescription { reps?: number; seconds?: number; restSeconds: number }

/** The single copy. Every path uses these; nothing redefines them locally. */
export const REP_FACTOR: Record<Effort, number> = { easy: 0.7, normal: 1, hard: 1.2 };
export const REST_FACTOR: Record<Effort, number> = { easy: 1.5, normal: 1, hard: 0.8 };

const BASE_ITEM_REST: Record<Format, number> = { circuit: 30, complex: 0, strength: 90 };
const BASE_ROUND_REST: Record<Format, number> = { circuit: 75, complex: 90, strength: 90 };

/**
 * A kit with fewer than three distinct weights cannot separate light from heavy,
 * so a press gets prescribed at swing weight. Cut the reps on the bands that were
 * meant to be lighter. The Preview screen says so in words as well.
 */
const UNDER_SPECIFIED_PENALTY = 0.6;

const toFive = (n: number) => Math.round(n / 5) * 5;

export function prescribe(
  exercise: Exercise, format: Format, effort: Effort, kit: KitProfile,
): Prescription {
  const restSeconds = toFive(BASE_ITEM_REST[format] * REST_FACTOR[effort]);
  const penalty =
    isUnderSpecified(kit) && exercise.bells > 0 && exercise.loadBand !== 'heavy'
      ? UNDER_SPECIFIED_PENALTY
      : 1;
  const factor = REP_FACTOR[effort] * penalty;

  if (exercise.defaultReps === undefined && exercise.defaultWorkSeconds !== undefined) {
    return { seconds: Math.max(15, toFive(exercise.defaultWorkSeconds * factor)), restSeconds };
  }

  const base = format === 'strength' ? 5 : (exercise.defaultReps ?? 8);
  return { reps: Math.max(3, Math.round(base * factor)), restSeconds };
}

/**
 * The per-step estimate. Unilateral exercises are expanded into two steps by the
 * planner, so there is deliberately no doubling here; doing both would count the
 * second side twice.
 */
export const estimateWork = (exercise: Exercise, p: Prescription): number =>
  p.seconds ?? (p.reps ?? 0) * exercise.secondsPerRep;

export const betweenRoundsRest = (format: Format, effort: Effort): number =>
  toFive(BASE_ROUND_REST[format] * REST_FACTOR[effort]);
