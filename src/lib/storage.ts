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

function isKitProfile(x: unknown): x is KitProfile {
  return isPlainObject(x) && (x.id === 'home' || x.id === 'gym') && Array.isArray(x.bells);
}

export function loadKits(): KitState {
  const raw = readRaw(KEYS.kits);
  if (!isPlainObject(raw) || raw.v !== VERSION) return structuredClone(DEFAULT_KIT_STATE);

  // A null/garbage entry inside `profiles` would crash both the `.some()` below
  // and every downstream `profiles.find(...)`. Filter before touching either.
  const profiles = (Array.isArray(raw.profiles) ? raw.profiles : []).filter(isKitProfile);
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

function isHistoryEntryLike(x: unknown): x is HistoryEntry {
  return isPlainObject(x) && typeof x.id === 'string';
}

export function loadHistory(): HistoryEntry[] {
  const raw = readRaw(KEYS.history);
  if (!isPlainObject(raw) || raw.v !== VERSION || !Array.isArray(raw.entries)) return [];
  return raw.entries.filter(isHistoryEntryLike);
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
  return isPlainObject(x)
    && x.v === VERSION
    && isPlainObject(x.workout)
    && typeof x.stepIndex === 'number'
    && typeof x.workedSeconds === 'number'
    && isFiniteOrNull(x.restEndsAt)
    && isFiniteOrNull(x.pausedRemainingMs);
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
