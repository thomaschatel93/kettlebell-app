import type { Effort, HistoryEntry, Pattern, Workout } from '@/lib/types';
import { EFFORTS, PATTERNS } from '@/lib/types';
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

/** Reads never throw. A corrupt value on a phone must not brick the app. */
function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
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

export function loadKits(): KitState {
  const s = read<Partial<KitState>>(KEYS.kits, {});
  if (s.v !== VERSION || !Array.isArray(s.profiles) || s.profiles.length === 0) return DEFAULT_KIT_STATE;
  // A stored activeId naming no existing profile would crash every downstream
  // find(). Repair it instead.
  const activeId = s.profiles.some((p) => p.id === s.activeId) ? s.activeId! : s.profiles[0].id;
  return { ...DEFAULT_KIT_STATE, ...s, activeId } as KitState;
}
export const saveKits = (state: KitState): boolean => write(KEYS.kits, { ...state, v: VERSION });

export const loadHistory = (): HistoryEntry[] => {
  const h = read<HistoryEntry[]>(KEYS.history, []);
  return Array.isArray(h) ? h : [];
};
export const pushHistory = (e: HistoryEntry): boolean =>
  write(KEYS.history, [e, ...loadHistory()].slice(0, MAX_HISTORY));

export function loadPrefs(): Prefs {
  const p = read<Partial<Prefs>>(KEYS.prefs, {});
  const patterns = Array.isArray(p.patterns) && p.patterns.length > 0
    ? p.patterns.filter((x): x is Pattern => (PATTERNS as readonly string[]).includes(x))
    : [];
  return {
    patterns: patterns.length ? patterns : DEFAULT_PREFS.patterns,
    effort: (EFFORTS as readonly string[]).includes(p.effort ?? '') ? p.effort! : DEFAULT_PREFS.effort,
    totalMinutes: ([15, 20, 30, 45, 60] as const).includes(p.totalMinutes as 30)
      ? p.totalMinutes! : DEFAULT_PREFS.totalMinutes,
  };
}
export const savePrefs = (prefs: Prefs): boolean => write(KEYS.prefs, { ...prefs, v: VERSION });

export function loadActive(): ActiveState | null {
  const s = read<Partial<ActiveState> | null>(KEYS.active, null);
  if (!s || s.v !== VERSION || !s.workout) return null;
  return s as ActiveState;
}
export const saveActive = (state: ActiveState): boolean => write(KEYS.active, { ...state, v: VERSION });
export const clearActive = (): void => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEYS.active);
};
