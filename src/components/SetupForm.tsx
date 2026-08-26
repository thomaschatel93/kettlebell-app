'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Option } from '@/components/Option';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { tick } from '@/lib/clock';
import { chooseFormat } from '@/lib/format';
import { generate } from '@/lib/generate';
import { resolveBell, uniqueWeights } from '@/lib/kit';
import { isKitHydrated, useKit } from '@/lib/kit-store';
import { coverablePatterns, filterCombos, filterPool } from '@/lib/pool';
import { publishActive } from '@/lib/active-store';
import { publishPrefs, usePrefs } from '@/lib/prefs-store';
import { loadHistory, type Prefs } from '@/lib/storage';
import {
  EFFORTS, PATTERNS,
  type Combo, type Effort, type Exercise, type Format, type KitProfile, type Pattern, type WorkoutRequest,
} from '@/lib/types';

/**
 * The chip carries both names for the same thing. He thinks in body parts -
 * "shoulders today, my legs are wrecked" - and the engine thinks in movement
 * patterns, and neither of them is going to learn the other's vocabulary.
 */
const BODY_PARTS: Record<Pattern, string> = {
  hinge: 'hamstrings, glutes, back',
  squat: 'quads, glutes',
  push: 'shoulders, chest, triceps',
  pull: 'back, biceps',
  carry: 'grip, core, shoulders',
  core: 'abs, obliques, spine',
};

const PATTERN_LABEL: Record<Pattern, string> = {
  hinge: 'Hinge', squat: 'Squat', push: 'Push', pull: 'Pull', carry: 'Carry', core: 'Core',
};

/**
 * Effort is per session and lives here. Capability - what he can do at all -
 * lives on the Kit tab and is read from the store, never asked again. Confusing
 * the two is how an app ends up demoting someone for having a tired day.
 */
const EFFORT_LABEL: Record<Effort, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

const MINUTES: readonly Prefs['totalMinutes'][] = [15, 20, 30, 45, 60];

const FORMAT_COPY: { value: 'auto' | Format; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Picked from what you asked for' },
  { value: 'circuit', label: 'Circuit', hint: 'Several moves, round after round' },
  { value: 'complex', label: 'Complex', hint: 'Chained moves, the bell never lands' },
  { value: 'strength', label: 'Strength', hint: 'Fewer moves, heavier, longer rests' },
];

/** One tap for the session he asks for most. */
const FULL_BODY: Pattern[] = ['hinge', 'squat', 'push', 'pull'];

const FORMAT_NAME: Record<Format, string> = {
  circuit: 'circuit', complex: 'complex', strength: 'strength session',
};

/** "hinge", "hinge and squat", "hinge, squat and push". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Which of the requested patterns the chosen format can actually put in the
 * main block, which is not the same question as which the pool can train.
 *
 * A complex is built from whole chains, and `filterCombos` refuses any chain
 * with a carry in it, so ticking carry and getting a complex means the carry
 * silently never appears. That is the case worth a warning and a switch.
 *
 * A strength session is not in the same position, even though it prefers
 * grinds: `selectStrength` only insists on a grind for the FIRST pick and fills
 * the rest from the whole pool, so nothing is actually excluded, and claiming
 * otherwise would be a warning about something that does not happen.
 */
function formatCoverable(
  format: Format, pool: Exercise[], combos: Combo[], request: WorkoutRequest,
): Pattern[] {
  if (format !== 'complex') return coverablePatterns(pool, request);
  const members = new Set(combos.flatMap((c) => c.steps.map((s) => s.exerciseId)));
  return coverablePatterns(ALL_EXERCISES.filter((e) => members.has(e.id)), request);
}

/**
 * Which requested patterns this kit cannot tell apart by weight.
 *
 * Read off the real pool rather than guessed from the number of bells: a
 * pattern whose candidates all want the same load band is fine on one bell,
 * and a pattern whose candidates span light, moderate and heavy is not. With a
 * single bell every carry - suitcase, racked, goblet, overhead - comes out at
 * the same weight, however differently they are meant to be loaded.
 */
function collapsedPatterns(pool: Exercise[], patterns: Pattern[], kit: KitProfile): Pattern[] {
  return patterns.filter((p) => {
    const loaded = pool.filter((e) => e.bells > 0 && e.patterns.includes(p));
    const bands = new Set(loaded.map((e) => e.loadBand));
    const weights = new Set([...bands].map((b) => resolveBell(b, kit)));
    return bands.size > weights.size;
  });
}

const NOTE_STYLE = {
  backgroundColor: 'color-mix(in oklab, var(--accent) 12%, var(--surface-2))',
  borderColor: 'color-mix(in oklab, var(--accent) 45%, var(--border))',
} as const;

