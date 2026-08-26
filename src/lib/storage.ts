import type { Capability, Effort, HistoryEntry, KitProfile, Pattern, Workout } from '@/lib/types';
import { CAPABILITIES, EFFORTS, PATTERNS } from '@/lib/types';
import { DEFAULT_KIT_STATE, type KitState } from '@/lib/kit';

const KEYS = {
  kits: 'kb.kits.v1',
  history: 'kb.history.v1',
  prefs: 'kb.prefs.v1',
  active: 'kb.active.v1',
} as const;

const MAX_HISTORY = 30;
const VERSION = 1;

export interface Prefs {
  patterns: Pattern[];
  effort: Effort;
  totalMinutes: 15 | 20 | 30 | 45 | 60;
}

export interface ActiveState {
  v: 1;
  workout: Workout;
  stepIndex: number;
  workedSeconds: number;
  restEndsAt: number | null;      // absolute epoch ms; never a decremented counter
  pausedRemainingMs: number | null;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * `isPlainObject(workout)` alone accepts `workout: {}`. Both the resumed
 * workout screen (mounts on `ActiveState`) and a future history detail screen
 * (reads a `HistoryEntry`) index into `workout.steps` unguarded the instant
 * they render, so a truncated/half-written workout must be rejected here, not
 * discovered there - the worst possible moment to first notice a corrupt value.
 */
function hasStepsArray(x: unknown): x is { steps: unknown[] } {
  return isPlainObject(x) && Array.isArray(x.steps);
}

/**
 * Reads never throw. A corrupt value on a phone with no console must not brick
 * the app. `JSON.parse('null')` succeeds and returns `null` without throwing, so
 * every caller below re-validates the *shape* of what comes back, not just
 * whether parsing succeeded. Returns `undefined` for a missing key, invalid
 * JSON, or an SSR context.
 */
function readRaw(key: string): unknown {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;   // quota or private mode; the caller decides whether it matters
  }
}

const DEFAULT_PREFS: Prefs = { patterns: ['hinge', 'squat', 'push'], effort: 'normal', totalMinutes: 30 };

function isValidBell(x: unknown): x is { weightKg: number; count: number } {
  return isPlainObject(x)
    && typeof x.weightKg === 'number' && Number.isFinite(x.weightKg) && x.weightKg > 0
    && typeof x.count === 'number' && Number.isFinite(x.count) && Number.isInteger(x.count) && x.count >= 0;
}

function isKitProfile(x: unknown): x is KitProfile {
  return isPlainObject(x) && (x.id === 'home' || x.id === 'gym') && Array.isArray(x.bells);
}

/**
 * `isKitProfile` only checks that `bells` is an array, not what's inside it. A
 * `null`/garbage element there doesn't crash `loadKits` itself, but crashes the
 * very next frame - `uniqueWeights`/`resolveBell` read `.weightKg`/`.count` off
 * every element unguarded. Drop anything that isn't a real bell rather than
 * carry rubbish one step further downstream.
 */
function sanitizeKitProfile(p: KitProfile): KitProfile {
  return { ...p, bells: p.bells.filter(isValidBell) };
}

export function loadKits(): KitState {
  const raw = readRaw(KEYS.kits);
  if (!isPlainObject(raw) || raw.v !== VERSION) return structuredClone(DEFAULT_KIT_STATE);

  // A null/garbage entry inside `profiles` would crash both the `.some()` below
  // and every downstream `profiles.find(...)`. Filter before touching either.
  const profiles = (Array.isArray(raw.profiles) ? raw.profiles : [])
    .filter(isKitProfile)
    .map(sanitizeKitProfile);
  if (profiles.length === 0) return structuredClone(DEFAULT_KIT_STATE);

  // A stored activeId naming no existing profile would crash every downstream
  // find(). Repair it instead - and never let the repair itself produce
  // `undefined` if profiles[0].id somehow falls outside the closed id set.
  const firstId = profiles[0].id;
  const fallbackId: 'home' | 'gym' = firstId === 'home' || firstId === 'gym' ? firstId : 'home';
  const activeId = profiles.some((p) => p.id === raw.activeId) ? (raw.activeId as 'home' | 'gym') : fallbackId;

  const capability = (CAPABILITIES as readonly string[]).includes(raw.capability as string)
    ? (raw.capability as Capability)
    : DEFAULT_KIT_STATE.capability;

  return { v: VERSION, profiles, activeId, capability };
}
export const saveKits = (state: KitState): boolean => write(KEYS.kits, { ...state, v: VERSION });

