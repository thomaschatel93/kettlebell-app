# Kettlebell Workout App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable web app that generates a kettlebell workout from the available bells, chosen movement patterns and available minutes, then walks through it one exercise at a time.

**Architecture:** All logic runs on the device. A pure, seeded rules engine turns a request plus the exercise database into a flat list of steps; the UI walks that list and holds no programming logic. Kit, history and the in-progress workout live in `localStorage`. No server, no database, no API keys.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, Vitest, `sharp` and `tsx` for one-off media scripts. No animation library: CSS transitions cover the motion here. No service worker in v1.

**Revision:** rewritten 2026-08-25 after the engineering and user research reviews. See `REVIEW.md` for what changed and why. The v1 engine failed its own time-budget invariant by up to 57%; do not consult the previous plan.

## Global Constraints

- Source spec is `docs/SPEC.md`. Where this plan and the spec disagree, the spec wins and the plan is corrected.
- TypeScript `strict: true`. No `any` in `src/lib`.
- **Every task's verification step is `npm run typecheck && npm test`.** Vitest transpiles without type-checking, so tests alone prove nothing about types.
- Everything under `src/lib/` is pure: no `Date.now()`, no `Math.random()`, no `window`, no `fetch`. The clock and storage live in `src/lib/storage.ts` and in components.
- Randomness comes only from the seeded generator in `src/lib/rng.ts`.
- Movement patterns are exactly: `hinge`, `squat`, `push`, `pull`, `carry`, `core`.
- Capability is `beginner | intermediate | advanced` and filters the pool. Effort is `easy | normal | hard` and scales reps and rest. They are never the same value.
- Exercise `id` is kebab-case, stable, and matches `public/exercises/<id>.webp`.
- `localStorage` keys are exactly `kb.kits.v1`, `kb.history.v1`, `kb.prefs.v1`, `kb.active.v1`, and every stored value carries a `v` field.
- Timers derive from an absolute epoch deadline, never from a decremented tick count.
- Colours, spacing and type come from the CSS custom properties in Task 15. No raw hex in components.
- Tap targets at least 44px. WCAG AA contrast. Honour `prefers-reduced-motion`. The `--text-dim` token is banned from the workout and rest screens.
- British English in all user-facing copy.
- Commit after every task, Conventional Commits style.

## Module contract

Every task implements part of this. Names and signatures are fixed here so tasks
can be executed out of order without drift.

```
src/lib/types.ts      PATTERNS, CAPABILITIES, EFFORTS, capabilityRank
                      Pattern, Capability, Effort, Mechanic, LoadBand, Block, Format
                      Exercise, Combo, KitProfile, WorkoutRequest, Step, Workout, HistoryEntry

src/lib/rng.ts        createRng(seed) -> Rng;  pick(rng, items);  shuffle(rng, items)

src/lib/kit.ts        uniqueWeights(kit) -> number[]
                      resolveBell(band, kit) -> number | null
                      hasMatchedPair(kit) -> boolean
                      isUnderSpecified(kit) -> boolean     // fewer than 3 distinct weights
                      DEFAULT_KIT_STATE

src/lib/pool.ts       filterPool(exercises, req, kit) -> Exercise[]
                      filterCombos(combos, exercises, req, kit) -> Combo[]
                      warmupPool(exercises, kit);  cooldownPool(exercises, kit)
                      coverablePatterns(pool, req) -> Pattern[]

src/lib/budget.ts     budget(totalMinutes) -> { warmupSeconds, mainSeconds, cooldownSeconds }

src/lib/format.ts     chooseFormat(req, combosAvailable) -> Format

src/lib/prescribe.ts  REP_FACTOR, REST_FACTOR
                      prescribe(exercise, format, effort, kit) -> Prescription
                      estimateWork(exercise, prescription) -> number
                      betweenRoundsRest(format, effort) -> number

src/lib/select.ts     historyWeight(id, history) -> number
                      weightedPick(rng, items, history) -> T | undefined
                      orderCircuit(items) -> Exercise[]
                      selectCircuit(pool, req, rng, history, count) -> Exercise[]
                      selectStrength(pool, rng, history) -> Exercise[]
                      selectCombos(combos, rng, history, count) -> Combo[]

src/lib/fit.ts        roundDuration(works, restSeconds) -> number
                      blockSeconds(plan) -> number
                      deviation(actual, target) -> number
                      trimToBudget(plan, targetSeconds) -> BlockPlan

src/lib/flatten.ts    PlannedItem, BlockPlan, buildSteps(plans) -> Step[]

src/lib/generate.ts   GenerateInput, generate(input) -> Workout

src/lib/storage.ts    loadKits/saveKits, loadHistory/pushHistory, loadPrefs/savePrefs,
                      loadActive/saveActive/clearActive
```

## File structure

```
PROJECTS/kettlebell-app/
  docs/               SPEC.md, PLAN.md, REVIEW.md, image-brief.md
  media-source/       grid-01.png
  scripts/            slice-grid.mts, check-media.mts
  public/exercises/   <id>.webp
  src/lib/            the modules above, plus data/
  src/lib/data/       exercises.ts, ancillary.ts, combos.ts
  src/components/     primitives, cards, screens
  src/app/            App Router pages
  tests/              mirrors src/lib, plus fixtures.ts
```

---

### Task 1: Scaffold, tooling, and both gates green

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/lib/types.ts`, `tests/sanity.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run typecheck`, `npm test`, `npm run dev`

- [ ] **Step 1: Scaffold**

The directory already holds `docs/` and `media-source/`, which create-next-app
tolerates. Do not pass `--no-turbopack`; it is not a valid flag and will abort.

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --eslint --use-npm
```

- [ ] **Step 2: Make it its own git repo**

The parent folder is a repo with no commits and unrelated files. This project gets
its own.

```bash
git init && git add -A && git commit -m "chore: scaffold Next.js app"
```

- [ ] **Step 3: Add Vitest and the typecheck gate**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.ts?(x)'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

`tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit",
"verify": "npm run typecheck && npm test"
```

- [ ] **Step 4: Write the failing test**

`tests/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PATTERNS, CAPABILITIES, EFFORTS } from '@/lib/types';

describe('project wiring', () => {
  it('exports the six movement patterns', () => {
    expect(PATTERNS).toEqual(['hinge', 'squat', 'push', 'pull', 'carry', 'core']);
  });

  it('keeps capability and effort as separate vocabularies', () => {
    expect(CAPABILITIES).toEqual(['beginner', 'intermediate', 'advanced']);
    expect(EFFORTS).toEqual(['easy', 'normal', 'hard']);
  });
});
```

- [ ] **Step 5: Run it and watch it fail**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/types`.

- [ ] **Step 6: Create the minimum to pass**

`src/lib/types.ts`:

```ts
export const PATTERNS = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'] as const;
export const CAPABILITIES = ['beginner', 'intermediate', 'advanced'] as const;
export const EFFORTS = ['easy', 'normal', 'hard'] as const;
```

- [ ] **Step 7: Verify**

Run: `npm run verify`
Expected: PASS on both gates.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold with typecheck and test gates"
```

---

### Task 2: Domain types

**Files:**
- Modify: `src/lib/types.ts`
- Test: `tests/types.test.ts`

**Interfaces:**
- Consumes: the constants from Task 1
- Produces: every type in the module contract

- [ ] **Step 1: Write the failing test**

`tests/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { capabilityRank, CAPABILITIES } from '@/lib/types';

describe('capabilityRank', () => {
  it('orders the three capabilities', () => {
    expect(CAPABILITIES.map(capabilityRank)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- types`
Expected: FAIL, `capabilityRank` is not exported.

- [ ] **Step 3: Write the types**

Append to `src/lib/types.ts`:

```ts
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
```

