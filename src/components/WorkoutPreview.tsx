'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { isActiveHydrated, publishActive, useActiveWorkout } from '@/lib/active-store';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { tick } from '@/lib/clock';
import { generate } from '@/lib/generate';
import { isKitHydrated, useKit } from '@/lib/kit-store';
import { loadHistory } from '@/lib/storage';
import type { Block, Format, WorkStep, Workout } from '@/lib/types';

const BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]));

const BLOCKS: Block[] = ['Warm-up', 'Main', 'Cool-down'];

const FORMAT_COPY: Record<Format, { label: string; hint: string }> = {
  circuit: { label: 'Circuit', hint: 'Several moves, round after round' },
  complex: { label: 'Complex', hint: 'Chained moves, the bell never lands' },
  strength: { label: 'Strength', hint: 'Fewer moves, heavier, longer rests' },
};

/** "16 kg", "16 kg and 24 kg", "16 kg, 24 kg and 32 kg". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const workSteps = (w: Workout): WorkStep[] =>
  w.steps.filter((s): s is WorkStep => s.kind === 'work');

/** Every distinct bell the session actually asks for, lightest first. */
const bellsUsed = (w: Workout): number[] =>
  [...new Set(workSteps(w).map((s) => s.bellKg).filter((b): b is number => b !== null))]
    .sort((a, b) => a - b);

const needsBench = (w: Workout): boolean =>
  workSteps(w).some((s) => BY_ID.get(s.exerciseId)?.needsBench === true);

/**
 * The line that saves a trip back indoors, so it goes first and nothing goes
 * above it. Everything else on this screen is a decision; this is a fetch list.
 */
function kitLine(w: Workout): string {
  const bells = bellsUsed(w);
  const load = bells.length === 0 ? 'no bells' : list(bells.map((b) => `${b} kg`));
  return `You'll need: ${load}. ${needsBench(w) ? 'And a bench.' : 'No bench.'}`;
}

const prescription = (s: WorkStep): string =>
  s.reps !== undefined ? `${s.reps} reps` : s.seconds !== undefined ? `${s.seconds} sec` : '';

/** The main-block moves, which is what a reroll is judged on. */
const mainNames = (w: Workout): string[] =>
  [...new Set(workSteps(w).filter((s) => s.block === 'Main').map((s) => s.name))];

/**
 * What a reroll actually changed. "Regenerated" tells him nothing; a reroll
 * that quietly returns nearly the same session is the thing he needs to be able
 * to see, rather than tapping it four more times hoping.
 */
function describeChange(before: Workout, after: Workout): string {
  const was = mainNames(before);
  const now = mainNames(after);
  const added = now.filter((n) => !was.includes(n));
  const dropped = was.filter((n) => !now.includes(n));

  if (added.length > 0) {
    return dropped.length > 0
      ? `Swapped ${list(dropped)} for ${list(added)}.`
      : `Added ${list(added)}.`;
  }
  if (before.format !== after.format) return `Rebuilt as a ${FORMAT_COPY[after.format].label.toLowerCase()}.`;
  if (before.estimatedSeconds !== after.estimatedSeconds) {
    return `Same moves, now about ${Math.round(after.estimatedSeconds / 60)} min.`;
  }
  return 'Same moves in the same order - with this kit and this long, that is the best fit there is.';
}

/**
 * The whole workout, before he commits to it.
 *
 * As with Setup, the clock and the seed are read here rather than inside
 * `generate`, which is what keeps `src/lib` pure.
 */