/**
 * The minimum an entry needs to be worth keeping at all. `id` identifies it;
 * `createdAt` is what the history screen sorts and displays by, so an entry
 * without a usable one of those is better dropped than shown out of order or
 * unlabelled.
 */
function hasKeepableHistoryShape(
  x: unknown,
): x is Record<string, unknown> & { id: string; createdAt: string; workout: { steps: unknown[] } } {
  return isPlainObject(x) && typeof x.id === 'string' && typeof x.createdAt === 'string' && hasStepsArray(x.workout);
}

/**
 * `isHistoryEntryLike` (the old shape check) only verified `id`. A stored
 * `mainExerciseIds: null`, or a string instead of an array, passed it cleanly
 * and then crashed one frame later - `generate.ts` spreads `history[0].mainExerciseIds`
 * and `historyWeight` `.flatMap`s the same field across every entry. Neither
 * `mainExerciseIds` nor `workedSeconds` is essential to *identifying* the
 * entry the way `id`/`createdAt` are, so a malformed value here is coerced to
 * a safe default rather than discarding a record that may still be worth
 * keeping for the history screen.
 */
function sanitizeHistoryEntry(x: Record<string, unknown> & { id: string; createdAt: string }): HistoryEntry {
  const mainExerciseIds = Array.isArray(x.mainExerciseIds)
    ? x.mainExerciseIds.filter((id): id is string => typeof id === 'string')
    : [];
  const workedSeconds = typeof x.workedSeconds === 'number' && Number.isFinite(x.workedSeconds)
    ? x.workedSeconds
    : 0;
  return { ...(x as unknown as HistoryEntry), mainExerciseIds, workedSeconds };
}

export function loadHistory(): HistoryEntry[] {
  const raw = readRaw(KEYS.history);
  if (!isPlainObject(raw) || raw.v !== VERSION || !Array.isArray(raw.entries)) return [];
  return raw.entries.filter(hasKeepableHistoryShape).map(sanitizeHistoryEntry);
}
export const pushHistory = (e: HistoryEntry): boolean =>
  write(KEYS.history, { v: VERSION, entries: [e, ...loadHistory()].slice(0, MAX_HISTORY) });

export function loadPrefs(): Prefs {
  const raw = readRaw(KEYS.prefs);
  const p = isPlainObject(raw) ? raw : {};

  const rawPatterns = Array.isArray(p.patterns) ? p.patterns : [];
  const patterns = rawPatterns.filter((x): x is Pattern =>
    typeof x === 'string' && (PATTERNS as readonly string[]).includes(x));

  const effort = typeof p.effort === 'string' && (EFFORTS as readonly string[]).includes(p.effort)
    ? (p.effort as Effort)
    : DEFAULT_PREFS.effort;

  const totalMinutes = ([15, 20, 30, 45, 60] as const).includes(p.totalMinutes as 30)
    ? (p.totalMinutes as Prefs['totalMinutes'])
    : DEFAULT_PREFS.totalMinutes;

  return {
    patterns: patterns.length ? patterns : DEFAULT_PREFS.patterns,
    effort,
    totalMinutes,
  };
}
export const savePrefs = (prefs: Prefs): boolean => write(KEYS.prefs, { ...prefs, v: VERSION });

function isFiniteOrNull(x: unknown): x is number | null {
  return x === null || (typeof x === 'number' && Number.isFinite(x));
}

function isActiveState(x: unknown): x is ActiveState {
  if (!(isPlainObject(x)
    && x.v === VERSION
    && hasStepsArray(x.workout)
    && typeof x.stepIndex === 'number' && Number.isFinite(x.stepIndex)
    && typeof x.workedSeconds === 'number' && Number.isFinite(x.workedSeconds)
    && isFiniteOrNull(x.restEndsAt)
    && isFiniteOrNull(x.pausedRemainingMs))) return false;

  // A stepIndex a real workout couldn't produce (out of range, e.g. from a
  // workout that got truncated on write, or corrupted to fewer steps) would
  // crash the runner the same way: `workout.steps[stepIndex].kind` reads off
  // `undefined` the instant the screen renders the current step.
  return x.stepIndex >= 0 && x.stepIndex < x.workout.steps.length;
}

export function loadActive(): ActiveState | null {
  const raw = readRaw(KEYS.active);
  return isActiveState(raw) ? raw : null;
}
export const saveActive = (state: ActiveState): boolean => write(KEYS.active, { ...state, v: VERSION });
export const clearActive = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEYS.active);
  } catch {
    // a "clear" call is exactly the kind of thing a caller expects never to throw
  }
};