/** The shell every note in the live region shares. */
const Note = ({ children }: { children: ReactNode }) => (
  <div
    className="flex flex-col gap-3 rounded-[var(--radius)] border p-3 text-sm text-[var(--text)]"
    style={NOTE_STYLE}
  >
    {children}
  </div>
);

/**
 * What to train and for how long.
 *
 * The clock and the seed are read HERE, in the component, and passed into
 * `generate`, which is what keeps `src/lib` pure and testable.
 */
export function SetupForm() {
  const router = useRouter();
  const kit = useKit();
  const stored = usePrefs();

  /**
   * The edits in progress, layered over what was last stored.
   *
   * Not seeded into `useState` from storage: localStorage does not exist during
   * the server render, and hydrating from it in an effect is what the React
   * Compiler ruleset rejects outright. `usePrefs` handles the read; `draft`
   * only exists once he has actually changed something, and until then the
   * stored choices show through.
   */
  const [draft, setDraft] = useState<Prefs | null>(null);
  const prefs = draft ?? stored;

  /**
   * Format is deliberately NOT part of the stored prefs. It defaults to Auto
   * every session, so one session where he forced a complex does not quietly
   * become every session after it.
   */
  const [format, setFormat] = useState<'auto' | Format>('auto');

  /** Something that stopped the workout being handed over. Rare and loud. */
  const [problem, setProblem] = useState('');

  const hydrated = isKitHydrated(kit);
  // Storage guarantees activeId names a profile that exists; the fallback is
  // only here because the type cannot know that.
  const active = kit.profiles.find((p) => p.id === kit.activeId) ?? kit.profiles[0];
  const weights = uniqueWeights(active);
  const empty = weights.length === 0;

  const edit = (patch: Partial<Prefs>) => setDraft((d) => ({ ...(d ?? stored), ...patch }));

  const togglePattern = (p: Pattern) =>
    setDraft((d) => {
      const base = d ?? stored;
      return {
        ...base,
        patterns: base.patterns.includes(p)
          ? base.patterns.filter((x) => x !== p)
          : [...base.patterns, p],
      };
    });

  /**
   * The request exactly as it will be sent, minus the seed, so every warning
   * below is computed from what he will actually get rather than an
   * approximation of it.
   */
  const request: WorkoutRequest = {
    kitProfileId: active.id,
    patterns: prefs.patterns,
    capability: kit.capability,
    effort: prefs.effort,
    totalMinutes: prefs.totalMinutes,
    format,
    seed: 0,
  };

  const pool = filterPool(ALL_EXERCISES, request, active);
  const combos = filterCombos(COMBOS, ALL_EXERCISES, request, active);
  const chosenFormat = chooseFormat(request, combos.length > 0);

  const covered = coverablePatterns(pool, request);
  const untrainable = prefs.patterns.filter((p) => !covered.includes(p));
  const inFormat = formatCoverable(chosenFormat, pool, combos, request);
  const noSlot = covered.filter((p) => !inFormat.includes(p));
  const collapsed = empty ? [] : collapsedPatterns(pool, prefs.patterns, active);

  const names = (ps: Pattern[]) => list(ps.map((p) => PATTERN_LABEL[p].toLowerCase()));

  const alert = problem
    || (hydrated && empty
      ? 'No bells in this kit yet. Add a bell on the Kit tab and this screen can build you a session.'
      : '');

  const generateWorkout = () => {
    setProblem('');
    publishPrefs({ patterns: prefs.patterns, effort: prefs.effort, totalMinutes: prefs.totalMinutes });

    // The clock and the seed are read at the tap, not inside `generate`, which
    // is what keeps the engine pure. One reading gives both.
    const at = tick();
    const workout = generate({
      request: { ...request, seed: at.seed },
      kit: active,
      exercises: ALL_EXERCISES,
      combos: COMBOS,
      history: loadHistory(),
      now: at.now,
    });

    if (workout.steps.length === 0) {
      setProblem('Nothing in this kit can fill that session. Try another pattern, or add a bell on the Kit tab.');
      return;
    }

    // The Preview screen reads this back OUT of storage, so a write that failed
    // on quota or in private mode would land him on an empty screen with no
    // idea why. Say so here instead of navigating into it.
    const saved = publishActive({
      v: 1, workout, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null,
    });
    if (!saved) {
      setProblem('The workout could not be saved - storage is full, or this is a private window. '
        + 'Free some space and try again.');
      return;
    }

    router.push('/workout/preview');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold leading-tight">{active.name}</p>
          <p className="text-sm leading-tight text-[var(--text-dim)]">
            {hydrated
              ? `${empty ? 'No bells' : weights.map((w) => `${w} kg`).join(', ')}${active.hasBench ? ', bench' : ', no bench'}`
              : 'Reading your kit'}
          </p>
        </div>
        <a
          href="/kit"
          className="tap-target inline-flex items-center rounded-[var(--radius)] border
            border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-base font-bold
            text-[var(--text)] transition-opacity active:opacity-80"
        >
          Change
        </a>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">What are you training?</h2>
          <button
            type="button"
            onClick={() => edit({ patterns: [...FULL_BODY] })}
            className="tap-target rounded-[var(--radius)] px-2 py-2 text-sm font-bold
              text-[var(--accent)] transition-opacity active:opacity-80"
          >
            Full body
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PATTERNS.map((p) => (
            <Chip
              key={p}
              tone={p}
              subtitle={BODY_PARTS[p]}
              selected={prefs.patterns.includes(p)}
              onClick={() => togglePattern(p)}
            >
              {PATTERN_LABEL[p]}
            </Chip>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight">How hard today?</h2>
        <div className="grid grid-cols-3 gap-3">
          {EFFORTS.map((e) => (
            <Option
              key={e}
              selected={prefs.effort === e}
              onClick={() => edit({ effort: e })}
              className="items-center text-center"
            >
              {EFFORT_LABEL[e]}
            </Option>
          ))}
        </div>
        <p className="text-sm text-[var(--text-dim)]">
          Today only. What you can lift at all lives on the Kit tab.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight">How long have you got?</h2>
        <div className="grid grid-cols-3 gap-3">
          {MINUTES.map((m) => (
            <Option
              key={m}
              selected={prefs.totalMinutes === m}
              onClick={() => edit({ totalMinutes: m })}
              className="items-center text-center"
            >
              {`${m} min`}
            </Option>
          ))}
        </div>
      </Card>

      <Card>
        {/*
          The <details> keeps its own default layout - flex on it added a gap
          under the closed summary for content that is not there. The open state
          spaces itself from the inner grid instead.
        */}
        <details>
          <summary className="tap-target flex cursor-pointer items-center text-lg font-bold tracking-tight">
            Format
            <span className="ml-2 text-sm font-medium text-[var(--text-dim)]">
              {FORMAT_COPY.find((f) => f.value === format)?.label}
            </span>
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {FORMAT_COPY.map((f) => (
              <Option
                key={f.value}
                selected={format === f.value}
                hint={f.hint}
                onClick={() => setFormat(f.value)}
              >
                {f.label}
              </Option>
            ))}
          </div>
        </details>
      </Card>

      {/*
        Mounted whether or not it has anything to say: a live region added to
        the page at the same moment as its text is unreliably announced.
      */}
      <div role="status" className="flex flex-col gap-3">
        {hydrated && untrainable.length > 0 && (
          <Note>
            <p>
              {`Nothing in this kit trains ${names(untrainable)}. `}
              {`Add kit on the Kit tab, or drop ${untrainable.length === 1 ? 'it' : 'them'} and the rest still works.`}
            </p>
            <button
              type="button"
              onClick={() => edit({ patterns: prefs.patterns.filter((p) => !untrainable.includes(p)) })}
              className="tap-target self-start rounded-[var(--radius)] border border-[var(--border)]
                bg-[var(--surface-2)] px-4 py-2 text-base font-bold text-[var(--text)]
                transition-opacity active:opacity-80"
            >
              {`Untick ${names(untrainable)}`}
            </button>
          </Note>
        )}

        {hydrated && noSlot.length > 0 && (
          <Note>
            <p>
              {`A ${FORMAT_NAME[chosenFormat]} has no slot for ${names(noSlot)}, `}
              {`so ${noSlot.length === 1 ? 'it' : 'they'} will not appear in this session.`}
            </p>
            <button
              type="button"
              onClick={() => setFormat('circuit')}
              className="tap-target self-start rounded-[var(--radius)] border border-[var(--border)]
                bg-[var(--surface-2)] px-4 py-2 text-base font-bold text-[var(--text)]
                transition-opacity active:opacity-80"
            >
              Build a circuit instead
            </button>
          </Note>
        )}

        {hydrated && collapsed.length > 0 && (
          <Note>
            <p>
              {`Only ${weights.length === 1 ? 'one weight' : `${weights.length} weights`} here, so the app cannot give `}
              {`your ${names(collapsed)} work the lighter or heavier bell it asks for. `}
              {'Add another weight on the Kit tab and the loading separates out.'}
            </p>
          </Note>
        )}
      </div>

      <div role="alert">
        {alert && (
          <p
            className="rounded-[var(--radius)] border p-3 text-sm text-[var(--text)]"
            style={NOTE_STYLE}
          >
            {alert}
          </p>
        )}
      </div>

      <Button disabled={!hydrated || empty || prefs.patterns.length === 0} onClick={generateWorkout}>
        Generate workout
      </Button>
    </div>
  );
}
