import type { Combo, Exercise, KitProfile, Pattern, WorkoutRequest } from '@/lib/types';
import { capabilityRank } from '@/lib/types';
import { hasMatchedPair, uniqueWeights } from '@/lib/kit';

const kitSupports = (e: Exercise, kit: KitProfile): boolean => {
  if (e.needsBench && !kit.hasBench) return false;
  if (e.bells === 0) return true;
  if (uniqueWeights(kit).length === 0) return false;
  if (e.bells === 2 && !hasMatchedPair(kit)) return false;
  return true;
};

const isAncillary = (e: Exercise) => e.warmupSuitable || e.cooldownSuitable;

export const filterPool = (exercises: Exercise[], req: WorkoutRequest, kit: KitProfile): Exercise[] =>
  exercises.filter(
    (e) =>
      !isAncillary(e) &&
      capabilityRank(e.capability) <= capabilityRank(req.capability) &&
      kitSupports(e, kit) &&
      e.patterns.some((p) => req.patterns.includes(p)),
  );

export const filterCombos = (
  combos: Combo[], exercises: Exercise[], req: WorkoutRequest, kit: KitProfile,
): Combo[] =>
  combos.filter((c) => {
    if (capabilityRank(c.capability) > capabilityRank(req.capability)) return false;
    if (uniqueWeights(kit).length === 0) return false;
    if (c.bells === 2 && !hasMatchedPair(kit)) return false;
    const members = c.steps.map((s) => exercises.find((e) => e.id === s.exerciseId));
    if (members.some((m) => !m || !kitSupports(m, kit))) return false;
    return members.some((m) => m!.patterns.some((p) => req.patterns.includes(p)));
  });

export const warmupPool = (exercises: Exercise[], kit: KitProfile): Exercise[] =>
  exercises.filter((e) => e.warmupSuitable && kitSupports(e, kit));

export const cooldownPool = (exercises: Exercise[], kit: KitProfile): Exercise[] =>
  exercises.filter((e) => e.cooldownSuitable && kitSupports(e, kit));

/**
 * Which requested patterns this pool can actually train. The setup screen warns
 * from this, not from a guess based on how many patterns were ticked. Asking for
 * carries with a single bell is the case that matters.
 */
export const coverablePatterns = (pool: Exercise[], req: WorkoutRequest): Pattern[] =>
  req.patterns.filter((p) => pool.some((e) => e.patterns.includes(p)));