The `WorkStep` and `RestStep` aliases exist so tests and components can narrow
without repeating the union inline.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add the domain types"
```

---

### Task 3: Seeded randomness

**Files:**
- Create: `src/lib/rng.ts`
- Test: `tests/rng.test.ts`

**Interfaces:**
- Produces: `Rng`, `createRng(seed)`, `pick(rng, items)`, `shuffle(rng, items)`

- [ ] **Step 1: Write the failing test**

`tests/rng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng, pick, shuffle } from '@/lib/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42), b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs across seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('stays between zero and one', () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('keeps every element and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(createRng(3), input);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('pick', () => {
  it('returns a member of the list', () => {
    expect([1, 2, 3]).toContain(pick(createRng(9), [1, 2, 3]));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- rng`
Expected: FAIL, cannot resolve `@/lib/rng`.

- [ ] **Step 3: Implement**

`src/lib/rng.ts`:

```ts
export type Rng = () => number;

/**
 * mulberry32: small, fast, reproducible across runs and platforms.
 * Chosen over Math.random because the whole engine's testability rests on the
 * same seed producing the same workout.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(rng: Rng, items: T[]): T => items[Math.floor(rng() * items.length)];

export function shuffle<T>(rng: Rng, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add a seeded random generator"
```

---

### Task 4: Kit profiles and load bands

**Files:**
- Create: `src/lib/kit.ts`
- Test: `tests/kit.test.ts`

**Interfaces:**
- Produces: `uniqueWeights`, `resolveBell`, `hasMatchedPair`, `isUnderSpecified`, `KitState`, `DEFAULT_KIT_STATE`

- [ ] **Step 1: Write the failing test**

`tests/kit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { uniqueWeights, resolveBell, hasMatchedPair, isUnderSpecified, DEFAULT_KIT_STATE } from '@/lib/kit';
import type { KitProfile } from '@/lib/types';

const kit = (bells: { weightKg: number; count: number }[]): KitProfile => ({
  id: 'home', name: 'Home', bells, hasBench: false,
});

describe('uniqueWeights', () => {
  it('sorts ascending and removes duplicates', () => {
    expect(uniqueWeights(kit([{ weightKg: 24, count: 1 }, { weightKg: 16, count: 2 }]))).toEqual([16, 24]);
  });

  it('ignores a weight with a count of zero', () => {
    expect(uniqueWeights(kit([{ weightKg: 16, count: 0 }]))).toEqual([]);
  });
});

describe('resolveBell', () => {
  it('maps the three bands across three bells', () => {
    const k = kit([{ weightKg: 16, count: 2 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 }]);
    expect(resolveBell('light', k)).toBe(16);
    expect(resolveBell('moderate', k)).toBe(24);
    expect(resolveBell('heavy', k)).toBe(32);
  });

  it('maps every band to the only bell in a one-bell kit', () => {
    const k = kit([{ weightKg: 20, count: 1 }]);
    expect(['light', 'moderate', 'heavy'].map((b) => resolveBell(b as 'light', k))).toEqual([20, 20, 20]);
  });

  it('rounds the middle down with an even number of bells', () => {
    expect(resolveBell('moderate', kit([{ weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }]))).toBe(16);
  });

  it('returns null for an empty kit', () => {
    expect(resolveBell('light', kit([]))).toBeNull();
  });
});

describe('hasMatchedPair', () => {
  it('is true only when two bells share a weight', () => {
    expect(hasMatchedPair(kit([{ weightKg: 16, count: 2 }]))).toBe(true);
    expect(hasMatchedPair(kit([{ weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }]))).toBe(false);
  });
});

describe('isUnderSpecified', () => {
  it('flags a kit that cannot separate the three load bands', () => {
    expect(isUnderSpecified(kit([{ weightKg: 24, count: 1 }]))).toBe(true);
    expect(isUnderSpecified(kit([{ weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }]))).toBe(true);
    expect(isUnderSpecified(kit([
      { weightKg: 16, count: 1 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 },
    ]))).toBe(false);
  });
});

describe('DEFAULT_KIT_STATE', () => {
  it('ships exactly two fixed profiles, both empty, Home active', () => {
    expect(DEFAULT_KIT_STATE.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
    for (const p of DEFAULT_KIT_STATE.profiles) expect(p.bells).toEqual([]);
    expect(DEFAULT_KIT_STATE.activeId).toBe('home');
  });

  it('starts at the lowest capability', () => {
    expect(DEFAULT_KIT_STATE.capability).toBe('beginner');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- kit`
Expected: FAIL, cannot resolve `@/lib/kit`.

- [ ] **Step 3: Implement**

`src/lib/kit.ts`:

```ts
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
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add kit profiles, load bands and the under-specified check"
```

---

### Task 5: Shared test fixtures

**Files:**
- Create: `tests/fixtures.ts`
- Test: `tests/fixtures.test.ts`

**Interfaces:**
- Produces: `ex()`, `combo()`, `kit()`, `req()`, `entry()`, `FIXTURE_EXERCISES`, `FIXTURE_COMBOS`, `FULL_KIT`, `HOME_KIT`

This exists for two reasons. Four test files were otherwise going to redefine the
same builders and drift apart. More importantly, **the engine invariants are tested
against this synthetic database, not against the real exercise data.** Testing the
engine against real data means a thin database fails the engine tests, and the
remedy becomes "add exercises until the test goes green", which shapes the database
around a test rather than around kettlebell programming. The real database gets its
own invariant run in Task 14.

- [ ] **Step 1: Write the fixture module**

`tests/fixtures.ts`:

```ts
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

export const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'h1', createdAt: '2026-08-25T09:00:00.000Z',
  workout: {} as Workout, mainExerciseIds: [], workedSeconds: 1500, ...over,
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
```

- [ ] **Step 2: Write the test that the fixtures are self-consistent**

`tests/fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FIXTURE_EXERCISES, FIXTURE_COMBOS } from './fixtures';
import { PATTERNS } from '@/lib/types';

describe('fixture database', () => {
  it('has unique ids', () => {
    const ids = FIXTURE_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers at least three main candidates for every pattern', () => {
    for (const p of PATTERNS) {
      const n = FIXTURE_EXERCISES.filter(
        (e) => !e.warmupSuitable && !e.cooldownSuitable && e.patterns[0] === p,
      ).length;
      expect(n, `pattern ${p}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('resolves every combo step', () => {
    for (const c of FIXTURE_COMBOS) {
      for (const s of c.steps) {
        expect(FIXTURE_EXERCISES.some((e) => e.id === s.exerciseId), `${c.id} -> ${s.exerciseId}`).toBe(true);
      }
    }
  });

  it('gives every exercise a way to be prescribed', () => {
    for (const e of FIXTURE_EXERCISES) expect(e.defaultReps ?? e.defaultWorkSeconds).toBeDefined();
  });
});
```

- [ ] **Step 3: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add a synthetic fixture database for engine tests"
```

---

### Task 6: Pool, budget and format

**Files:**
- Create: `src/lib/pool.ts`, `src/lib/budget.ts`, `src/lib/format.ts`
- Test: `tests/pool.test.ts`, `tests/budget.test.ts`

**Interfaces:**
- Consumes: `hasMatchedPair`, `uniqueWeights` from Task 4; fixtures from Task 5
- Produces: `filterPool`, `filterCombos`, `warmupPool`, `cooldownPool`, `coverablePatterns`, `budget`, `chooseFormat`

- [ ] **Step 1: Write the failing tests**

`tests/pool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterPool, coverablePatterns, warmupPool } from '@/lib/pool';
import { ex, req, kit, FIXTURE_EXERCISES, HOME_KIT, FULL_KIT } from './fixtures';

describe('filterPool', () => {
  it('drops exercises above the requested capability', () => {
    expect(filterPool([ex('a', { capability: 'advanced' })], req(), kit())).toEqual([]);
  });

  it('drops two-bell exercises without a matched pair', () => {
    const doubles = ex('d', { bells: 2 });
    expect(filterPool([doubles], req(), kit())).toEqual([]);
    expect(filterPool([doubles], req(), kit({ bells: [{ weightKg: 16, count: 2 }] }))).toHaveLength(1);
  });

  it('drops bench exercises without a bench', () => {
    const bench = ex('b', { needsBench: true });
    expect(filterPool([bench], req(), kit())).toEqual([]);
    expect(filterPool([bench], req(), kit({ hasBench: true }))).toHaveLength(1);
  });

  it('drops exercises that train none of the requested patterns', () => {
    expect(filterPool([ex('c', { patterns: ['core'] })], req({ patterns: ['hinge'] }), kit())).toEqual([]);
  });

  it('drops bell exercises when the kit is empty', () => {
    expect(filterPool([ex('a')], req(), kit({ bells: [] }))).toEqual([]);
  });

  it('excludes ancillary moves from the main pool', () => {
    expect(filterPool([ex('w', { warmupSuitable: true })], req(), kit())).toEqual([]);
    expect(filterPool([ex('c', { cooldownSuitable: true })], req(), kit())).toEqual([]);
  });

  it('keeps an exercise that satisfies everything', () => {
    expect(filterPool([ex('a')], req(), kit())).toHaveLength(1);
  });
});

describe('coverablePatterns', () => {
  it('names only the patterns the filtered pool can actually train', () => {
    const r = req({ patterns: ['hinge', 'carry'], capability: 'advanced' });
    // Every carry in the fixtures needs either two bells or is available with one.
    const pool = filterPool(FIXTURE_EXERCISES, r, HOME_KIT);
    const covered = coverablePatterns(pool, r);
    expect(covered).toContain('hinge');
    expect(coverablePatterns(filterPool(FIXTURE_EXERCISES, r, FULL_KIT), r)).toContain('carry');
  });

  it('is empty for an empty pool', () => {
    expect(coverablePatterns([], req())).toEqual([]);
  });
});

describe('warmupPool', () => {
  it('returns only warm-up moves', () => {
    const pool = warmupPool(FIXTURE_EXERCISES, HOME_KIT);
    expect(pool.length).toBeGreaterThan(0);
    for (const e of pool) expect(e.warmupSuitable).toBe(true);
  });
});
```

`tests/budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { budget } from '@/lib/budget';
import { chooseFormat } from '@/lib/format';
import { req } from './fixtures';

describe('budget', () => {
  it('always accounts for the whole time', () => {
    for (const m of [15, 20, 30, 45, 60] as const) {
      const b = budget(m);
      expect(b.warmupSeconds + b.mainSeconds + b.cooldownSeconds).toBe(m * 60);
    }
  });

  it('clamps the warm-up to between three and seven minutes', () => {
    expect(budget(15).warmupSeconds).toBe(180);
    expect(budget(60).warmupSeconds).toBe(420);
  });

  it('clamps the cool-down to between two and five minutes', () => {
    expect(budget(15).cooldownSeconds).toBe(120);
    expect(budget(60).cooldownSeconds).toBe(300);
  });
});

describe('chooseFormat', () => {
  it('respects an explicit choice', () => {
    expect(chooseFormat(req({ format: 'strength', patterns: ['hinge', 'squat', 'push', 'pull'] }), false)).toBe('strength');
  });

  it('chooses a circuit for four or more patterns', () => {
    expect(chooseFormat(req({ patterns: ['hinge', 'squat', 'push', 'pull'] }), true)).toBe('circuit');
  });

  it('chooses strength for a narrow focus and a long session', () => {
    expect(chooseFormat(req({ patterns: ['push'], totalMinutes: 45 }), true)).toBe('strength');
  });

  it('chooses a complex for a narrow focus and a short session when one fits', () => {
    expect(chooseFormat(req({ patterns: ['push'], totalMinutes: 30 }), true)).toBe('complex');
  });

  it('falls back to a circuit when no combo fits', () => {
    expect(chooseFormat(req({ patterns: ['push'], totalMinutes: 30 }), false)).toBe('circuit');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- pool budget`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/budget.ts`:

```ts
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function budget(totalMinutes: number): {
  warmupSeconds: number; mainSeconds: number; cooldownSeconds: number;
} {
  const total = totalMinutes * 60;
  const warmupSeconds = clamp(Math.round(total * 0.15), 180, 420);
  const cooldownSeconds = clamp(Math.round(total * 0.1), 120, 300);
  return { warmupSeconds, cooldownSeconds, mainSeconds: total - warmupSeconds - cooldownSeconds };
}
```

These are nominal shares only. The generator builds the ancillary blocks first,
measures what they actually cost, and gives the main block the true remainder.
That is what stops a short warm-up pool from silently shrinking the whole session.

`src/lib/format.ts`:

```ts
import type { Format, WorkoutRequest } from '@/lib/types';

export function chooseFormat(req: WorkoutRequest, combosAvailable: boolean): Format {
  if (req.format !== 'auto') return req.format;
  if (req.patterns.length >= 4) return 'circuit';
  if (req.totalMinutes >= 35) return 'strength';
  return combosAvailable ? 'complex' : 'circuit';
}
```

`src/lib/pool.ts`:

```ts
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
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: filter the pool, budget the time and choose a format"
```

---

### Task 7: Prescription

**Files:**
- Create: `src/lib/prescribe.ts`
- Test: `tests/prescribe.test.ts`

**Interfaces:**
- Consumes: `isUnderSpecified` from Task 4
- Produces: `Prescription`, `REP_FACTOR`, `REST_FACTOR`, `prescribe`, `estimateWork`, `betweenRoundsRest`

Two corrections from the review live here. Strength gains a real between-rounds
rest, because zero would run the last exercise of a round straight into the first
of the next, which is a metcon rather than a strength protocol. And there is now
exactly one copy of the effort modifiers, exported, so the complex path cannot
drift its own duplicate with a different floor.

- [ ] **Step 1: Write the failing test**

`tests/prescribe.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { prescribe, estimateWork, betweenRoundsRest } from '@/lib/prescribe';
import { ex, kit, FULL_KIT } from './fixtures';

const swing = ex('swing', { mechanic: 'ballistic', loadBand: 'heavy', secondsPerRep: 2, defaultReps: 10 });
const press = ex('press', { loadBand: 'light', secondsPerRep: 4, defaultReps: 10 });
const carry = ex('carry', {
  mechanic: 'carry', defaultReps: undefined, defaultWorkSeconds: 40, secondsPerRep: 0,
});

describe('prescribe', () => {
  it('uses the default reps at normal effort', () => {
    expect(prescribe(swing, 'circuit', 'normal', FULL_KIT)).toEqual({ reps: 10, restSeconds: 30 });
  });

  it('gives easy fewer reps and more rest', () => {
    expect(prescribe(swing, 'circuit', 'easy', FULL_KIT)).toEqual({ reps: 7, restSeconds: 45 });
  });

  it('gives hard more reps and less rest', () => {
    expect(prescribe(swing, 'circuit', 'hard', FULL_KIT)).toEqual({ reps: 12, restSeconds: 25 });
  });

  it('never drops below three reps', () => {
    expect(prescribe(ex('x', { defaultReps: 3 }), 'circuit', 'easy', FULL_KIT).reps).toBe(3);
  });

  it('prescribes five reps for strength before modifiers', () => {
    expect(prescribe(swing, 'strength', 'normal', FULL_KIT)).toEqual({ reps: 5, restSeconds: 90 });
  });

  it('prescribes carries in seconds, rounded to five', () => {
    expect(prescribe(carry, 'circuit', 'normal', FULL_KIT)).toEqual({ seconds: 40, restSeconds: 30 });
    expect(prescribe(carry, 'circuit', 'easy', FULL_KIT)).toEqual({ seconds: 30, restSeconds: 45 });
  });

  it('cuts the reps on a light grind when the kit cannot separate the load bands', () => {
    const oneBell = kit({ bells: [{ weightKg: 24, count: 1 }] });
    expect(prescribe(press, 'circuit', 'normal', oneBell).reps).toBe(6);
    // A heavy ballistic is unaffected: the one bell is the right bell for a swing.
    expect(prescribe(swing, 'circuit', 'normal', oneBell).reps).toBe(10);
  });
});

describe('estimateWork', () => {
  it('multiplies reps by the seconds per rep', () => {
    expect(estimateWork(swing, { reps: 10, restSeconds: 30 })).toBe(20);
  });

  it('does not double a unilateral movement, because it emits two steps', () => {
    expect(estimateWork(ex('u', { unilateral: true, secondsPerRep: 2, defaultReps: 10 }), { reps: 10, restSeconds: 30 })).toBe(20);
  });

  it('uses the seconds directly for a carry', () => {
    expect(estimateWork(carry, { seconds: 40, restSeconds: 30 })).toBe(40);
  });
});

describe('betweenRoundsRest', () => {
  it('gives strength a real rest between rounds', () => {
    expect(betweenRoundsRest('strength', 'normal')).toBe(90);
  });

  it('rests longer between complex rounds than circuit rounds', () => {
    expect(betweenRoundsRest('circuit', 'normal')).toBe(75);
    expect(betweenRoundsRest('complex', 'normal')).toBe(90);
  });

  it('applies the effort modifier', () => {
    expect(betweenRoundsRest('circuit', 'easy')).toBe(115);
    expect(betweenRoundsRest('circuit', 'hard')).toBe(60);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- prescribe`
Expected: FAIL, cannot resolve `@/lib/prescribe`.

- [ ] **Step 3: Implement**

`src/lib/prescribe.ts`:

```ts
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
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: prescribe reps and rest from effort, with the under-specified kit penalty"
```

---

### Task 8: Selection and ordering

**Files:**
- Create: `src/lib/select.ts`
- Test: `tests/select.test.ts`

**Interfaces:**
- Consumes: `Rng` from Task 3, fixtures from Task 5
- Produces: `historyWeight`, `weightedPick`, `orderCircuit`, `selectCircuit`, `selectStrength`, `selectCombos`

`orderCircuit` is a full rewrite. The previous single-pass fix-up left an adjacent
duplicate in 15% of cases that had a valid ordering, destroyed the ballistic-first
ordering in 35%, and ignored the wrap-around entirely, where a circuit's last item
meets its first on the next round.

> **CORRECTION, applied during implementation on 2026-08-25.** The replacement first
> written below was ALSO wrong, in two ways, both confirmed by three independent
> brute-force checks:
>
> 1. **The closing rotation cannot repair a wrap clash.** Rotation is a symmetry of a
>    cycle, so it preserves every circular adjacency. It only moves the clashing pair
>    into the interior, and in doing so destroys the no-adjacent-duplicates invariant
>    the greedy had just established. Verified: every rotation of `[A,B,A,C,A]` has a
>    broken interior.
> 2. **The `solvable` predicate in the test used `Math.ceil(n/2)`,** which is the bound
>    for arranging a line. The bound for arranging a CIRCLE is `Math.floor(n/2)`. Over
>    1,715 multisets, `floor` mispredicts 0 and `ceil` mispredicts 330. The test was
>    asserting circular validity on cases that were arithmetically impossible.
>
> The shipped `src/lib/select.ts` therefore keeps the largest-remaining-group greedy as
> `greedyOrder`, a safe fallback complete for a LINE, and adds `searchOrder`: the same
> greedy made complete for the CIRCLE by backtracking, with memoised dead states and
> only the first unused item of each pattern group tried. It was verified exhaustively
> against brute force — 11,976 solvable cases up to n=12, zero wrong, zero dropped —
> and runs in under 2ms worst case. Read the shipped file, not the block below, if the
> two ever disagree.

The replacement is a largest-remaining-group
greedy, which is complete whenever a valid ordering exists.

The weighting is deliberately arithmetic. A fresh candidate scores in `[0.5, 1.5)`
and a recently used one in `[0.125, 0.375)`, so a fresh candidate always beats a
recently used one and the random component only separates equals. Note that it is
an argmax over per-item noise, not a probabilistic draw, and that the number of
`rng()` calls depends on the candidate count, so adding an exercise to the database
changes what a given seed produces.

- [ ] **Step 1: Write the failing test**

`tests/select.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { historyWeight, orderCircuit, selectCircuit, selectStrength } from '@/lib/select';
import { createRng, shuffle } from '@/lib/rng';
import { ex, req, entry, FIXTURE_EXERCISES } from './fixtures';
import { filterPool } from '@/lib/pool';
import { FULL_KIT } from './fixtures';
import type { Exercise, Pattern } from '@/lib/types';

const adjacentOk = (out: Exercise[], wrap: boolean): boolean => {
  for (let i = 1; i < out.length; i++) if (out[i].patterns[0] === out[i - 1].patterns[0]) return false;
  if (wrap && out.length > 1 && out[0].patterns[0] === out.at(-1)!.patterns[0]) return false;
  return true;
};

/**
 * A set admits a CIRCULAR ordering when no single pattern holds more than
 * floor(n/2) of the slots. Do not use ceil here: ceil is the bound for arranging a
 * line, and a circuit is a circle. Brute-forced over 1,715 multisets, floor
 * mispredicts 0 and ceil mispredicts 330.
 */
const solvable = (items: Exercise[]): boolean => {
  const counts = new Map<Pattern, number>();
  for (const e of items) counts.set(e.patterns[0], (counts.get(e.patterns[0]) ?? 0) + 1);
  return Math.max(...counts.values()) <= Math.floor(items.length / 2);
};

describe('historyWeight', () => {
  it('penalises anything in the last two workouts, compared on main ids', () => {
    const h = [entry({ mainExerciseIds: ['a'] }), entry({ mainExerciseIds: ['b'] }), entry({ mainExerciseIds: ['c'] })];
    expect(historyWeight('a', h)).toBe(0.25);
    expect(historyWeight('b', h)).toBe(0.25);
    expect(historyWeight('c', h)).toBe(1);
    expect(historyWeight('z', h)).toBe(1);
  });
});

describe('orderCircuit', () => {
  it('opens on a ballistic when one is present', () => {
    const out = orderCircuit([
      ex('carry', { mechanic: 'carry', patterns: ['carry'] }),
      ex('press', { patterns: ['push'] }),
      ex('swing', { mechanic: 'ballistic', patterns: ['hinge'] }),
    ]);
    expect(out[0].id).toBe('swing');
  });

  it('puts carries and core last', () => {
    const out = orderCircuit([
      ex('carry', { mechanic: 'carry', patterns: ['carry'] }),
      ex('press', { patterns: ['push'] }),
      ex('swing', { mechanic: 'ballistic', patterns: ['hinge'] }),
    ]);
    expect(out.at(-1)!.id).toBe('carry');
  });

  it('finds a valid ordering whenever one exists, wrap-around included', () => {
    const patterns: Pattern[] = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'];
    let checked = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const rng = createRng(seed);
      const n = 4 + Math.floor(rng() * 3);
      const items = Array.from({ length: n }, (_, i) =>
        ex(`e${i}`, { patterns: [patterns[Math.floor(rng() * patterns.length)]] }));
      if (!solvable(items)) continue;
      checked++;
      expect(adjacentOk(orderCircuit(items), true), `seed ${seed}`).toBe(true);
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('still returns every item when no valid ordering exists', () => {
    const four = Array.from({ length: 4 }, (_, i) => ex(`h${i}`, { patterns: ['hinge'] }));
    expect(orderCircuit(four)).toHaveLength(4);
  });
});

describe('selectCircuit', () => {
  const pool = filterPool(FIXTURE_EXERCISES, req({ patterns: ['hinge', 'squat', 'push'], capability: 'advanced' }), FULL_KIT);

  it('returns exactly the count asked for', () => {
    expect(selectCircuit(pool, req(), createRng(1), [], 5)).toHaveLength(5);
  });

  it('covers every requested pattern', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const out = selectCircuit(pool, req(), createRng(seed), [], 4);
      const covered = new Set(out.flatMap((e) => e.patterns));
      for (const p of req().patterns) expect(covered, `seed ${seed}`).toContain(p);
    }
  });

  it('prefers an exercise not used in the last two workouts', () => {
    const small = [ex('a', { patterns: ['hinge'] }), ex('b', { patterns: ['hinge'] })];
    const out = selectCircuit(small, req({ patterns: ['hinge'] }), createRng(11), [entry({ mainExerciseIds: ['a'] })], 1);
    expect(out.map((e) => e.id)).toEqual(['b']);
  });

  it('spreads the fill across under-represented patterns', () => {
    const out = selectCircuit(pool, req({ patterns: ['hinge'] }), createRng(3), [], 4);
    const primaries = out.map((e) => e.patterns[0]);
    expect(new Set(primaries).size).toBeGreaterThan(1);
  });

  it('never repeats an exercise', () => {
    const out = selectCircuit(pool, req(), createRng(6), [], 6);
    expect(new Set(out.map((e) => e.id)).size).toBe(out.length);
  });

  it('returns what it can when the pool is smaller than the count', () => {
    expect(selectCircuit(pool.slice(0, 2), req(), createRng(2), [], 6)).toHaveLength(2);
  });
});

describe('selectStrength', () => {
  const pool = filterPool(FIXTURE_EXERCISES, req({ capability: 'advanced' }), FULL_KIT);

  it('returns the count asked for, opening on a grind', () => {
    const out = selectStrength(pool, createRng(1), [], 3);
    expect(out).toHaveLength(3);
    expect(out[0].mechanic).toBe('grind');
  });

  it('prefers distinct primary patterns', () => {
    const out = selectStrength(pool, createRng(4), [], 3);
    expect(new Set(out.map((e) => e.patterns[0])).size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- select`
Expected: FAIL, cannot resolve `@/lib/select`.

- [ ] **Step 3: Implement**

`src/lib/select.ts`:

```ts
import type { Combo, Exercise, HistoryEntry, Pattern, WorkoutRequest } from '@/lib/types';
import type { Rng } from '@/lib/rng';

const RECENT_WORKOUTS = 2;

/**
 * Compared against mainExerciseIds, which is what the runner writes for the main
 * block only. Comparing against every id, warm-up included, would make this rule
 * dead code, because the arrays could never match.
 */
export function historyWeight(id: string, history: HistoryEntry[]): number {
  const recent = history.slice(0, RECENT_WORKOUTS).flatMap((h) => h.mainExerciseIds);
  return recent.includes(id) ? 0.25 : 1;
}

/**
 * Argmax over per-item noise, not a probabilistic draw. Fresh scores land in
 * [0.5, 1.5) and recently used in [0.125, 0.375), so the ranges never overlap and
 * a fresh candidate always wins. The rng only separates equals.
 */
export function weightedPick<T extends { id: string }>(
  rng: Rng, items: T[], history: HistoryEntry[],
): T | undefined {
  let best: T | undefined;
  let bestScore = -1;
  for (const item of items) {
    const s = historyWeight(item.id, history) * (0.5 + rng());
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return best;
}

const mechanicRank = (e: Exercise): number => {
  if (e.mechanic === 'ballistic') return 0;
  if (e.mechanic === 'carry' || e.patterns[0] === 'core') return 2;
  return 1;
};

/**
 * Largest-remaining-group greedy. Always taking from the largest group that is not
 * the previous pattern is the standard complete strategy for this rearrangement
 * problem: if a valid ordering exists, this finds one. Ties break on mechanic rank,
 * which keeps ballistics early without letting that override the adjacency rule.
 *
 * The wrap-around matters because a circuit repeats: the last item of a round is
 * adjacent to the first item of the next. A final rotation fixes a collision there.
 */
export function orderCircuit(items: Exercise[]): Exercise[] {
  const groups = new Map<Pattern, Exercise[]>();
  for (const e of [...items].sort((a, b) => mechanicRank(a) - mechanicRank(b))) {
    const key = e.patterns[0];
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const out: Exercise[] = [];
  let last: Pattern | null = null;

  while (out.length < items.length) {
    const available = [...groups.entries()].filter(([, v]) => v.length > 0);
    const eligible = available.filter(([k]) => k !== last);
    const ranked = (eligible.length ? eligible : available).sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return mechanicRank(a[1][0]) - mechanicRank(b[1][0]);
    });
    const [key, list] = ranked[0];
    out.push(list.shift()!);
    last = key;
  }

  if (out.length > 2 && out[0].patterns[0] === out.at(-1)!.patterns[0]) {
    for (let i = 1; i < out.length - 1; i++) {
      if (out[i].patterns[0] === out[0].patterns[0]) continue;
      const rotated = [...out.slice(i), ...out.slice(0, i)];
      if (rotated[0].patterns[0] !== rotated.at(-1)!.patterns[0]) return rotated;
    }
  }

  return out;
}

export function selectCircuit(
  pool: Exercise[], req: WorkoutRequest, rng: Rng, history: HistoryEntry[], count: number,
): Exercise[] {
  const chosen: Exercise[] = [];
  const taken = new Set<string>();

  // One dedicated slot per requested pattern, in the order they were selected.
  for (const pattern of req.patterns) {
    if (chosen.length >= count) break;
    const primary = pool.filter((e) => !taken.has(e.id) && e.patterns[0] === pattern);
    const secondary = pool.filter((e) => !taken.has(e.id) && e.patterns.includes(pattern));
    const picked = weightedPick(rng, primary.length ? primary : secondary, history);
    if (picked) { chosen.push(picked); taken.add(picked.id); }
  }

  // Fill the rest, preferring whichever primary pattern is least represented, so
  // the set stays orderable rather than collapsing into four hinges.
  while (chosen.length < count) {
    const remaining = pool.filter((e) => !taken.has(e.id));
    if (remaining.length === 0) break;
    const used = new Map<Pattern, number>();
    for (const e of chosen) used.set(e.patterns[0], (used.get(e.patterns[0]) ?? 0) + 1);
    const fewest = Math.min(...remaining.map((e) => used.get(e.patterns[0]) ?? 0));
    const candidates = remaining.filter((e) => (used.get(e.patterns[0]) ?? 0) === fewest);
    const picked = weightedPick(rng, candidates, history);
    if (!picked) break;
    chosen.push(picked); taken.add(picked.id);
  }

  return orderCircuit(chosen);
}

export function selectStrength(
  pool: Exercise[], rng: Rng, history: HistoryEntry[], count: number,
): Exercise[] {
  const grinds = pool.filter((e) => e.mechanic === 'grind');
  const primary = weightedPick(rng, grinds.length ? grinds : pool, history);
  if (!primary) return [];

  const chosen = [primary];
  const taken = new Set([primary.id]);
  const usedPatterns = new Set<Pattern>([primary.patterns[0]]);

  while (chosen.length < count) {
    const remaining = pool.filter((e) => !taken.has(e.id));
    if (remaining.length === 0) break;
    const fresh = remaining.filter((e) => !usedPatterns.has(e.patterns[0]));
    const picked = weightedPick(rng, fresh.length ? fresh : remaining, history);
    if (!picked) break;
    chosen.push(picked); taken.add(picked.id); usedPatterns.add(picked.patterns[0]);
  }

  return chosen;
}

export function selectCombos(
  combos: Combo[], rng: Rng, history: HistoryEntry[], count: number,
): Combo[] {
  const chosen: Combo[] = [];
  const taken = new Set<string>();
  while (chosen.length < count) {
    const picked = weightedPick(rng, combos.filter((c) => !taken.has(c.id)), history);
    if (!picked) break;
    chosen.push(picked); taken.add(picked.id);
  }
  return chosen;
}
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS, including the 2,000-case ordering fuzz.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: select the main work, with a complete circuit ordering"
```

---

### Task 9: Planning items, fitting and flattening

**Files:**
- Create: `src/lib/flatten.ts`, `src/lib/fit.ts`
- Test: `tests/flatten.test.ts`, `tests/fit.test.ts`

**Interfaces:**
- Consumes: `prescribe`, `estimateWork` from Task 7; `resolveBell` from Task 4
- Produces: `PlannedItem`, `BlockPlan`, `planItems`, `buildSteps`, `roundDuration`, `blockSeconds`, `deviation`, `trimToBudget`

Two corrections live here.

**The rest leak.** The previous `buildSteps` emitted a between-rounds rest after
every round including the last, and the trailing-rest trim only fired at the very
end of the whole list. Because Cool-down follows Main, the Main block's final rest
survived, so every workout ran longer than the fit had budgeted for. The
single-block test fixture hid it completely.

**Unilateral expansion.** Unilateral exercises are expanded into two planned items
here, one per side, rather than being doubled in the estimate. That makes
`blockSeconds` exactly equal to the sum of the emitted steps, which is what lets
the generator trust its own arithmetic.

- [ ] **Step 1: Write the failing tests**

`tests/flatten.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSteps, planItems, type BlockPlan } from '@/lib/flatten';
import { blockSeconds } from '@/lib/fit';
import { ex, kit, FULL_KIT } from './fixtures';
import type { WorkStep } from '@/lib/types';

const item = (id: string, est: number, rest: number) => ({
  exercise: ex(id), bellKg: 16, reps: 10, restSeconds: rest, estSeconds: est,
});

const plan: BlockPlan = {
  block: 'Main', rounds: 2, betweenRoundsRest: 60,
  items: [item('a', 20, 30), item('b', 20, 30)],
};

describe('planItems', () => {
  it('emits one item for a bilateral exercise', () => {
    expect(planItems(ex('a'), FULL_KIT, 'circuit', 'normal')).toHaveLength(1);
  });

  it('emits one item per side for a unilateral exercise', () => {
    const out = planItems(ex('u', { unilateral: true }), FULL_KIT, 'circuit', 'normal');
    expect(out.map((i) => i.side)).toEqual(['left', 'right']);
    expect(out[0].estSeconds).toBe(out[1].estSeconds);
  });

  it('gives a bodyweight move no bell', () => {
    expect(planItems(ex('w', { bells: 0 }), FULL_KIT, 'circuit', 'normal')[0].bellKg).toBeNull();
  });

  it('resolves the bell from the load band', () => {
    expect(planItems(ex('h', { loadBand: 'heavy' }), FULL_KIT, 'circuit', 'normal')[0].bellKg).toBe(32);
    expect(planItems(ex('l', { loadBand: 'light' }), FULL_KIT, 'circuit', 'normal')[0].bellKg).toBe(16);
  });

  it('returns no items when the kit has no bell for a loaded exercise', () => {
    expect(planItems(ex('a'), kit({ bells: [] }), 'circuit', 'normal')).toEqual([]);
  });
});

describe('buildSteps', () => {
  const steps = buildSteps([plan]);

  it('runs every item in every round', () => {
    const names = steps.filter((s): s is WorkStep => s.kind === 'work').map((s) => s.name);
    expect(names).toEqual(['A', 'B', 'A', 'B']);
  });

  it('never ends on a rest', () => {
    expect(steps.at(-1)!.kind).toBe('work');
  });

  it('uses the between-rounds rest at the end of a round, but never after the last', () => {
    expect(steps.filter((s) => s.kind === 'rest').map((s) => s.seconds)).toEqual([30, 60, 30]);
  });

  it('does not leak a rest across a block boundary', () => {
    const two = buildSteps([
      { ...plan, block: 'Main' },
      { block: 'Cool-down', rounds: 1, betweenRoundsRest: 0, items: [item('z', 30, 10)] },
    ]);
    const idx = two.findIndex((s) => s.block === 'Cool-down');
    expect(two[idx - 1].kind).toBe('rest');
    // The rest before the boundary is an item rest, not the Main block's round rest.
    const boundary = two[idx - 1];
    expect(boundary.kind === 'rest' && boundary.seconds).toBe(30);
  });

  it('names what comes next on every rest, across blocks', () => {
    const two = buildSteps([
      { block: 'Warm-up', rounds: 1, betweenRoundsRest: 0, items: [item('a', 30, 15)] },
      { block: 'Main', rounds: 1, betweenRoundsRest: 0, items: [item('z', 20, 30)] },
    ]);
    const rest = two.find((s) => s.kind === 'rest');
    expect(rest && rest.kind === 'rest' && rest.nextName).toBe('Z');
  });

  it('records the position within the round', () => {
    const first = steps[0] as WorkStep;
    expect([first.round, first.totalRounds, first.indexInRound, first.itemsInRound]).toEqual([1, 2, 1, 2]);
  });

  it('carries the side onto the step', () => {
    const uni = buildSteps([{
      block: 'Main', rounds: 1, betweenRoundsRest: 0,
      items: planItems(ex('u', { unilateral: true }), FULL_KIT, 'circuit', 'normal'),
    }]);
    expect(uni.filter((s): s is WorkStep => s.kind === 'work').map((s) => s.side)).toEqual(['left', 'right']);
  });

  it('skips a block with no items', () => {
    expect(buildSteps([{ block: 'Main', rounds: 2, betweenRoundsRest: 60, items: [] }])).toEqual([]);
  });

  it('agrees exactly with blockSeconds', () => {
    const total = buildSteps([plan]).reduce((a, s) => a + s.estSeconds, 0);
    expect(total).toBe(blockSeconds(plan));
  });
});
```

`tests/fit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { roundDuration, blockSeconds, deviation, trimToBudget } from '@/lib/fit';
import { ex } from './fixtures';
import type { BlockPlan } from '@/lib/flatten';

const item = (est: number, rest: number) => ({
  exercise: ex('a'), bellKg: 16, reps: 10, restSeconds: rest, estSeconds: est,
});

describe('roundDuration', () => {
  it('sums the work and the rests between items, but not after the last', () => {
    expect(roundDuration([item(30, 20), item(30, 20), item(30, 20)])).toBe(130);
  });

  it('handles a single item', () => {
    expect(roundDuration([item(30, 20)])).toBe(30);
  });

  it('respects a rest that varies between items', () => {
    expect(roundDuration([item(10, 5), item(10, 40), item(10, 99)])).toBe(75);
  });
});

describe('blockSeconds', () => {
  it('counts the between-rounds rests, one fewer than the rounds', () => {
    const plan: BlockPlan = { block: 'Main', rounds: 3, betweenRoundsRest: 60, items: [item(30, 20), item(30, 20)] };
    expect(blockSeconds(plan)).toBe(3 * 80 + 2 * 60);
  });

  it('is zero for an empty block', () => {
    expect(blockSeconds({ block: 'Main', rounds: 3, betweenRoundsRest: 60, items: [] })).toBe(0);
  });
});

describe('deviation', () => {
  it('is a fraction of the target', () => {
    expect(deviation(110, 100)).toBeCloseTo(0.1);
    expect(deviation(90, 100)).toBeCloseTo(0.1);
  });
});

describe('trimToBudget', () => {
  const plan: BlockPlan = { block: 'Main', rounds: 4, betweenRoundsRest: 75, items: [item(30, 20), item(30, 20)] };

  it('closes the residual on the between-rounds rest', () => {
    const target = 4 * 80 + 3 * 100;              // wants a 100s round rest
    expect(trimToBudget(plan, target).betweenRoundsRest).toBe(100);
  });

  it('clamps the rest to a sane band', () => {
    expect(trimToBudget(plan, 10_000).betweenRoundsRest).toBe(180);
    expect(trimToBudget(plan, 100).betweenRoundsRest).toBe(30);
  });

  it('leaves a single-round block alone, because there is no knob', () => {
    const single = { ...plan, rounds: 1 };
    expect(trimToBudget(single, 9999)).toEqual(single);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- flatten fit`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/flatten.ts`:

```ts
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
 */
export function planItems(
  exercise: Exercise, kit: KitProfile, format: Format, effort: Effort,
  bandOverride?: Exercise['loadBand'],
): PlannedItem[] {
  const bellKg = exercise.bells === 0 ? null : resolveBell(bandOverride ?? exercise.loadBand, kit);
  if (exercise.bells > 0 && bellKg === null) return [];

  const p = prescribe(exercise, format, effort, kit);
  const base = {
    exercise, bellKg, reps: p.reps, seconds: p.seconds,
    restSeconds: p.restSeconds, estSeconds: estimateWork(exercise, p),
  };

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
        // No rest after the final item of the final round. Emitting one here is
        // what previously leaked a whole round rest across the block boundary and
        // broke every time estimate.
        const rest = lastOfRound ? (lastRound ? 0 : plan.betweenRoundsRest) : item.restSeconds;
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
```

`src/lib/fit.ts`:

```ts
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
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "fix: stop the round rest leaking across block boundaries; expand unilateral work"
```

---

### Task 10: The generator, and the invariant suite

**Files:**
- Create: `src/lib/generate.ts`
- Test: `tests/generate.test.ts`

**Interfaces:**
- Consumes: Tasks 3 to 9
- Produces: `GenerateInput`, `generate(input): Workout`

The whole engine behind one pure function. The fitting strategy is the corrected
one from spec 4.5: build the ancillary blocks first, then search rounds and item
counts together and rank on pattern coverage before time.

> **CORRECTION, applied before implementation on 2026-08-25.** An earlier version of
> this task scored each candidate on `blockSeconds(mainPlan)` against a target derived
> as `total - blockSeconds(warm) - blockSeconds(cool)`. That is a parallel arithmetic
> that drifts from what `buildSteps` actually emits: the two agree exactly within one
> block, but across three blocks they differ by the sum of the boundary item rests,
> measured at 45 seconds on a realistic plan, always running LONG.
>
> Maintaining a second way to compute the same number is precisely the class of bug
> that made the original engine miss its budget by up to 57%. So the search now costs
> the WHOLE workout by calling `buildSteps` on the full three-block candidate and
> summing `estSeconds` — the same number the returned `Workout` reports. The search
> space is at most 5 counts times 12 rounds, so the cost is negligible and the
> estimate is correct by construction rather than by agreement.

`shortOfBudget` is an honest escape hatch. A 60-minute complex genuinely cannot be
filled by any sane number of rounds of a three-move chain. Rather than lie, the
workout carries the flag and the Preview screen states the real figure.

- [ ] **Step 1: Write the failing invariant suite**

`tests/generate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generate } from '@/lib/generate';
import { capabilityRank, type Capability, type Format, type Pattern, type WorkStep, type WorkoutRequest } from '@/lib/types';
import { FIXTURE_EXERCISES, FIXTURE_COMBOS, FULL_KIT, HOME_KIT, entry, req } from './fixtures';
import type { HistoryEntry, KitProfile } from '@/lib/types';

const NOW = '2026-08-25T09:00:00.000Z';
const ALL: Pattern[] = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'];

const run = (over: Partial<WorkoutRequest> = {}, kit: KitProfile = FULL_KIT, history: HistoryEntry[] = []) =>
  generate({
    request: req({ capability: 'advanced', ...over }),
    kit, exercises: FIXTURE_EXERCISES, combos: FIXTURE_COMBOS, history, now: NOW,
  });

const work = (w: ReturnType<typeof run>) => w.steps.filter((s): s is WorkStep => s.kind === 'work');
const mainWork = (w: ReturnType<typeof run>) => work(w).filter((s) => s.block === 'Main');
const byId = (id: string) => FIXTURE_EXERCISES.find((e) => e.id === id)!;

/** A chosen matrix rather than a brute-force sweep, so a failure names itself. */
const MATRIX: Partial<WorkoutRequest>[] = [];
for (const totalMinutes of [15, 20, 30, 45, 60] as const)
  for (const format of ['auto', 'circuit', 'complex', 'strength'] as Array<'auto' | Format>)
    for (const effort of ['easy', 'normal', 'hard'] as const)
      MATRIX.push({ totalMinutes, format, effort, patterns: ALL, seed: totalMinutes + format.length });
for (const patterns of [['hinge'], ['push', 'pull'], ['hinge', 'squat', 'push']] as Pattern[][])
  for (const seed of [1, 2, 3])
    MATRIX.push({ patterns, seed });

const label = (o: Partial<WorkoutRequest>) =>
  `${o.totalMinutes ?? 30}min ${o.format ?? 'auto'} ${o.effort ?? 'normal'} [${(o.patterns ?? []).join(',')}] seed ${o.seed}`;

describe('generate: hard invariants', () => {
  it.each(MATRIX.map((o) => [label(o), o] as const))('%s', (_l, o) => {
    const w = run(o);
    const owned = new Set([16, 24, 32]);

    // 1. Never prescribes a bell absent from the kit.
    for (const s of work(w)) if (s.bellKg !== null) expect(owned).toContain(s.bellKg);

    // 7. Never exceeds the requested capability.
    for (const s of work(w)) {
      expect(capabilityRank(byId(s.exerciseId).capability))
        .toBeLessThanOrEqual(capabilityRank(w.request.capability));
    }

    // 11. Warm-up, then main, then cool-down, and no rest leaks across a boundary.
    const rank = { 'Warm-up': 0, Main: 1, 'Cool-down': 2 } as const;
    const blocks = w.steps.map((s) => s.block);
    for (let i = 1; i < blocks.length; i++) {
      expect(rank[blocks[i]]).toBeGreaterThanOrEqual(rank[blocks[i - 1]]);
    }
    for (let i = 1; i < w.steps.length; i++) {
      if (w.steps[i].block !== w.steps[i - 1].block) expect(w.steps[i - 1].kind).toBe('work');
    }

    // 13. The reported format is the format actually built.
    if (w.request.format !== 'auto' && !w.shortOfBudget) {
      expect(['circuit', 'complex', 'strength']).toContain(w.format);
    }

    expect(w.steps.at(-1)!.kind).toBe('work');
    expect(mainWork(w).length).toBeGreaterThan(0);
    expect(w.estimatedSeconds).toBe(w.steps.reduce((a, s) => a + s.estSeconds, 0));
  });
});

describe('generate: invariant 5, the time budget', () => {
  it.each(MATRIX.map((o) => [label(o), o] as const))('%s lands on time or says it cannot', (_l, o) => {
    const w = run(o);
    const target = w.request.totalMinutes * 60;
    const dev = Math.abs(w.estimatedSeconds - target) / target;
    if (!w.shortOfBudget) expect(dev).toBeLessThanOrEqual(0.1);
    else expect(dev).toBeGreaterThan(0.1); // the flag must not be set gratuitously
  });

  it('fills every auto-format session to within ten per cent', () => {
    for (const totalMinutes of [15, 20, 30, 45, 60] as const) {
      for (const seed of [1, 2, 3]) {
        const w = run({ totalMinutes, format: 'auto', patterns: ALL, seed });
        expect(w.shortOfBudget, `${totalMinutes}min seed ${seed}`).toBe(false);
      }
    }
  });
});

describe('generate: kit invariants', () => {
  it('never selects a two-bell exercise without a matched pair', () => {
    for (const o of MATRIX) for (const s of work(run(o, HOME_KIT))) expect(byId(s.exerciseId).bells).toBeLessThan(2);
  });

  it('never selects a bench exercise without a bench', () => {
    for (const o of MATRIX) for (const s of work(run(o, HOME_KIT))) expect(byId(s.exerciseId).needsBench).toBe(false);
  });

  it('flags a kit that cannot separate the load bands', () => {
    expect(run({}, HOME_KIT).loadWarning).toBe(true);
    expect(run({}, FULL_KIT).loadWarning).toBe(false);
  });

  it('gives an empty kit a bodyweight session with no bells', () => {
    const empty: KitProfile = { id: 'home', name: 'Home', bells: [], hasBench: false };
    for (const s of work(run({}, empty))) expect(s.bellKg).toBeNull();
  });
});

describe('generate: circuit invariants', () => {
  it('covers every requested pattern', () => {
    for (const patterns of [['hinge'], ['push', 'pull'], ALL] as Pattern[][]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const covered = new Set(mainWork(run({ patterns, format: 'circuit', seed }))
          .flatMap((s) => byId(s.exerciseId).patterns));
        for (const p of patterns) expect(covered, `${patterns} seed ${seed}`).toContain(p);
      }
    }
  });

  it('never places two exercises sharing a primary pattern back to back, wrap included', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const steps = mainWork(run({ format: 'circuit', patterns: ALL, seed }));
      const n = steps[0].itemsInRound;
      const round = steps.slice(0, n).map((s) => byId(s.exerciseId).patterns[0]);
      for (let i = 1; i < round.length; i++) expect(round[i], `seed ${seed}`).not.toBe(round[i - 1]);
      if (steps[0].totalRounds > 1) expect(round.at(-1)).not.toBe(round[0]);
    }
  });
});

describe('generate: unilateral work', () => {
  it('emits one step per side', () => {
    const w = run({ patterns: ['squat'], format: 'circuit', capability: 'advanced', seed: 5 });
    for (const s of mainWork(w)) {
      if (!byId(s.exerciseId).unilateral) continue;
      expect(['left', 'right']).toContain(s.side);
    }
    const uni = mainWork(w).filter((s) => byId(s.exerciseId).unilateral);
    if (uni.length) expect(uni.filter((s) => s.side === 'left')).toHaveLength(uni.length / 2);
  });
});

describe('generate: determinism and variety', () => {
  it('produces the same workout for the same seed', () => {
    expect(run({ seed: 7 })).toEqual(run({ seed: 7 }));
  });

  it('produces a different workout for a different seed', () => {
    const ids = (s: number) => mainWork(run({ seed: s })).map((x) => x.exerciseId).join();
    expect(ids(7)).not.toBe(ids(8));
  });

  it('avoids repeating the previous main set, using the ids the runner writes', () => {
    const first = run({ seed: 12, format: 'circuit' });
    const mainIds = [...new Set(mainWork(first).map((s) => s.exerciseId))].sort();
    // Built the way the runner builds it: every work id, plus main ids separately.
    const history = [entry({
      workout: first,
      mainExerciseIds: mainIds,
    })];
    const second = run({ seed: 12, format: 'circuit' }, FULL_KIT, history);
    const nextIds = [...new Set(mainWork(second).map((s) => s.exerciseId))].sort();
    expect(nextIds).not.toEqual(mainIds);
  });
});

describe('generate: degraded inputs', () => {
  it('still returns a workout when nothing has an image', () => {
    const blind = FIXTURE_EXERCISES.map((e) => ({ ...e, image: null }));
    const w = generate({ request: req(), kit: FULL_KIT, exercises: blind, combos: FIXTURE_COMBOS, history: [], now: NOW });
    expect(w.steps.length).toBeGreaterThan(0);
  });

  it('falls back to a circuit and says so when a complex was asked for but none fits', () => {
    const w = generate({
      request: req({ format: 'complex' }), kit: FULL_KIT,
      exercises: FIXTURE_EXERCISES, combos: [], history: [], now: NOW,
    });
    expect(w.format).toBe('circuit');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- generate`
Expected: FAIL, cannot resolve `@/lib/generate`.

- [ ] **Step 3: Implement**

`src/lib/generate.ts`:

```ts
import type {
  Combo, Exercise, Format, HistoryEntry, KitProfile, Pattern, Workout, WorkoutRequest,
} from '@/lib/types';
import { createRng, shuffle } from '@/lib/rng';
import { isUnderSpecified } from '@/lib/kit';
import { cooldownPool, filterCombos, filterPool, warmupPool } from '@/lib/pool';
import { budget } from '@/lib/budget';
import { chooseFormat } from '@/lib/format';
import { selectCircuit, selectCombos, selectStrength } from '@/lib/select';
import { betweenRoundsRest, prescribe, estimateWork } from '@/lib/prescribe';
import { blockSeconds, deviation, roundDuration, trimToBudget } from '@/lib/fit';
import { buildSteps, planItems, type BlockPlan, type PlannedItem } from '@/lib/flatten';

export interface GenerateInput {
  request: WorkoutRequest;
  kit: KitProfile;
  exercises: Exercise[];
  combos: Combo[];
  history: HistoryEntry[];
  now: string;
}

const TOLERANCE = 0.1;
const ANCILLARY_CAP = 8;

const SEARCH: Record<Format, { counts: number[]; rounds: number[] }> = {
  circuit:  { counts: [3, 4, 5, 6, 7], rounds: range(1, 12) },
  strength: { counts: [3, 4, 5],       rounds: range(2, 6) },
  complex:  { counts: [1, 2],          rounds: range(1, 12) },
};

function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

const coveredCount = (items: Exercise[], patterns: Pattern[]): number =>
  patterns.filter((p) => items.some((e) => e.patterns.includes(p))).length;

/**
 * Fill an ancillary block from its pool, stopping at whichever item count sits
 * closest to the nominal budget. It does not have to hit that budget: the caller
 * measures what it actually cost and hands the remainder to the main block, so a
 * short warm-up pool lengthens the main work rather than shortening the session.
 */
function buildAncillary(
  pool: Exercise[], kit: KitProfile, block: 'Warm-up' | 'Cool-down',
  budgetSeconds: number, restSeconds: number, effort: WorkoutRequest['effort'], seed: number,
): BlockPlan {
  const items: PlannedItem[] = [];
  let used = 0;

  for (const e of shuffle(createRng(seed), pool)) {
    if (items.length >= ANCILLARY_CAP) break;
    const p = prescribe(e, 'circuit', effort, kit);
    const work = estimateWork(e, p) * (e.unilateral ? 2 : 1);
    const projected = items.length === 0 ? work : used + restSeconds + work;
    if (items.length > 0 && Math.abs(projected - budgetSeconds) >= Math.abs(used - budgetSeconds)) break;

    const planned = planItems(e, kit, 'circuit', effort, 'light');
    if (planned.length === 0) continue;
    items.push(...planned.map((i) => ({ ...i, restSeconds })));
    used = projected;
  }

  return { block, rounds: 1, betweenRoundsRest: 0, items };
}

interface Candidate { plan: BlockPlan; coverage: number; dev: number }

const better = (a: Candidate, b: Candidate | null): boolean =>
  b === null || a.coverage > b.coverage || (a.coverage === b.coverage && a.dev < b.dev);

/**
 * The true cost of a whole workout: what buildSteps will actually emit, summed.
 * Never sum blockSeconds across blocks — that misses the boundary rests and always
 * reads short.
 */
const wholeWorkoutSeconds = (plans: BlockPlan[]): number =>
  buildSteps(plans).reduce((a, s) => a + s.estSeconds, 0);

function buildMain(
  format: Format, pool: Exercise[], combos: Combo[], req: WorkoutRequest, kit: KitProfile,
  history: HistoryEntry[], target: number, seed: number,
  cost: (plan: BlockPlan) => number,
): { plan: BlockPlan; format: Format } {
  const search = SEARCH[format];
  const between = betweenRoundsRest(format, req.effort);
  let best: Candidate | null = null;

  for (const count of search.counts) {
    let exercises: Exercise[];
    let items: PlannedItem[];

    if (format === 'complex') {
      const chosen = selectCombos(combos, createRng(seed + count), history, count);
      if (chosen.length === 0) continue;
      exercises = chosen.flatMap((c) =>
        c.steps.map((s) => pool.find((e) => e.id === s.exerciseId)).filter((e): e is Exercise => !!e));
      items = chosen.flatMap((c) =>
        c.steps.flatMap((s) => {
          const e = pool.find((x) => x.id === s.exerciseId);
          if (!e) return [];
          return planItems({ ...e, defaultReps: s.reps }, kit, 'complex', req.effort, c.loadBand);
        }));
    } else {
      const rng = createRng(seed + count);
      exercises = format === 'strength'
        ? selectStrength(pool, rng, history, count)
        : selectCircuit(pool, req, rng, history, count);
      items = exercises.flatMap((e) => planItems(e, kit, format, req.effort));
    }

    if (items.length === 0) continue;
    const rd = roundDuration(items);
    const coverage = coveredCount(exercises, req.patterns);

    for (const rounds of search.rounds) {
      const plan: BlockPlan = { block: 'Main', rounds, betweenRoundsRest: between, items };
      // Cost the WHOLE workout, not this block in isolation.
      const candidate: Candidate = { plan, coverage, dev: deviation(cost(plan), target) };
      if (better(candidate, best)) best = candidate;
      if (rd * rounds > target * 1.5) break;   // no point searching further out
    }
  }

  if (!best) {
    return format === 'circuit'
      ? { plan: { block: 'Main', rounds: 1, betweenRoundsRest: between, items: [] }, format }
      : buildMain('circuit', pool, combos, req, kit, history, target, seed, cost);
  }

  // Trim on the between-rounds rest, then keep the trim only if it actually helped.
  // trimToBudget rounds to five seconds before clamping, so it can overshoot; and it
  // solves for the main block alone, which is not quite the whole-workout target.
  const trimmed = trimToBudget(best.plan, target - (cost(best.plan) - blockSeconds(best.plan)));
  const chosen = deviation(cost(trimmed), target) < deviation(cost(best.plan), target)
    ? trimmed
    : best.plan;

  return { plan: chosen, format };
}

const mainIdsOf = (plan: BlockPlan) => [...new Set(plan.items.map((i) => i.exercise.id))].sort();

export function generate(input: GenerateInput): Workout {
  const { request, kit, exercises, combos, history, now } = input;
  const total = request.totalMinutes * 60;
  const nominal = budget(request.totalMinutes);

  // Ancillary blocks first, so the main block can be given the true remainder.
  const warm = buildAncillary(
    warmupPool(exercises, kit), kit, 'Warm-up', nominal.warmupSeconds, 15, request.effort, request.seed + 101);
  const cool = buildAncillary(
    cooldownPool(exercises, kit), kit, 'Cool-down', nominal.cooldownSeconds, 10, request.effort, request.seed + 202);

  const pool = filterPool(exercises, request, kit);
  const usableCombos = filterCombos(combos, exercises, request, kit);
  const wanted = chooseFormat(request, usableCombos.length > 0);

  // Every candidate is costed as the whole workout it would produce.
  const cost = (plan: BlockPlan) => wholeWorkoutSeconds([warm, plan, cool]);

  let seed = request.seed;
  let built = buildMain(wanted, pool, usableCombos, request, kit, history, total, seed, cost);

  const previous = history[0] ? [...history[0].mainExerciseIds].sort() : null;
  for (let i = 0; i < 5 && previous && mainIdsOf(built.plan).join() === previous.join(); i++) {
    seed += 1;
    built = buildMain(wanted, pool, usableCombos, request, kit, history, total, seed, cost);
  }

  const steps = buildSteps([warm, built.plan, cool]);
  const estimatedSeconds = steps.reduce((a, s) => a + s.estSeconds, 0);

  return {
    id: `w-${seed}-${now}`,
    createdAt: now,
    request: { ...request, seed },
    format: built.format,
    steps,
    estimatedSeconds,
    loadWarning: isUnderSpecified(kit),
    shortOfBudget: deviation(estimatedSeconds, total) > TOLERANCE,
  };
}
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

If an auto-format session fails to fill its budget, the fault is the search space
in `SEARCH`, not the tolerance. Widen the round or count range. Do not loosen
`TOLERANCE`, and do not set `shortOfBudget` to hide a fixable miss.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add the generator with corrected budget fitting"
```

---

### Task 11: Storage

**Files:**
- Create: `src/lib/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_KIT_STATE`, `KitState` from Task 4
- Produces: `loadKits`, `saveKits`, `loadHistory`, `pushHistory`, `loadPrefs`, `savePrefs`, `loadActive`, `saveActive`, `clearActive`, `Prefs`, `ActiveState`

The only module in `src/lib` allowed to touch `window`. Three corrections from the
review live here: `activeId` is validated against the profiles that exist, prefs
are validated rather than spread over defaults, and every stored value carries a
version inside it so a shape change is discarded rather than crashing the runner.

- [ ] **Step 1: Write the failing test**

`tests/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadKits, saveKits, loadHistory, pushHistory, loadPrefs, savePrefs,
  loadActive, saveActive, clearActive,
} from '@/lib/storage';
import { entry, req } from './fixtures';
import type { Workout } from '@/lib/types';

const workout = { id: 'w', createdAt: 'now', request: req(), format: 'circuit',
  steps: [], estimatedSeconds: 0, loadWarning: false, shortOfBudget: false } as Workout;

beforeEach(() => localStorage.clear());

describe('kits', () => {
  it('returns two profiles and beginner capability when nothing is stored', () => {
    const s = loadKits();
    expect(s.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
    expect(s.activeId).toBe('home');
    expect(s.capability).toBe('beginner');
  });

  it('round-trips what it saved', () => {
    const s = loadKits();
    s.profiles[0].bells = [{ weightKg: 20, count: 2 }];
    s.capability = 'advanced';
    saveKits(s);
    expect(loadKits().profiles[0].bells[0].weightKg).toBe(20);
    expect(loadKits().capability).toBe('advanced');
  });

  it('falls back to the defaults when the stored value is corrupt', () => {
    localStorage.setItem('kb.kits.v1', '{not json');
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('discards a stored value from an older shape', () => {
    localStorage.setItem('kb.kits.v1', JSON.stringify({ v: 0, profiles: [], activeId: 'x' }));
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('repairs an activeId that names no existing profile', () => {
    localStorage.setItem('kb.kits.v1', JSON.stringify({
      ...loadKits(), activeId: 'gone',
    }));
    expect(loadKits().activeId).toBe('home');
  });
});

describe('history', () => {
  it('starts empty', () => expect(loadHistory()).toEqual([]));

  it('puts the newest entry first', () => {
    pushHistory(entry({ id: 'one' }));
    pushHistory(entry({ id: 'two' }));
    expect(loadHistory().map((h) => h.id)).toEqual(['two', 'one']);
  });

  it('keeps only the last thirty', () => {
    for (let i = 0; i < 35; i++) pushHistory(entry({ id: `e${i}` }));
    expect(loadHistory()).toHaveLength(30);
    expect(loadHistory()[0].id).toBe('e34');
  });

  it('keeps the whole workout, not a summary', () => {
    pushHistory(entry({ id: 'w1', workout }));
    expect(loadHistory()[0].workout.format).toBe('circuit');
  });
});

describe('prefs', () => {
  it('defaults to a sensible first workout', () => {
    const p = loadPrefs();
    expect(p.totalMinutes).toBe(30);
    expect(p.effort).toBe('normal');
    expect(p.patterns.length).toBeGreaterThan(0);
  });

  it('round-trips', () => {
    savePrefs({ patterns: ['pull'], effort: 'hard', totalMinutes: 45 });
    expect(loadPrefs().effort).toBe('hard');
  });

  it('rejects a stored empty pattern list rather than disabling the app', () => {
    localStorage.setItem('kb.prefs.v1', JSON.stringify({ v: 1, patterns: [], effort: 'normal', totalMinutes: 30 }));
    expect(loadPrefs().patterns.length).toBeGreaterThan(0);
  });
});

describe('active workout', () => {
  it('is null when nothing is in progress', () => expect(loadActive()).toBeNull());

  it('round-trips and clears', () => {
    saveActive({ v: 1, workout, stepIndex: 3, workedSeconds: 120, restEndsAt: null, pausedRemainingMs: null });
    expect(loadActive()?.stepIndex).toBe(3);
    clearActive();
    expect(loadActive()).toBeNull();
  });

  it('keeps an absolute rest deadline, not a counter', () => {
    saveActive({ v: 1, workout, stepIndex: 1, workedSeconds: 0, restEndsAt: 1_800_000_000_000, pausedRemainingMs: null });
    expect(loadActive()?.restEndsAt).toBe(1_800_000_000_000);
  });

  it('discards a stored value from an older shape', () => {
    localStorage.setItem('kb.active.v1', JSON.stringify({ workout, stepIndex: 2 }));
    expect(loadActive()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- storage`
Expected: FAIL, cannot resolve `@/lib/storage`.

- [ ] **Step 3: Implement**

`src/lib/storage.ts`:

```ts
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
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add versioned, self-repairing local storage"
```

---

### Task 12: Main exercise database

**Files:**
- Create: `src/lib/data/exercises.ts`
- Test: `tests/data-exercises.test.ts`

**Interfaces:**
- Produces: `EXERCISES: Exercise[]`, `byId(id)`

The 29 main bell exercises: the 15 kept from the supplied grid, plus the 14 in
batch 2 of `docs/image-brief.md`. Front Raise is dropped. Every `image` starts
`null`; Task 16 fills in the sliced ones.

This is the highest-risk content in the project. A wrong cue teaches an injury.
Take the form notes from `docs/image-brief.md` and do not invent them.

Set `imagePanels` honestly: the eight ballistics (swing, single-arm swing, clean,
snatch, high pull, push press, figure 8, windmill) need 2 or 3, because a still of
a swing at chest height is indistinguishable from a front raise. The Turkish
get-up needs 3 and is marked `capability: 'advanced'`.

- [ ] **Step 1: Write the failing integrity test**

`tests/data-exercises.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EXERCISES, byId } from '@/lib/data/exercises';
import { PATTERNS, CAPABILITIES } from '@/lib/types';

describe('main exercise database', () => {
  it('holds the 29 main exercises', () => {
    expect(EXERCISES).toHaveLength(29);
  });

  it('has unique kebab-case ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('uses only known patterns and capabilities, and names at least one pattern', () => {
    for (const e of EXERCISES) {
      expect(e.patterns.length).toBeGreaterThan(0);
      for (const p of e.patterns) expect(PATTERNS).toContain(p);
      expect(CAPABILITIES).toContain(e.capability);
    }
  });

  it('gives every exercise a way to be prescribed', () => {
    for (const e of EXERCISES) expect(e.defaultReps ?? e.defaultWorkSeconds).toBeDefined();
  });

  it('gives every exercise all three kinds of cue', () => {
    for (const e of EXERCISES) {
      expect(e.cues.setup.length, e.id).toBeGreaterThan(0);
      expect(e.cues.execution.length, e.id).toBeGreaterThan(0);
      expect(e.cues.mistakes.length, e.id).toBeGreaterThan(0);
    }
  });

  it('offers at least three candidates for every pattern', () => {
    for (const p of PATTERNS) {
      expect(EXERCISES.filter((e) => e.patterns.includes(p)).length, p).toBeGreaterThanOrEqual(3);
    }
  });

  it('marks none of them as ancillary', () => {
    for (const e of EXERCISES) {
      expect(e.warmupSuitable).toBe(false);
      expect(e.cooldownSuitable).toBe(false);
    }
  });

  it('gives every ballistic more than one panel, because one still cannot teach it', () => {
    for (const e of EXERCISES) {
      if (e.mechanic === 'ballistic') expect(e.imagePanels, e.id).toBeGreaterThan(1);
    }
  });

  it('has no Front Raise', () => expect(byId('front-raise')).toBeUndefined());

  it('includes all three carries', () => {
    for (const id of ['farmers-carry', 'suitcase-carry', 'racked-carry']) {
      expect(byId(id), id).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- data-exercises`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the database**

`src/lib/data/exercises.ts`, following this shape for all 29:

```ts
import type { Exercise } from '@/lib/types';

export const EXERCISES: Exercise[] = [
  {
    id: 'two-hand-swing',
    name: 'Two-Hand Swing',
    patterns: ['hinge'],
    capability: 'beginner',
    mechanic: 'ballistic',
    unilateral: false,
    bells: 1,
    loadBand: 'heavy',
    secondsPerRep: 2,
    defaultReps: 15,
    needsBench: false,
    warmupSuitable: false,
    cooldownSuitable: false,
    image: null,
    imagePanels: 2,
    cues: {
      setup: ['Bell a forearm’s length in front of your toes.', 'Shoulders back, spine long.'],
      execution: ['Hike the bell back past your knees.', 'Snap the hips through and stand tall.', 'Let the bell float, do not lift it.'],
      mistakes: ['Squatting instead of hinging.', 'Rounding the lower back at the bottom.', 'Leaning back at the top.'],
    },
  },
  {
    id: 'farmers-carry',
    name: "Farmer's Carry",
    patterns: ['carry', 'core'],
    capability: 'beginner',
    mechanic: 'carry',
    unilateral: false,
    bells: 2,
    loadBand: 'heavy',
    secondsPerRep: 0,
    defaultWorkSeconds: 40,
    needsBench: false,
    warmupSuitable: false,
    cooldownSuitable: false,
    image: null,
    imagePanels: 1,
    cues: {
      setup: ['A bell either side, handles in line with your feet.', 'Stand up with a flat back.'],
      execution: ['Walk tall with short, quiet steps.', 'Shoulders down and back.', 'Breathe steadily through the nose.'],
      mistakes: ['Shrugging the shoulders up.', 'Leaning back to counterbalance.', 'Holding the breath.'],
    },
  },
  // ...the remaining 27
];

export const byId = (id: string): Exercise | undefined => EXERCISES.find((e) => e.id === id);
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: seed the main exercise database"
```

---

### Task 13: Ancillary moves and combos

**Files:**
- Create: `src/lib/data/ancillary.ts`, `src/lib/data/combos.ts`
- Modify: `src/lib/data/exercises.ts` (re-export the combined list)
- Test: `tests/data-ancillary.test.ts`

**Interfaces:**
- Consumes: `EXERCISES` from Task 12
- Produces: `ANCILLARY: Exercise[]`, `ALL_EXERCISES: Exercise[]`, `COMBOS: Combo[]`

Twelve bodyweight warm-up and cool-down moves, `bells: 0`, `defaultWorkSeconds: 30`,
`image: null` and staying that way. They are rendered as a checklist, not as hero
cards, so they need no pictures.

Six combos, each governed by its weakest link, which is almost always the press.

- [ ] **Step 1: Write the failing test**

`tests/data-ancillary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ANCILLARY, ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { EXERCISES } from '@/lib/data/exercises';
import { capabilityRank } from '@/lib/types';

describe('ancillary moves', () => {
  it('holds twelve bodyweight moves', () => {
    expect(ANCILLARY).toHaveLength(12);
    for (const e of ANCILLARY) expect(e.bells).toBe(0);
  });

  it('flags each as warm-up or cool-down, never both, never neither', () => {
    for (const e of ANCILLARY) {
      expect(e.warmupSuitable !== e.cooldownSuitable, e.id).toBe(true);
    }
  });

  it('offers at least four of each', () => {
    expect(ANCILLARY.filter((e) => e.warmupSuitable).length).toBeGreaterThanOrEqual(4);
    expect(ANCILLARY.filter((e) => e.cooldownSuitable).length).toBeGreaterThanOrEqual(4);
  });

  it('prescribes every one in seconds', () => {
    for (const e of ANCILLARY) expect(e.defaultWorkSeconds).toBeDefined();
  });

  it('combines into one list with no id collisions', () => {
    expect(ALL_EXERCISES).toHaveLength(EXERCISES.length + ANCILLARY.length);
    expect(new Set(ALL_EXERCISES.map((e) => e.id)).size).toBe(ALL_EXERCISES.length);
  });
});

describe('combos', () => {
  it('holds at least six chains of at least two moves', () => {
    expect(COMBOS.length).toBeGreaterThanOrEqual(6);
    for (const c of COMBOS) expect(c.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('only references real main exercises', () => {
    for (const c of COMBOS) {
      for (const s of c.steps) {
        expect(EXERCISES.some((e) => e.id === s.exerciseId), `${c.id} -> ${s.exerciseId}`).toBe(true);
      }
    }
  });

  it('never chains an exercise above the combo capability', () => {
    for (const c of COMBOS) {
      for (const s of c.steps) {
        const e = EXERCISES.find((x) => x.id === s.exerciseId)!;
        expect(capabilityRank(e.capability), `${c.id} -> ${e.id}`).toBeLessThanOrEqual(capabilityRank(c.capability));
      }
    }
  });

  it('loads to the weakest link, so no combo containing a press is heavy', () => {
    for (const c of COMBOS) {
      const hasPress = c.steps.some((s) => s.exerciseId.includes('press'));
      if (hasPress) expect(c.loadBand, c.id).not.toBe('heavy');
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- data-ancillary`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the data**

`src/lib/data/ancillary.ts`:

```ts
import type { Exercise } from '@/lib/types';
import { EXERCISES } from '@/lib/data/exercises';

const move = (
  id: string, name: string, kind: 'warmup' | 'cooldown', cues: Exercise['cues'],
): Exercise => ({
  id, name, patterns: ['core'], capability: 'beginner', mechanic: 'grind',
  unilateral: false, bells: 0, loadBand: 'light', secondsPerRep: 0, defaultWorkSeconds: 30,
  needsBench: false,
  warmupSuitable: kind === 'warmup',
  cooldownSuitable: kind === 'cooldown',
  image: null, imagePanels: 1, cues,
});

/** Rendered as a checklist, not as hero cards, so these never need pictures. */
export const ANCILLARY: Exercise[] = [
  move('hip-circles', 'Hip Circles', 'warmup', {
    setup: ['Stand tall, hands on hips.'],
    execution: ['Draw slow circles with the hips, both directions.'],
    mistakes: ['Rushing. Slow is the point.'],
  }),
  // ...eleven more: leg swings, cat-cow, world's greatest stretch, arm circles,
  // bodyweight squat, glute bridge (warm-up); couch stretch, standing hamstring
  // stretch, child's pose, seated thoracic twist, doorway chest stretch (cool-down).
];

export const ALL_EXERCISES: Exercise[] = [...EXERCISES, ...ANCILLARY];
```

`src/lib/data/combos.ts`:

```ts
import type { Combo } from '@/lib/types';

export const COMBOS: Combo[] = [
  {
    id: 'clean-press-squat',
    name: 'Clean, Press, Squat',
    capability: 'intermediate',
    bells: 1,
    perSide: true,
    loadBand: 'light',        // the press governs; a swing-weight bell will not press
    steps: [
      { exerciseId: 'kettlebell-clean', reps: 3 },
      { exerciseId: 'overhead-press', reps: 3 },
      { exerciseId: 'racked-front-squat', reps: 3 },
    ],
  },
  // ...at least five more
];
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add ancillary moves and combos"
```

---

### Task 14: The real database against the engine invariants

**Files:**
- Test: `tests/generate-real.test.ts`

**Interfaces:**
- Consumes: `generate` from Task 10, `ALL_EXERCISES` and `COMBOS` from Task 13

Task 10 proved the engine against a synthetic database built to exercise it. This
proves the real database is rich enough for the engine to work on. Separating them
is deliberate: run the engine tests against real data and a thin database makes
them fail, and the remedy becomes "add exercises until it goes green", which shapes
the database around a test rather than around kettlebell programming.

A failure here is a **data** problem. Add exercises or adjust `defaultReps`. Do not
touch `src/lib`.

- [ ] **Step 1: Write the failing test**

`tests/generate-real.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generate } from '@/lib/generate';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { FULL_KIT, HOME_KIT, req } from './fixtures';
import type { Pattern, WorkStep, WorkoutRequest } from '@/lib/types';

const NOW = '2026-08-25T09:00:00.000Z';
const ALL: Pattern[] = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'];

const run = (o: Partial<WorkoutRequest>, kit = FULL_KIT) =>
  generate({ request: req({ capability: 'advanced', ...o }), kit, exercises: ALL_EXERCISES, combos: COMBOS, history: [], now: NOW });

describe('the real database drives the engine', () => {
  it('fills every auto-format session to within ten per cent', () => {
    for (const totalMinutes of [15, 20, 30, 45, 60] as const) {
      for (const seed of [1, 2, 3]) {
        const w = run({ totalMinutes, patterns: ALL, format: 'auto', seed });
        expect(w.shortOfBudget, `${totalMinutes}min seed ${seed} -> ${w.estimatedSeconds}s`).toBe(false);
      }
    }
  });

  it('covers every pattern in a circuit, on both kits', () => {
    for (const kit of [FULL_KIT, HOME_KIT]) {
      const w = run({ patterns: ALL, format: 'circuit', seed: 3 }, kit);
      const covered = new Set(
        w.steps.filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Main')
          .flatMap((s) => ALL_EXERCISES.find((e) => e.id === s.exerciseId)!.patterns),
      );
      // A single-bell kit cannot do a farmer's carry, so carry may be uncoverable.
      for (const p of ALL.filter((x) => kit === FULL_KIT || x !== 'carry')) {
        expect(covered, `${kit.name} ${p}`).toContain(p);
      }
    }
  });

  it('builds a complex at every capability that has one', () => {
    for (const capability of ['intermediate', 'advanced'] as const) {
      const w = run({ capability, patterns: ['push'], format: 'complex', seed: 2 });
      expect(w.format, capability).toBe('complex');
    }
  });

  it('gives a beginner on a single bell a real session', () => {
    const w = run({ capability: 'beginner', patterns: ['hinge', 'squat'], totalMinutes: 20, seed: 1 }, HOME_KIT);
    expect(w.steps.filter((s) => s.kind === 'work' && s.block === 'Main').length).toBeGreaterThan(3);
    expect(w.loadWarning).toBe(true);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- generate-real`
Expected: it may fail. Fix the **database**, not the engine.

- [ ] **Step 3: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: assert the real database drives the engine within budget"
```

---

### Task 15: Slice the grid and wire up the media

**Files:**
- Create: `scripts/slice-grid.mts`, `scripts/check-media.mts`
- Modify: `src/lib/data/exercises.ts` (set `image` on the sliced entries)
- Create: `public/exercises/*.webp`
- Test: `tests/media.test.ts`

**Interfaces:**
- Consumes: `EXERCISES` from Task 12
- Produces: `npm run media:slice`, `npm run media:todo`

This runs **before** the exercise card is built, so the card is designed against
real assets and the background problem surfaces during design rather than during
the final audit.

Three corrections from the review. The naive 4×4 split is wrong: the sheet's labels
sit past their cell's row boundary, so a uniform grid puts each row's labels into
the next row's tile. The tiles are 184–237px, so they must never be upscaled. And
flattening onto white would put a pure white square inside every dark card.

- [ ] **Step 1: Install the tools**

```bash
npm install -D sharp tsx
```

Add scripts: `"media:slice": "tsx scripts/slice-grid.mts"`, `"media:todo": "tsx scripts/check-media.mts"`.

- [ ] **Step 2: Write the self-detecting slicer**

`scripts/slice-grid.mts`:

```ts
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SOURCE = 'media-source/grid-01.png';
const OUT = 'public/exercises';
const CARD = '#161618';          // --surface, so the still merges into its card
const WHITE_CUTOFF = 235;        // luminance above this counts as background
const MIN_FIGURE_PX = 60;        // taller than a label line, shorter than nothing

/** Reading order, left to right and top to bottom. `null` skips a tile. */
const TILES: (string | null)[] = [
  'two-hand-swing', 'goblet-squat', 'deadlift', 'clean-and-press',
  'front-lunge', 'sumo-deadlift', 'single-arm-swing', 'overhead-press',
  'russian-twist', 'step-up', 'bent-over-row', null,   // Front Raise is dropped
  'snatch', 'halo', 'reverse-lunge', 'squat-to-press',
];

/** Contiguous runs of non-background, merged across gaps of `gap` or fewer. */
function bands(profile: number[], gap: number): [number, number][] {
  const runs: [number, number][] = [];
  let start: number | null = null;
  profile.forEach((v, i) => {
    if (v > 0 && start === null) start = i;
    else if (v === 0 && start !== null) { runs.push([start, i - 1]); start = null; }
  });
  if (start !== null) runs.push([start, profile.length - 1]);

  const merged: [number, number][] = [];
  for (const b of runs) {
    const last = merged.at(-1);
    if (last && b[0] - last[1] <= gap) last[1] = b[1];
    else merged.push([...b] as [number, number]);
  }
  return merged;
}

const { data, info } = await sharp(SOURCE).greyscale().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const dark = (x: number, y: number) => data[y * width + x] < WHITE_CUTOFF;

// Columns first, then the figure bands within each column. The short bands are the
// printed labels; the tall ones are the figures. Detecting rather than assuming is
// the whole point: the labels do not sit inside their own row's cell.
const columns = bands(
  Array.from({ length: width }, (_, x) => {
    for (let y = 0; y < height; y += 3) if (dark(x, y)) return 1;
    return 0;
  }), 10,
).filter(([a, b]) => b - a > 40);

if (columns.length !== 4) throw new Error(`Expected 4 columns, found ${columns.length}`);

await mkdir(OUT, { recursive: true });

for (const [ci, [x0, x1]] of columns.entries()) {
  const rows = bands(
    Array.from({ length: height }, (_, y) => {
      for (let x = x0; x <= x1; x += 2) if (dark(x, y)) return 1;
      return 0;
    }), 6,
  ).filter(([a, b]) => b - a + 1 > MIN_FIGURE_PX);

  if (rows.length !== 4) throw new Error(`Column ${ci}: expected 4 figures, found ${rows.length}`);

  for (const [ri, [y0, y1]] of rows.entries()) {
    const id = TILES[ri * 4 + ci];
    if (!id) continue;
    const pad = 10;
    const left = Math.max(0, x0 - pad);
    const top = Math.max(0, y0 - pad);

    await sharp(SOURCE)
      .extract({
        left, top,
        width: Math.min(width - left, x1 - x0 + 1 + pad * 2),
        height: Math.min(height - top, y1 - y0 + 1 + pad * 2),
      })
      // Never enlarge. These tiles are ~200px; a crisp small image beats a soft
      // upscaled one, and CSS can scale it down on the card.
      .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: CARD })
      .webp({ quality: 92, effort: 6 })
      .toFile(`${OUT}/${id}.webp`);

    console.log(`wrote ${OUT}/${id}.webp`);
  }
}
```

- [ ] **Step 3: Run it and check every tile by eye**

```bash
npm run media:slice
```

Open all fifteen. Each must show one complete figure, no label text, and a dark
background. The script throws rather than guessing if the geometry does not match,
so a silent mis-slice is not possible; a wrong *mapping* still is, which is what
the next step tests.

- [ ] **Step 4: Write the failing media test**

`tests/media.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { EXERCISES, byId } from '@/lib/data/exercises';

const SLICED = [
  'two-hand-swing', 'goblet-squat', 'deadlift', 'clean-and-press',
  'front-lunge', 'sumo-deadlift', 'single-arm-swing', 'overhead-press',
  'russian-twist', 'step-up', 'bent-over-row',
  'snatch', 'halo', 'reverse-lunge', 'squat-to-press',
];

describe('exercise media', () => {
  it('maps every sliced tile to a real exercise', () => {
    for (const id of SLICED) expect(byId(id), id).toBeDefined();
  });

  it('points every non-null image at a file that exists', () => {
    for (const e of EXERCISES) {
      if (e.image === null) continue;
      expect(existsSync(`public${e.image}`), `${e.id} -> ${e.image}`).toBe(true);
    }
  });

  it('names images after their exercise id', () => {
    for (const e of EXERCISES) {
      if (e.image !== null) expect(e.image).toBe(`/exercises/${e.id}.webp`);
    }
  });

  it('has an image for all fifteen sliced exercises', () => {
    for (const id of SLICED) expect(byId(id)!.image, id).not.toBeNull();
  });
});
```

- [ ] **Step 5: Set the image paths**

In `src/lib/data/exercises.ts`, set `image: '/exercises/<id>.webp'` on those fifteen.
Leave the other fourteen `null`.

- [ ] **Step 6: Write the missing-media report**

`scripts/check-media.mts`:

```ts
import { EXERCISES } from '../src/lib/data/exercises.js';

const missing = EXERCISES.filter((e) => e.image === null);
console.log(`${EXERCISES.length - missing.length} of ${EXERCISES.length} exercises have an image.\n`);
if (missing.length === 0) console.log('Nothing left to shoot.');
else {
  console.log('Still to shoot:');
  for (const e of missing) console.log(`  ${e.id.padEnd(28)} ${e.name}  (${e.imagePanels} panel${e.imagePanels > 1 ? 's' : ''})`);
}
```

If `tsx` cannot resolve the `@/` alias from a standalone script, add
`"paths"` resolution via `tsx --tsconfig tsconfig.json`, or change the import in
`exercises.ts` to a relative one. Do not spend more than ten minutes on this; the
report is a convenience and `tests/media.test.ts` is the gate that matters.

- [ ] **Step 7: Verify**

Run: `npm run verify && npm run media:todo`
Expected: PASS, and a list of the fourteen still to shoot.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: slice the exercise grid onto the card background"
```

---

### Task 16: Design tokens and shared primitives

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/Button.tsx`, `Card.tsx`, `Chip.tsx`, `Ring.tsx`, `ProgressBar.tsx`
- Test: `tests/components/primitives.test.tsx`

**Interfaces:**
- Produces: `<Button>`, `<Card>`, `<Chip>`, `<Ring>`, `<ProgressBar>`

**Before writing any of this, invoke the `taste-skill` and `frontend-design`
skills.** The reference is the dark screenshot set supplied on 2026-08-25.

- [ ] **Step 1: Write the tokens**

Replace the body of `src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --bg: #0b0b0c;
  --surface: #161618;
  --surface-2: #1f1f22;
  --border: #2a2a2e;
  --text: #f5f5f6;
  --text-dim: #9a9aa1;      /* banned on the workout and rest screens */
  --accent: #ff4d1c;
  --accent-ink: #ffffff;
  --hinge: #f59e0b; --squat: #22c55e; --push: #3b82f6;
  --pull: #a855f7;  --carry: #06b6d4; --core: #ec4899;
  --radius: 20px;
  --tap: 44px;
}

html, body {
  background: var(--bg);
  color: var(--text);
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: none;
  min-height: 100dvh;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

In `layout.tsx`: `<html lang="en-GB">`, metadata title "Kettlebell", `viewport`
with `viewportFit: 'cover'`, and `padding-bottom: env(safe-area-inset-bottom)` on
the app shell so the Next button clears the home indicator.

- [ ] **Step 2: Write the failing test**

`tests/components/primitives.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ProgressBar } from '@/components/ProgressBar';
import { Ring } from '@/components/Ring';

describe('Button', () => {
  it('renders its label as a real button', () => {
    render(<Button>Start</Button>);
    screen.getByRole('button', { name: 'Start' });
  });

  it('marks itself disabled when asked', () => {
    render(<Button disabled>Start</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Chip', () => {
  it('reports its selected state to assistive technology', () => {
    render(<Chip tone="hinge" selected onClick={() => {}}>Hinge</Chip>);
    expect(screen.getByRole('button', { name: /Hinge/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the body parts under the pattern name', () => {
    render(<Chip tone="push" subtitle="shoulders, chest, triceps" onClick={() => {}}>Push</Chip>);
    screen.getByText('shoulders, chest, triceps');
  });
});

describe('ProgressBar', () => {
  it('exposes its position', () => {
    render(<ProgressBar value={3} max={10} label="Workout progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Workout progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
  });
});

describe('Ring', () => {
  it('reads its value out for assistive technology', () => {
    render(<Ring value={2} max={5} label="Workouts this week" caption="this week" />);
    screen.getByRole('img', { name: 'Workouts this week: 2 of 5' });
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm test -- primitives`
Expected: FAIL, components not found.

- [ ] **Step 4: Implement**

`src/components/Button.tsx`:

```tsx
'use client';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const STYLES: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)]',
  ghost: 'bg-[var(--surface-2)] text-[var(--text)]',
  danger: 'bg-transparent text-[var(--accent)] border border-[var(--border)]',
};

export function Button({
  variant = 'primary', fullWidth = true, className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; fullWidth?: boolean }) {
  return (
    <button
      {...rest}
      className={`min-h-[var(--tap)] rounded-[var(--radius)] px-6 py-4 text-base font-semibold
        transition-opacity active:opacity-80 disabled:opacity-40
        ${fullWidth ? 'w-full' : ''} ${STYLES[variant]} ${className}`}
    />
  );
}
```

`src/components/Chip.tsx`. `tone` is typed as `Pattern` so a typo cannot silently
produce `var(--hing)`, and the selected colour comes from a token, never a literal:

```tsx
'use client';
import type { ReactNode } from 'react';
import type { Pattern } from '@/lib/types';

export function Chip({
  children, tone, subtitle, selected = false, onClick,
}: {
  children: ReactNode; tone: Pattern; subtitle?: string; selected?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={selected ? { backgroundColor: `var(--${tone})`, color: 'var(--bg)' } : undefined}
      className="min-h-[var(--tap)] rounded-[var(--radius)] border border-[var(--border)]
        bg-[var(--surface-2)] px-4 py-2 text-left text-sm font-semibold text-[var(--text)]"
    >
      <span className="block">{children}</span>
      {subtitle && <span className="block text-xs font-normal opacity-70">{subtitle}</span>}
    </button>
  );
}
```

`src/components/ProgressBar.tsx`:

```tsx
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar" aria-label={label}
      aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
    >
      <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

`src/components/Card.tsx`:

```tsx
import type { ReactNode } from 'react';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}>
    {children}
  </div>
);
```

`src/components/Ring.tsx` draws an SVG circle with `stroke-dasharray` set from
`value / max`, the number large in the middle and the caption below. It carries
`role="img"` with `aria-label={`${label}: ${value} of ${max}`}`.

- [ ] **Step 5: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add design tokens and shared UI primitives"
```

---

### Task 17: Kit tab

**Files:**
- Create: `src/app/kit/page.tsx`, `src/components/KitEditor.tsx`
- Test: `tests/components/kit-editor.test.tsx`

**Interfaces:**
- Consumes: `loadKits`, `saveKits` from Task 11
- Produces: the `/kit` route

Two fixed profiles. No add, no delete, no rename. Bells go in as weight chips, not
a keyboard: this is the first thing a new user touches and bells come in fixed
sizes. Capability lives here too, because it changes over months rather than
sessions.

- [ ] **Step 1: Write the failing test**

`tests/components/kit-editor.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KitEditor } from '@/components/KitEditor';
import { loadKits } from '@/lib/storage';

beforeEach(() => localStorage.clear());

describe('KitEditor', () => {
  it('shows exactly two profiles and no way to add or delete one', () => {
    render(<KitEditor />);
    screen.getByRole('button', { name: /Home/ });
    screen.getByRole('button', { name: /Gym/ });
    expect(screen.queryByRole('button', { name: /add profile/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete profile/i })).toBeNull();
  });

  it('adds a bell from a weight chip and persists it', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 24 kg bell' }));
    screen.getByText('24 kg × 1');
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([{ weightKg: 24, count: 1 }]);
  });

  it('increments the count rather than duplicating the row', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 16 kg bell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a 16 kg bell' }));
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([{ weightKg: 16, count: 2 }]);
    screen.getByText('16 kg × 2');
  });

  it('removes a bell', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 16 kg bell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove a 16 kg bell' }));
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([]);
  });

  it('switches the active profile and edits that one', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Gym/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a 32 kg bell' }));
    expect(loadKits().activeId).toBe('gym');
    expect(loadKits().profiles.find((p) => p.id === 'gym')!.bells).toEqual([{ weightKg: 32, count: 1 }]);
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([]);
  });

  it('toggles the bench for the active profile', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('switch', { name: /bench/i }));
    expect(loadKits().profiles.find((p) => p.id === 'home')!.hasBench).toBe(true);
  });

  it('warns when the kit cannot separate the load bands', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 24 kg bell' }));
    expect(screen.getByRole('status').textContent).toMatch(/one bell|three different/i);
  });

  it('sets capability, which is stored not asked every session', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: /I can snatch and get up/i }));
    expect(loadKits().capability).toBe('advanced');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- kit-editor`
Expected: FAIL, component not found.

- [ ] **Step 3: Implement**

`src/components/KitEditor.tsx` is a client component holding `KitState`, hydrated
from `loadKits()` inside `useEffect` so server and client renders agree. Every
mutation writes through `saveKits`. It renders:

- two profile buttons, the active one filled with the accent, each labelled with
  its name and bell count
- a bench toggle with `role="switch"` and `aria-checked`
- the active profile's bells as rows reading "24 kg × 2", each with a remove button
  labelled "Remove a 24 kg bell"
- a row of weight chips `[8, 12, 16, 20, 24, 28, 32, 40]`, each labelled "Add a
  24 kg bell", incrementing the count when the weight is already present
- a `role="status"` line when `isUnderSpecified` is true, explaining that the loads
  cannot be scaled and the presses will be cut
- a capability control with three options phrased as ability, not as effort:
  "I'm starting out", "I'm comfortable with the basics", "I can snatch and get up"

`src/app/kit/page.tsx` renders a heading and `<KitEditor />`.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add the kit tab with two fixed profiles and capability"
```

---

### Task 18: Setup and preview

**Files:**
- Create: `src/app/workout/page.tsx`, `src/app/workout/preview/page.tsx`, `src/components/SetupForm.tsx`, `src/components/WorkoutPreview.tsx`
- Test: `tests/components/setup-form.test.tsx`, `tests/components/preview.test.tsx`

**Interfaces:**
- Consumes: `generate` from Task 10, storage from Task 11, `coverablePatterns` from Task 6
- Produces: the `/workout` and `/workout/preview` routes

The clock and the seed are read here, in the component, so `src/lib` stays pure.

- [ ] **Step 1: Write the failing tests**

`tests/components/setup-form.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupForm } from '@/components/SetupForm';
import { loadPrefs, loadKits, saveKits, loadActive } from '@/lib/storage';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const withBells = () => {
  const s = loadKits();
  s.profiles[0].bells = [{ weightKg: 16, count: 2 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 }];
  s.capability = 'advanced';
  saveKits(s);
};

beforeEach(() => { localStorage.clear(); push.mockClear(); withBells(); });

describe('SetupForm', () => {
  it('offers all six patterns with their body parts', () => {
    render(<SetupForm />);
    for (const p of ['Hinge', 'Squat', 'Push', 'Pull', 'Carry', 'Core']) screen.getByRole('button', { name: new RegExp(p) });
    screen.getByText(/shoulders, chest, triceps/);
  });

  it('offers a full body preset that ticks four patterns at once', () => {
    render(<SetupForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Full body' }));
    for (const p of ['Hinge', 'Squat', 'Push', 'Pull']) {
      expect(screen.getByRole('button', { name: new RegExp(p) })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('asks about effort today, not about capability', () => {
    render(<SetupForm />);
    for (const e of ['Easy', 'Normal', 'Hard']) screen.getByRole('button', { name: e });
    expect(screen.queryByRole('button', { name: /starting out/i })).toBeNull();
  });

  it('will not generate with no pattern selected', () => {
    render(<SetupForm />);
    for (const p of ['Hinge', 'Squat', 'Push']) fireEvent.click(screen.getByRole('button', { name: new RegExp(p) }));
    expect(screen.getByRole('button', { name: 'Generate workout' })).toBeDisabled();
  });

  it('warns when the active kit has no bells', () => {
    const s = loadKits(); s.profiles[0].bells = []; saveKits(s);
    render(<SetupForm />);
    expect(screen.getByRole('alert').textContent).toMatch(/add a bell/i);
  });

  it('warns when the pool cannot train a requested pattern', () => {
    const s = loadKits(); s.profiles[0].bells = [{ weightKg: 16, count: 1 }]; saveKits(s);
    render(<SetupForm />);
    fireEvent.click(screen.getByRole('button', { name: /Carry/ }));
    expect(screen.getByRole('status').textContent).toMatch(/carry/i);
  });

  it('saves the choices, stores the workout and moves to the preview', () => {
    render(<SetupForm />);
    fireEvent.click(screen.getByRole('button', { name: /Pull/ }));
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate workout' }));

    expect(loadPrefs().totalMinutes).toBe(45);
    expect(loadPrefs().patterns).toContain('pull');
    expect(loadActive()?.stepIndex).toBe(0);
    expect(push).toHaveBeenCalledWith('/workout/preview');
  });
});
```

`tests/components/preview.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutPreview } from '@/components/WorkoutPreview';
import { saveActive } from '@/lib/storage';
import { generate } from '@/lib/generate';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { FULL_KIT, HOME_KIT, req } from '../fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const build = (kit = FULL_KIT) => generate({
  request: req({ capability: 'advanced', patterns: ['hinge', 'squat', 'push'] }),
  kit, exercises: ALL_EXERCISES, combos: COMBOS, history: [], now: '2026-08-25T09:00:00.000Z',
});

beforeEach(() => localStorage.clear());

describe('WorkoutPreview', () => {
  it('leads with the bells to fetch', () => {
    const w = build();
    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    render(<WorkoutPreview />);
    expect(screen.getByText(/You'll need/).textContent).toMatch(/kg/);
  });

  it('states the real estimate against the request', () => {
    const w = build();
    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    render(<WorkoutPreview />);
    screen.getByText(new RegExp(`about ${Math.round(w.estimatedSeconds / 60)} min`, 'i'));
  });

  it('warns when the kit cannot separate the load bands', () => {
    const w = build(HOME_KIT);
    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    render(<WorkoutPreview />);
    expect(screen.getByRole('status').textContent).toMatch(/not scaled|cut the press/i);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- setup-form preview`
Expected: FAIL, components not found.

- [ ] **Step 3: Implement**

`SetupForm` hydrates from `loadPrefs()` and `loadKits()` in `useEffect`, and renders:

- the active kit as a chip linking to `/kit`
- a "Full body" preset button that selects hinge, squat, push and pull in one tap
- six pattern chips, each tinted with its token colour and subtitled with the body
  parts it trains: hinge "hamstrings, glutes, back"; squat "quads, glutes"; push
  "shoulders, chest, triceps"; pull "back, biceps"; carry "grip, core, shoulders";
  core "abs, obliques, spine"
- an effort control reading Easy / Normal / Hard
- time chips reading "15 min" through "60 min"
- a disclosure holding the format choice, defaulting to Auto
- a `role="status"` note naming any requested pattern the filtered pool cannot
  train, computed from `coverablePatterns`, **and** any pattern the chosen format
  has no slot for, with the format switch offered inline
- a `role="alert"` telling him to add a bell when the kit is empty
- a "Generate workout" button, disabled while no pattern is selected or the kit is
  empty

On submit it calls `savePrefs`, builds a request with `seed: Date.now()` and the
stored `capability`, calls `generate({ ..., now: new Date().toISOString() })`,
writes `saveActive({ v: 1, workout, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null })`,
then pushes `/workout/preview`.

`WorkoutPreview` reads the active state and renders, in this order:

1. **"You'll need: 16 kg, 24 kg. No bench."** derived from the distinct `bellKg`
   values across the steps. This is the line that saves a trip back indoors.
2. the format, and "about 27 min" against the 30 minutes requested, plus a plain
   sentence when `shortOfBudget` is true
3. a `role="status"` warning when `loadWarning` is true
4. every block listed with its exercises, bells and prescriptions, sides included
5. Regenerate, which re-runs `generate` with a fresh seed and names what changed,
   and Start workout, which pushes `/workout/run`

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add the setup and preview screens"
```

---

### Task 19: The exercise and rest cards

**Files:**
- Create: `src/components/ExerciseCard.tsx`, `src/components/RestCard.tsx`, `src/components/AncillaryChecklist.tsx`
- Test: `tests/components/cards.test.tsx`

**Interfaces:**
- Consumes: `Step`, `Exercise` from Task 2
- Produces: three presentational components, no state of their own

Split from the runner so they can be tested as pure functions of their props.

- [ ] **Step 1: Write the failing test**

`tests/components/cards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { RestCard } from '@/components/RestCard';
import { ex } from '../fixtures';
import type { WorkStep } from '@/lib/types';

const step = (over: Partial<WorkStep> = {}): WorkStep => ({
  kind: 'work', exerciseId: 'a', name: 'Two-Hand Swing', bellKg: 24, reps: 15,
  block: 'Main', round: 1, totalRounds: 3, indexInRound: 2, itemsInRound: 5, estSeconds: 30,
  ...over,
} as WorkStep);

describe('ExerciseCard', () => {
  it('shows the name, the bell and the prescription', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    screen.getByRole('heading', { name: 'Two-Hand Swing' });
    screen.getByText('24 kg');
    screen.getByText('15 reps');
  });

  it('names the side for unilateral work', () => {
    render(<ExerciseCard step={step({ side: 'left' })} exercise={ex('a')} />);
    screen.getByText(/left/i);
  });

  it('shows seconds for a carry', () => {
    render(<ExerciseCard step={step({ reps: undefined, seconds: 40 })} exercise={ex('a')} />);
    screen.getByText('40 seconds');
  });

  it('says bodyweight when there is no bell', () => {
    render(<ExerciseCard step={step({ bellKg: null })} exercise={ex('a', { bells: 0 })} />);
    screen.getByText(/bodyweight/i);
  });

  it('renders the image when there is one', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('a.webp'));
  });

  it('collapses the media slot and promotes the cues when there is no image', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: null })} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/no image/i)).toBeNull();   // no dashed placeholder
    screen.getByText('execute');                           // the cue is visible, not hidden
  });

  it('always shows the mistakes line, image or not', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    screen.getByText('mistake');
  });
});

describe('RestCard', () => {
  it('shows the countdown and what comes next', () => {
    render(<RestCard remainingSeconds={42} nextName="Goblet Squat" onSkip={() => {}} onAddTime={() => {}} />);
    screen.getByRole('heading', { name: 'Rest' });
    screen.getByText('0:42');
    screen.getByText('Next: Goblet Squat');
  });

  it('counts up past zero rather than vanishing', () => {
    render(<RestCard remainingSeconds={-24} nextName="Goblet Squat" onSkip={() => {}} onAddTime={() => {}} />);
    screen.getByText(/over by 0:24/i);
  });

  it('offers more rest as well as less', () => {
    render(<RestCard remainingSeconds={42} nextName="X" onSkip={() => {}} onAddTime={() => {}} />);
    screen.getByRole('button', { name: 'Skip rest' });
    screen.getByRole('button', { name: '+30s' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- cards`
Expected: FAIL, components not found.

- [ ] **Step 3: Implement**

`ExerciseCard` takes `{ step: WorkStep; exercise: Exercise }` and renders:

- the image, when `exercise.image` is set, on the card background. When it is
  `null` the slot **collapses entirely**: no dashed box, no reserved space. The
  cues become the content, at heading size.
- an `h1` with the name, and the side as a prominent label when `step.side` is set
- a bell badge reading "24 kg", or "Bodyweight" when `bellKg` is null
- the prescription: "15 reps", or "40 seconds"
- Setup, Execution and Watch out for. The mistakes line is always visible; the
  other two collapse behind a disclosure only when an image is present.
- No `--text-dim` anywhere on this component.

`RestCard` takes `{ remainingSeconds, nextName, onSkip, onAddTime }` and renders an
`h1` reading "Rest", the countdown as a very large number, "Next: …", and both
Skip rest and +30s. When `remainingSeconds` is negative it reads "Over by 0:24" in
the accent colour: the number he needed is how long he has actually been resting,
so it must not be discarded at zero.

`AncillaryChecklist` takes `{ steps, exercises, onDone }` and renders one
scrollable card listing every warm-up or cool-down move with its name, duration and
one line of cue, each with a tick. One card for the block, not one screen per move.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add the exercise, rest and checklist cards"
```

---

### Task 20: The workout runner

**Files:**
- Create: `src/app/workout/run/page.tsx`, `src/app/workout/done/page.tsx` (stub), `src/components/WorkoutRunner.tsx`, `src/lib/useWakeLock.ts`, `src/lib/useAudioCues.ts`, `public/audio/tick.mp3`, `public/audio/go.mp3`
- Test: `tests/components/workout-runner.test.tsx`

**Interfaces:**
- Consumes: storage from Task 11, cards from Task 19
- Produces: the `/workout/run` route

The `/workout/done` stub is created here, not in Task 21, because the runner pushes
to it and the app would otherwise be broken between two commits.

Everything the runner does is driven by the flat `Step[]`. It holds no programming
logic. The three corrections it must get right:

1. **The clock, not a counter.** `restEndsAt` is an absolute epoch millisecond
   value. `remaining` is derived from `Date.now()` on every tick and on every
   mount. iOS throttles intervals in backgrounded tabs, stops them when the screen
   dims, and evicts standalone webviews; a decremented counter drifts, stalls and
   resets to full. `workedSeconds` accumulates from clock deltas too, and runs on
   every step, not only on rests.
2. **Sound.** Three cues, unlocked by the Start tap.
3. **A way back.** Previous with no confirmation, and Exit split in two.

- [ ] **Step 1: Write the failing test**

`tests/components/workout-runner.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WorkoutRunner } from '@/components/WorkoutRunner';
import { saveActive, loadActive, loadHistory } from '@/lib/storage';
import type { Step, Workout } from '@/lib/types';
import { req } from '../fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const work = (name: string, over: Partial<Step> = {}): Step => ({
  kind: 'work', exerciseId: name.toLowerCase().replace(/ /g, '-'), name, bellKg: 16, reps: 10,
  block: 'Main', round: 1, totalRounds: 2, indexInRound: 1, itemsInRound: 1, estSeconds: 20, ...over,
} as Step);
const rest = (seconds: number, nextName: string): Step =>
  ({ kind: 'rest', seconds, nextName, block: 'Main', estSeconds: seconds });

const workout = (steps: Step[]): Workout => ({
  id: 'w1', createdAt: '2026-08-25T09:00:00.000Z', format: 'circuit', steps,
  estimatedSeconds: steps.reduce((a, s) => a + s.estSeconds, 0),
  request: req(), loadWarning: false, shortOfBudget: false,
});

const seed = (steps: Step[], stepIndex = 0) =>
  saveActive({ v: 1, workout: workout(steps), stepIndex, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });

const THREE = () => [work('Swing'), rest(30, 'Goblet Squat'), work('Goblet Squat')];

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T09:00:00.000Z'));
  seed(THREE());
});
afterEach(() => vi.useRealTimers());

describe('WorkoutRunner', () => {
  it('shows the first exercise, its bell and its prescription', () => {
    render(<WorkoutRunner />);
    screen.getByRole('heading', { name: 'Swing' });
    screen.getByText('16 kg');
    screen.getByText('10 reps');
  });

  it('advances on Next and saves the position', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    screen.getByText('Next: Goblet Squat');
    expect(loadActive()!.stepIndex).toBe(1);
  });

  it('goes back with no confirmation', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    screen.getByRole('heading', { name: 'Swing' });
    expect(loadActive()!.stepIndex).toBe(0);
  });

  it('counts the rest down from an absolute deadline and advances by itself', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(loadActive()!.restEndsAt).toBe(Date.now() + 30_000);
    act(() => { vi.advanceTimersByTime(30_000); });
    screen.getByRole('heading', { name: 'Goblet Squat' });
  });

  it('survives a stalled timer, because the deadline is absolute', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // The clock moves but the interval does not fire, as when iOS throttles a
    // backgrounded tab. One tick afterwards must catch up, not resume from 30.
    act(() => { vi.setSystemTime(Date.now() + 29_000); vi.advanceTimersByTime(250); });
    expect(screen.getByText('0:01')).toBeDefined();
  });

  it('resumes a rest at the right point after a remount', () => {
    const now = Date.now();
    saveActive({
      v: 1, workout: workout(THREE()), stepIndex: 1, workedSeconds: 60,
      restEndsAt: now + 12_000, pausedRemainingMs: null,
    });
    render(<WorkoutRunner />);
    screen.getByText('0:12');
  });

  it('freezes the countdown while paused and restores it on resume', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    screen.getByRole('heading', { name: 'Rest' });

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    screen.getByRole('heading', { name: 'Goblet Squat' });
  });

  it('adds thirty seconds to a rest', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const before = loadActive()!.restEndsAt!;
    fireEvent.click(screen.getByRole('button', { name: '+30s' }));
    expect(loadActive()!.restEndsAt).toBe(before + 30_000);
  });

  it('accumulates worked time on work steps, not only on rests', () => {
    render(<WorkoutRunner />);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(loadActive()!.workedSeconds).toBeGreaterThanOrEqual(9);
  });

  it('does not accumulate worked time while paused', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(loadActive()!.workedSeconds).toBeLessThan(2);
  });

  it('shows the position within the round', () => {
    render(<WorkoutRunner />);
    screen.getByText('Round 1 of 2');
  });

  it('writes history and clears the active workout at the end', () => {
    seed([work('Swing')]);
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].mainExerciseIds).toEqual(['swing']);
    expect(loadHistory()[0].workout.id).toBe('w1');
    expect(loadActive()).toBeNull();
    expect(push).toHaveBeenCalledWith('/workout/done');
  });

  it('keeps the session when leaving for now', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: /leave for now/i }));
    expect(loadActive()).not.toBeNull();
    expect(loadHistory()).toHaveLength(0);
  });

  it('writes a partial record when ending early, never discarding the session', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: /end here/i }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadActive()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- workout-runner`
Expected: FAIL, component not found.

- [ ] **Step 3: Implement the wake lock**

`src/lib/useWakeLock.ts`:

```ts
'use client';
import { useEffect, useRef } from 'react';

