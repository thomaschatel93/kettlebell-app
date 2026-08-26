export const PATTERNS = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'] as const;
export const CAPABILITIES = ['beginner', 'intermediate', 'advanced'] as const;
export const EFFORTS = ['easy', 'normal', 'hard'] as const;

export type Pattern    = (typeof PATTERNS)[number];
export type Capability = (typeof CAPABILITIES)[number];
export type Effort     = (typeof EFFORTS)[number];

export const capabilityRank = (c: Capability): number => CAPABILITIES.indexOf(c);

export type Mechanic = 'ballistic' | 'grind' | 'carry';
export type LoadBand = 'light' | 'moderate' | 'heavy';
export type Block    = 'Warm-up' | 'Main' | 'Cool-down';
export type Format   = 'circuit' | 'complex' | 'strength';

export interface Exercise {
  id: string;
  name: string;
  patterns: Pattern[];          // primary first
  capability: Capability;
  mechanic: Mechanic;
  unilateral: boolean;
  bells: 0 | 1 | 2;
  loadBand: LoadBand;
  secondsPerRep: number;
  defaultReps?: number;
  defaultWorkSeconds?: number;
  needsBench: boolean;
  warmupSuitable: boolean;
  cooldownSuitable: boolean;
  image: string | null;
  imagePanels: 1 | 2 | 3;
  /**
   * For ancillary moves only: the job this move is an answer to, e.g. 'pulse raiser'.
   * The warm-up and cool-down blocks draw one move per distinct job before they fill
   * whatever budget is left at random, so a job with a move flagged for it is
   * guaranteed a place rather than left to the shuffle. Set from the named lists in
   * `data/ancillary.ts`; the engine never needs to know which jobs exist.
   */
  essentialJob?: string;
  videoUrl?: string;            // phase 2 populates this from Reels
  cues: { setup: string[]; execution: string[]; mistakes: string[] };
}

export interface Combo {
  id: string;
  name: string;
  capability: Capability;
  bells: 1 | 2;
  perSide: boolean;
  loadBand: LoadBand;
  steps: { exerciseId: string; reps: number }[];
}

export interface KitProfile {
  id: 'home' | 'gym';
  name: string;
  bells: { weightKg: number; count: number }[];
  hasBench: boolean;
}

export interface WorkoutRequest {
  kitProfileId: 'home' | 'gym';
  patterns: Pattern[];
  capability: Capability;       // from settings
  effort: Effort;               // chosen per session
  totalMinutes: 15 | 20 | 30 | 45 | 60;
  format: 'auto' | Format;
  seed: number;
}

export type WorkStep = {
  kind: 'work';
  exerciseId: string;
  name: string;
  bellKg: number | null;
  reps?: number;
  seconds?: number;
  side?: 'left' | 'right';
  block: Block;
  round: number;
  totalRounds: number;
  indexInRound: number;
  itemsInRound: number;
  estSeconds: number;
};

export type RestStep = {
  kind: 'rest';
  seconds: number;
  nextName: string;
  block: Block;
  estSeconds: number;
};

export type Step = WorkStep | RestStep;

export interface Workout {
  id: string;
  createdAt: string;
  request: WorkoutRequest;
  format: Format;               // the format actually built, not the one asked for
  steps: Step[];
  estimatedSeconds: number;
  loadWarning: boolean;         // kit resolves fewer than three distinct weights
  shortOfBudget: boolean;       // could not fill the requested time; say so, do not lie
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  workout: Workout;
  mainExerciseIds: string[];
  workedSeconds: number;
  felt?: 'easy' | 'right' | 'brutal';
}
