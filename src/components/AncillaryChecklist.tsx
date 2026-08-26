'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { Exercise, Step, WorkStep } from '@/lib/types';

/**
 * The whole warm-up, or the whole cool-down, as ONE card.
 *
 * Not one hero card per move, which is what this originally was. The warm-up
 * runs first in every single session, so a screen per move meant every session
 * opened with a run of near-empty cards being tapped through - eight taps
 * before the first swing, and the ancillary moves are the ones with the fewest
 * pictures and the least to say. A list he works down at his own pace is the
 * honest shape for a block that has no timer and no rests.
 *
 * The ticks are deliberately not persisted. They are scratch marks for the next
 * ninety seconds; a half-ticked warm-up restored three days later would be
 * noise, and the app already remembers the one thing worth remembering, which
 * is which step he is on.
 */

const detail = (s: WorkStep): string => {
  const count = s.reps !== undefined ? `${s.reps} reps` : s.seconds !== undefined ? `${s.seconds} seconds` : '';
  const side = s.side === 'left' ? 'left' : s.side === 'right' ? 'right' : '';
  const bell = s.bellKg === null ? '' : `${s.bellKg} kg`;
  return [count, side, bell].filter(Boolean).join(' · ');
};

/** One line, not three. A warm-up cue he has to read twice is a cue he skips. */
const oneCue = (e: Exercise | undefined): string =>
  e?.cues.execution[0] ?? e?.cues.setup[0] ?? e?.cues.mistakes[0] ?? '';

export function AncillaryChecklist({
  steps,
  exercises,
  onDone,
}: {
  steps: Step[];
  exercises: ReadonlyMap<string, Exercise>;
  onDone: () => void;
}) {
  const items = steps.filter((s): s is WorkStep => s.kind === 'work');
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());

  const toggle = (i: number): void =>
    setTicked((previous) => {
      const next = new Set(previous);
      if (!next.delete(i)) next.add(i);
      return next;
    });

  const block = items[0]?.block ?? steps[0]?.block ?? 'Warm-up';
  const allDone = items.length > 0 && ticked.size === items.length;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">{block}</h1>
        <p className="text-base font-bold tabular-nums text-[var(--text)]">
          {`${ticked.size} of ${items.length}`}
        </p>
      </div>

      {/* Scrolls inside the card rather than the page, so the Done button and
          the bottom row stay where his thumb last found them. */}
      <ul className="flex max-h-[52vh] flex-col gap-1 overflow-y-auto">
        {items.map((s, i) => {
          const done = ticked.has(i);
          return (
            <li key={`${s.exerciseId}-${s.side ?? 'both'}-${i}`}>
              <label className="tap-target flex w-full cursor-pointer items-center gap-4 rounded-[var(--radius)] px-2 py-3">
                {/* A real checkbox, tinted. Native gives the tick, the hit area,
                    the keyboard and the announced state for nothing. */}
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(i)}
                  className="h-7 w-7 shrink-0 accent-[var(--accent)]"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`text-xl font-bold leading-tight text-[var(--text)] ${done ? 'line-through' : ''}`}
                  >
                    {s.name}
                  </span>
                  <span className="text-base font-medium leading-tight text-[var(--text)]">{detail(s)}</span>
                  {oneCue(exercises.get(s.exerciseId)) && (
                    <span className="text-sm leading-snug text-[var(--text)]">
                      {oneCue(exercises.get(s.exerciseId))}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <Button variant={allDone ? 'primary' : 'ghost'} onClick={onDone}>
        Done
      </Button>
    </Card>
  );
}