/**
 * Holds the screen on for the workout. Safari supports this from 16.4; where it is
 * unavailable the app carries on and says nothing. The browser releases the lock
 * whenever the document hides, so it is retaken on the way back.
 */
export function useWakeLock(active: boolean): void {
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let cancelled = false;

    const request = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try { lock.current = await navigator.wakeLock.request('screen'); } catch { /* denied */ }
    };

    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}
```

- [ ] **Step 4: Implement the audio cues**

`src/lib/useAudioCues.ts`:

```ts
'use client';
import { useCallback, useEffect, useRef } from 'react';

/**
 * A media element rather than Web Audio, deliberately. iOS silences Web Audio with
 * the hardware ringer switch, whereas user-initiated media plays on the media
 * channel and mixes over music. Vibration is not an option: navigator.vibrate does
 * not exist on iOS Safari.
 *
 * `unlock` must be called from inside a real user gesture, once, or every later
 * play() is rejected. The Start workout tap is that gesture.
 */
export function useAudioCues(): { unlock: () => void; tick: () => void; go: () => void } {
  const tickEl = useRef<HTMLAudioElement | null>(null);
  const goEl = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    tickEl.current = new Audio('/audio/tick.mp3');
    goEl.current = new Audio('/audio/go.mp3');
    for (const el of [tickEl.current, goEl.current]) { el.preload = 'auto'; el.volume = 0.8; }
  }, []);

  const play = (el: HTMLAudioElement | null) => {
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => { /* muted, or no gesture yet */ });
  };

  const unlock = useCallback(() => {
    for (const el of [tickEl.current, goEl.current]) {
      if (!el) continue;
      const wasMuted = el.muted;
      el.muted = true;
      void el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = wasMuted; }).catch(() => { el.muted = wasMuted; });
    }
  }, []);

  return {
    unlock,
    tick: useCallback(() => play(tickEl.current), []),
    go: useCallback(() => play(goEl.current), []),
  };
}
```

Source two short royalty-free cues, or generate them with `ffmpeg`, which is already
installed:

```bash
mkdir -p public/audio && ffmpeg -f lavfi -i "sine=frequency=880:duration=0.08" -af "afade=t=out:st=0.05:d=0.03" -y public/audio/tick.mp3 && ffmpeg -f lavfi -i "sine=frequency=1320:duration=0.35" -af "afade=t=out:st=0.2:d=0.15" -y public/audio/go.mp3
```

- [ ] **Step 5: Implement the runner**

`src/components/WorkoutRunner.tsx` is a client component. Core structure:

```tsx
'use client';
const TICK_MS = 250;

