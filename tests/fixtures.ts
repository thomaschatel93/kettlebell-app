import type {
  Capability, Combo, Exercise, HistoryEntry, KitProfile, Pattern, Workout, WorkoutRequest,
} from '@/lib/types';

export const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  patterns: ['hinge'],
  capability: 'beginner',
  mechanic: 'grind',
  unilateral: false,
  bells: 1,
  loadBand: 'moderate',
  secondsPerRep: 4,
  defaultReps: 8,
  needsBench: false,
  warmupSuitable: false,
  cooldownSuitable: false,
  image: null,
  imagePanels: 1,
  cues: { setup: ['setup'], execution: ['execute'], mistakes: ['mistake'] },
  ...over,
});

export const combo = (id: string, over: Partial<Combo> = {}): Combo => ({
  id, name: id, capability: 'intermediate', bells: 1, perSide: true, loadBand: 'light',
  steps: [{ exerciseId: 'f-clean', reps: 3 }, { exerciseId: 'f-press', reps: 3 }],
  ...over,
});

export const kit = (over: Partial<KitProfile> = {}): KitProfile => ({
  id: 'home', name: 'Home', bells: [{ weightKg: 16, count: 1 }], hasBench: false, ...over,
});

export const req = (over: Partial<WorkoutRequest> = {}): WorkoutRequest => ({
  kitProfileId: 'home', patterns: ['hinge', 'squat', 'push'], capability: 'intermediate',
  effort: 'normal', totalMinutes: 30, format: 'auto', seed: 1, ...over,
});

/**
 * `workout` carries a `steps` array even when the test does not care what is in
 * it. `loadHistory` drops any entry whose workout has no steps array - the
 * guard that stops a half-written workout crashing the screen that renders it -
 * so an entry built without one is written, silently discarded on the way back
 * out, and every assertion about it fails for a reason nothing on screen shows.
 */
export const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'h1', createdAt: '2026-08-25T09:00:00.000Z',
  workout: { steps: [] } as unknown as Workout, mainExerciseIds: [], workedSeconds: 1500, ...over,
});

export const FULL_KIT: KitProfile = {
  id: 'gym', name: 'Gym', hasBench: true,
  bells: [{ weightKg: 16, count: 2 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 }],
};

export const HOME_KIT: KitProfile = {
  id: 'home', name: 'Home', hasBench: false, bells: [{ weightKg: 16, count: 1 }],
};

/**
 * A synthetic database wide enough to exercise every engine path: at least three
 * candidates per pattern so selection has real choices, both mechanics, both
 * capabilities, a bench move, a doubles move, and ancillary moves.
 */
const main = (id: string, p: Pattern, over: Partial<Exercise> = {}) =>
  ex(id, { patterns: [p], ...over });

export const FIXTURE_EXERCISES: Exercise[] = [
  main('f-swing', 'hinge', { mechanic: 'ballistic', loadBand: 'heavy', secondsPerRep: 2, defaultReps: 15 }),
  main('f-deadlift', 'hinge'),
  main('f-sldl', 'hinge', { unilateral: true }),
  main('f-goblet', 'squat'),
  main('f-lunge', 'squat', { unilateral: true }),
  main('f-split-squat', 'squat', { needsBench: true }),
  main('f-press', 'push', { loadBand: 'light', unilateral: true }),
  main('f-floor-press', 'push', { loadBand: 'light' }),
  main('f-push-press', 'push', { capability: 'intermediate' }),
  main('f-row', 'pull'),
  main('f-renegade', 'pull', { capability: 'advanced', bells: 2 }),
  main('f-high-pull', 'pull', { mechanic: 'ballistic', secondsPerRep: 2 }),
  main('f-farmers', 'carry', { mechanic: 'carry', bells: 2, defaultReps: undefined, defaultWorkSeconds: 40, secondsPerRep: 0 }),
  main('f-suitcase', 'carry', { mechanic: 'carry', defaultReps: undefined, defaultWorkSeconds: 40, secondsPerRep: 0, unilateral: true }),
  main('f-racked-carry', 'carry', { mechanic: 'carry', defaultReps: undefined, defaultWorkSeconds: 40, secondsPerRep: 0 }),
  main('f-twist', 'core'),
  main('f-halo', 'core', { loadBand: 'light' }),
  main('f-windmill', 'core', { capability: 'advanced', unilateral: true }),
  main('f-clean', 'hinge', { mechanic: 'ballistic', secondsPerRep: 2, capability: 'intermediate' }),
  ...Array.from({ length: 6 }, (_, i) =>
    ex(`f-warm-${i}`, {
      patterns: ['core'], bells: 0, warmupSuitable: true,
      defaultReps: undefined, defaultWorkSeconds: 30, secondsPerRep: 0,
    })),
  ...Array.from({ length: 6 }, (_, i) =>
    ex(`f-cool-${i}`, {
      patterns: ['core'], bells: 0, cooldownSuitable: true,
      defaultReps: undefined, defaultWorkSeconds: 30, secondsPerRep: 0,
    })),
];

export const FIXTURE_COMBOS: Combo[] = [
  combo('f-combo-a'),
  combo('f-combo-b', { steps: [
    { exerciseId: 'f-clean', reps: 3 }, { exerciseId: 'f-press', reps: 3 }, { exerciseId: 'f-goblet', reps: 3 },
  ] }),
];

export const CAPABILITIES_TO_TEST: Capability[] = ['beginner', 'intermediate', 'advanced'];
