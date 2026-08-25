import type { Capability, KitProfile, LoadBand } from '@/lib/types';

export interface KitState {
  v: 1;
  profiles: KitProfile[];
  activeId: 'home' | 'gym';
  capability: Capability;
}

export const uniqueWeights = (kit: KitProfile): number[] =>
  [...new Set(kit.bells.filter((b) => b.count > 0).map((b) => b.weightKg))].sort((a, b) => a - b);

export function resolveBell(band: LoadBand, kit: KitProfile): number | null {
  const w = uniqueWeights(kit);
  if (w.length === 0) return null;
  if (band === 'light') return w[0];
  if (band === 'heavy') return w[w.length - 1];
  return w[Math.floor((w.length - 1) / 2)];
}

export const hasMatchedPair = (kit: KitProfile): boolean => kit.bells.some((b) => b.count >= 2);

/**
 * Fewer than three distinct weights means light, moderate and heavy collapse onto
 * the same bell, and an overhead press gets prescribed at swing weight. Callers
 * must warn rather than pretend the mapping worked.
 */
export const isUnderSpecified = (kit: KitProfile): boolean => uniqueWeights(kit).length < 3;

/** Exactly two profiles, fixed. Not addable, deletable or renameable. */
export const DEFAULT_KIT_STATE: KitState = {
  v: 1,
  profiles: [
    { id: 'home', name: 'Home', bells: [], hasBench: false },
    { id: 'gym', name: 'Gym', bells: [], hasBench: true },
  ],
  activeId: 'home',
  capability: 'beginner',
};