export function WorkoutRunner() {
  const router = useRouter();
  const [state, setState] = useState<ActiveState | null>(null);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef<number>(Date.now());
  const { unlock, tick, go } = useAudioCues();

  useEffect(() => {
    const s = loadActive();
    if (!s) { router.push('/workout'); return; }
    setState(s);
    unlock();
    lastTick.current = Date.now();
  }, [router, unlock]);

  useWakeLock(!paused && state !== null);

  // One interval for the whole session. It drives repaints and accumulates worked
  // time from clock deltas; it never decrements a stored counter.
  useEffect(() => {
    if (!state || paused) { lastTick.current = Date.now(); return; }
    const id = setInterval(() => {
      const t = Date.now();
      const delta = (t - lastTick.current) / 1000;
      lastTick.current = t;
      setNow(t);
      setState((s) => (s ? persist({ ...s, workedSeconds: s.workedSeconds + delta }) : s));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state !== null, paused]);
  // ...
}
```

The rest of the behaviour:

- `remaining = state.restEndsAt === null ? null : Math.ceil((state.restEndsAt - now) / 1000)`,
  recomputed on every render and on `visibilitychange`, so a throttled or stalled
  interval catches up instead of resuming from the top.
- Entering a rest step sets `restEndsAt = Date.now() + seconds * 1000`. Leaving any
  step clears it. `+30s` adds 30,000 to it. Pause stores
  `pausedRemainingMs = restEndsAt - Date.now()` and clears `restEndsAt`; Resume
  recomputes `restEndsAt = Date.now() + pausedRemainingMs`.
- When `remaining` hits 3, 2 and 1, call `tick()`; at 0, call `go()` and advance.
  Guard each cue so it fires once per second, not once per 250ms tick.
- The rest card keeps rendering past zero with a negative `remaining`, and advances
  only once. Never auto-advance out of the last rest of a block: the change of
  context deserves a deliberate tap.
- Header: block name, "Round 1 of 2", `<ProgressBar>` over the whole step list, and
  the exit control. Bottom row: Previous, Pause/Resume, and Next (or Finish on the
  last step), all at least 44px and within thumb reach.
- Exit opens two choices. **Leave for now** keeps `kb.active.v1` and pushes home.
  **End here** writes a `HistoryEntry` covering the steps completed so far, calls
  `clearActive()` and pushes `/workout/done`.
- Finish writes the full `HistoryEntry`: the whole `workout`, `mainExerciseIds`
  taken from distinct `exerciseId`s of work steps whose `block` is `Main`, and the
  accumulated `workedSeconds`.
- Warm-up and cool-down blocks render through `<AncillaryChecklist>` rather than
  step by step.

`src/app/workout/done/page.tsx` for now: a heading, the worked time from the newest
history entry, and a link home. Task 21 finishes it.

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add the workout runner with a clock-driven timer, audio and pause"
```

---

### Task 21: Home, Done and History

**Files:**
- Create: `src/components/HomeScreen.tsx`, `src/components/DoneScreen.tsx`, `src/components/TabBar.tsx`, `src/app/history/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/workout/done/page.tsx`, `src/app/layout.tsx`
- Test: `tests/components/home.test.tsx`, `tests/components/done.test.tsx`

**Interfaces:**
- Consumes: storage from Task 11, primitives from Task 16
- Produces: the `/`, `/workout/done` and `/history` routes, and the tab bar

- [ ] **Step 1: Write the failing tests**

`tests/components/home.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeScreen } from '@/components/HomeScreen';
import { pushHistory, saveKits, loadKits, saveActive } from '@/lib/storage';
import { entry, req } from '../fixtures';
import type { Workout } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));

const workout = { id: 'w', createdAt: 'now', request: req(), format: 'circuit',
  steps: [], estimatedSeconds: 0, loadWarning: false, shortOfBudget: false } as Workout;

beforeEach(() => localStorage.clear());

describe('HomeScreen', () => {
  it('invites a first workout when there is no history', () => {
    render(<HomeScreen />);
    expect(screen.getByText(/no workouts yet/i)).toBeDefined();
  });

  it('counts this week and the total minutes', () => {
    pushHistory(entry({ id: 'a', createdAt: new Date().toISOString() }));
    pushHistory(entry({ id: 'b', createdAt: new Date().toISOString() }));
    render(<HomeScreen />);
    screen.getByRole('img', { name: /Workouts this week: 2/ });
    screen.getByRole('img', { name: /Minutes: 50/ });
  });

  it('ignores workouts older than seven days in the weekly count', () => {
    pushHistory(entry({ id: 'old', createdAt: new Date(Date.now() - 10 * 864e5).toISOString() }));
    render(<HomeScreen />);
    screen.getByRole('img', { name: /Workouts this week: 0/ });
  });

  it('shows seven dots for the last week rather than a streak', () => {
    render(<HomeScreen />);
    expect(screen.getAllByTestId('week-dot')).toHaveLength(7);
    expect(screen.queryByText(/streak/i)).toBeNull();
  });

  it('names the active kit', () => {
    const s = loadKits(); s.activeId = 'gym'; saveKits(s);
    render(<HomeScreen />);
    screen.getByText('Gym');
  });

  it('offers to resume a recent workout', () => {
    saveActive({ v: 1, workout, stepIndex: 2, workedSeconds: 60, restEndsAt: null, pausedRemainingMs: null });
    render(<HomeScreen />);
    screen.getByRole('link', { name: /resume/i });
  });

  it('does not offer to resume a workout from days ago', () => {
    saveActive({
      v: 1, workout: { ...workout, createdAt: new Date(Date.now() - 4 * 864e5).toISOString() },
      stepIndex: 2, workedSeconds: 60, restEndsAt: null, pausedRemainingMs: null,
    });
    render(<HomeScreen />);
    expect(screen.queryByRole('link', { name: /resume/i })).toBeNull();
  });
});
```

`tests/components/done.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DoneScreen } from '@/components/DoneScreen';
import { pushHistory, loadHistory } from '@/lib/storage';
import { entry } from '../fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => localStorage.clear());

describe('DoneScreen', () => {
  it('compares the worked time against the estimate', () => {
    pushHistory(entry({ workedSeconds: 2040, workout: { estimatedSeconds: 1800 } as never }));
    render(<DoneScreen />);
    screen.getByText(/34 min/);
    screen.getByText(/30 min/);
  });

  it('records a one-tap effort rating', () => {
    pushHistory(entry({ id: 'x' }));
    render(<DoneScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Brutal' }));
    expect(loadHistory()[0].felt).toBe('brutal');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- home done`
Expected: FAIL, components not found.

- [ ] **Step 3: Implement**

`HomeScreen` hydrates history, kits and the active workout in `useEffect`, then
renders:

- a greeting heading
- two `<Ring>`s: workouts in the last seven days, and total minutes across history
- a row of seven dots, `data-testid="week-dot"`, filled for days with a workout.
  **Not a streak counter.** Nobody swings kettlebells seven days a week, so a
  consecutive-days number reads 0 or 1 almost always, which is a training app
  telling a man who trains four times a week that he has done nothing.
- the active kit as a chip linking to `/kit`
- a "Resume workout" link when an active workout exists and is less than three
  hours old, so a session abandoned last Tuesday does not sit there for a week
- a full-width "Start a workout" link to `/workout`
- a card summarising the most recent workout, or "No workouts yet"

`DoneScreen` reads the newest history entry and shows the worked time against
`workout.estimatedSeconds` ("34 min, estimated 30"), the exercises completed, the
patterns trained, and three buttons: Easy, Right, Brutal, writing `felt` back to
that entry. The estimate comparison is the only mechanism by which wrong
`secondsPerRep` values ever get noticed.

`src/app/history/page.tsx` lists history newest first, each row showing the date,
format, duration, `felt` rating and pattern tags, expanding on tap into the
exercises.

`TabBar` is a fixed bottom bar with Home, Workout, History and Kit, using
`usePathname` to set `aria-current="page"`. Rendered from `layout.tsx` and hidden
on `/workout/run`, so nothing sits under the thumb mid-set.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS on the whole suite.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add home, done, history and the tab bar"
```

---

### Task 22: Installable

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `scripts/make-icons.mts`
- Modify: `src/app/layout.tsx`
- Test: `tests/manifest.test.ts`

**Interfaces:**
- Produces: an app that adds to the iPhone Home Screen and opens without browser chrome

No service worker in v1. Precaching is the most failure-prone part of the build and
the least load-bearing; it can be added the first time a missing signal costs a
workout.

- [ ] **Step 1: Write the failing test**

`tests/manifest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

describe('web app manifest', () => {
  it('opens standalone so it does not look like a browser tab', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('uses the app background so there is no white flash on launch', () => {
    expect(manifest.background_color).toBe('#0b0b0c');
    expect(manifest.theme_color).toBe('#0b0b0c');
  });

  it('starts at the home screen', () => expect(manifest.start_url).toBe('/'));

  it('ships both icon sizes, and they exist', () => {
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes).sort()).toEqual(['192x192', '512x512']);
    for (const i of manifest.icons) expect(existsSync(`public${i.src}`), i.src).toBe(true);
  });

  it('ships an apple touch icon, which iOS uses instead of the manifest', () => {
    expect(existsSync('public/icons/apple-touch-icon.png')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- manifest`
Expected: FAIL, the manifest does not exist.

- [ ] **Step 3: Write the manifest and icons**

`public/manifest.webmanifest`:

```json
{
  "name": "Kettlebell",
  "short_name": "Kettlebell",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b0b0c",
  "theme_color": "#0b0b0c",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

`orientation` is omitted: iOS ignores it, and a value that does nothing is a lie in
the file.

`scripts/make-icons.mts` renders a square SVG (a kettlebell silhouette in
`--accent` on `--bg`) to the three PNG sizes with sharp, reusing the pattern from
Task 15.

In `layout.tsx`: `manifest: '/manifest.webmanifest'` in `metadata`, an
`apple-touch-icon` link, and `themeColor: '#0b0b0c'` in `viewport`.

- [ ] **Step 4: Verify**

Run: `npm run verify && npm run build`
Expected: PASS, and a clean build.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: make the app installable to the Home Screen"
```

---

### Task 23: Interface audit and deploy

**Files:**
- Modify: whatever the audit turns up

- [ ] **Step 1: Seed a workout, then audit the runner**

`impeccable` against `/workout/run` would otherwise hit a screen that redirects to
`/workout`, so the most important screen in the app would never get audited. Seed
one first, in the browser console on the running app:

```js
// paste into the console at http://localhost:3000 before auditing /workout/run
localStorage.setItem('kb.kits.v1', JSON.stringify({ v: 1, activeId: 'home', capability: 'advanced',
  profiles: [{ id: 'home', name: 'Home', hasBench: true,
    bells: [{ weightKg: 16, count: 2 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 }] },
    { id: 'gym', name: 'Gym', bells: [], hasBench: true }] }));
```

Then generate a workout through the UI and start it.

- [ ] **Step 2: Run the audit on every screen**

```bash
npx -y impeccable detect http://localhost:3000
```

Repeat for `/workout`, `/workout/preview`, `/workout/run`, `/history` and `/kit`.
Fix everything it reports. The target is zero.

- [ ] **Step 3: Check it in the room it is for**

At 390×844: walk a whole workout end to end. Confirm the Next button clears the
home indicator, the countdown reads at arm's length, nothing scrolls sideways, the
tab bar is absent from `/workout/run`, Previous and Pause are reachable with a
thumb, and no `--text-dim` appears on the runner.

- [ ] **Step 4: Verify and build**

Run: `npm run verify && npm run build`
Expected: PASS, clean build.

- [ ] **Step 5: Deploy**

```bash
npx vercel --prod
```

The URL is public by default. Nothing here is sensitive, but say so rather than
assuming it is private.

- [ ] **Step 6: Install and check the storage partition**

Open the URL in Safari, Share, Add to Home Screen. **Set the kit up inside the
installed app, not in Safari:** iOS partitions storage between the two, so a kit
entered in Safari will not be there in the installed app. Then confirm a workout
runs in aeroplane mode after one visit, that the rest cue is audible over music,
and that the screen stays awake.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: interface audit fixes and production deploy"
```

---

## Not in this plan

**Phase 2**, turning an Instagram Reel into database entries, is specified in
`SPEC.md` section 11 and gets its own plan. It should not start until twenty real
sessions have happened: the database has 41 records and he does not yet know which
ones are missing. It needs no change to anything built here.

**Fourteen batch 2 stills** are Thomas's to supply. The app works without them and
`npm run media:todo` says what is outstanding. The eight ballistics need two or
three panels, not one: a still of a swing at chest height is indistinguishable
from a front raise, which is the exact error the picture exists to prevent.

**A service worker**, when a missing signal first costs a workout.

**Progression**, once there is completion data to build it on. This is the real
retention risk and it is deliberately deferred, which is why the history record is
being built properly now.