export function WorkoutPreview() {
  const router = useRouter();
  const active = useActiveWorkout();
  const kit = useKit();
  const [changed, setChanged] = useState('');

  // Hooks first, branches after: the early returns below are why.
  if (!isActiveHydrated(active)) {
    return <p className="text-sm text-[var(--text-dim)]">Reading your workout…</p>;
  }

  if (active === null) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-base font-bold">No workout ready yet.</p>
        <p className="text-sm text-[var(--text-dim)]">Pick what you are training and we will build one.</p>
        <Button onClick={() => router.push('/workout')}>Set one up</Button>
      </Card>
    );
  }

  const w = active.workout;
  const estimateMinutes = Math.round(w.estimatedSeconds / 60);
  const bells = bellsUsed(w);

  const regenerate = () => {
    const profile = kit.profiles.find((p) => p.id === w.request.kitProfileId) ?? kit.profiles[0];
    const at = tick();
    const next = generate({
      request: { ...w.request, seed: at.seed },
      kit: profile,
      exercises: ALL_EXERCISES,
      combos: COMBOS,
      history: loadHistory(),
      now: at.now,
    });
    if (next.steps.length === 0) return;
    setChanged(describeChange(w, next));
    publishActive({
      v: 1, workout: next, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null,
    });
  };

  /**
   * Said out loud rather than hidden, because `prescribe` quietly cuts the reps
   * on everything below the heavy band when the kit cannot separate the bands.
   * The app must not sound confident where its own model has broken down.
   */
  const loadNote = !w.loadWarning
    ? ''
    : `${bells.length === 1 ? `Only the ${bells[0]} kg bell came out of this kit` : 'Fewer than three weights in this kit'}, `
      + 'so the load is not scaled: light, moderate and heavy all land on the same bell, and the reps on '
      + 'pressing and grinding work are cut back rather than done at swing weight.';

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <p className="text-xl font-bold leading-snug tracking-tight">{kitLine(w)}</p>
        <p className="text-sm text-[var(--text-dim)]">Fetch that before you start and you will not stop again.</p>
      </Card>

      <Card className="flex flex-col gap-1">
        <p className="text-lg font-bold tracking-tight">{FORMAT_COPY[w.format].label}</p>
        <p className="text-sm text-[var(--text-dim)]">{FORMAT_COPY[w.format].hint}</p>
        <p className="mt-2 text-base font-bold">
          {`about ${estimateMinutes} min for a ${w.request.totalMinutes} minute session`}
        </p>
        {w.shortOfBudget && (
          <p className="text-sm text-[var(--text-dim)]">
            {`That is short of the ${w.request.totalMinutes} minutes you asked for. `}
            {'This kit ran out of moves it could sensibly repeat, so the session is honest about it rather than padded.'}
          </p>
        )}
      </Card>

      {/*
        One live region for both things this screen has to say out loud: what
        the kit cannot do, and what a reroll just changed. Mounted whether or
        not it has anything to say - a live region added to the page at the same
        moment as its text is unreliably announced.
      */}
      <div role="status" className="flex flex-col gap-3">
        {loadNote && (
          <p
            className="rounded-[var(--radius)] border p-3 text-sm text-[var(--text)]"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--accent) 12%, var(--surface-2))',
              borderColor: 'color-mix(in oklab, var(--accent) 45%, var(--border))',
            }}
          >
            {loadNote}
          </p>
        )}
        {changed && <p className="text-sm text-[var(--text-dim)]">{changed}</p>}
      </div>

      {BLOCKS.map((block) => {
        const items = workSteps(w).filter((s) => s.block === block && s.round === 1);
        if (items.length === 0) return null;
        const rounds = items[0].totalRounds;

        return (
          <Card key={block} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold tracking-tight">{block}</h2>
              <p className="text-sm text-[var(--text-dim)]">
                {rounds > 1 ? `${rounds} rounds` : 'once through'}
              </p>
            </div>

            <ol className="flex flex-col gap-2">
              {items.map((s, i) => (
                <li
                  key={`${s.exerciseId}-${s.side ?? 'both'}-${i}`}
                  className="flex items-baseline justify-between gap-3 border-b border-[var(--border)]
                    pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-base font-bold leading-tight">
                    {s.side ? `${s.name} (${s.side})` : s.name}
                  </span>
                  <span className="shrink-0 text-sm text-[var(--text-dim)]">
                    {[prescription(s), s.bellKg === null ? 'bodyweight' : `${s.bellKg} kg`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        );
      })}

      <div className="flex flex-col gap-3">
        <Button onClick={() => router.push('/workout/run')}>Start workout</Button>
        <Button variant="ghost" onClick={regenerate} disabled={!isKitHydrated(kit)}>
          Build a different one
        </Button>
      </div>
    </div>
  );
}
