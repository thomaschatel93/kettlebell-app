import { Card } from '@/components/Card';
import type { Exercise, WorkStep } from '@/lib/types';

/**
 * One move, mid-set, read from a metre away.
 *
 * Everything about this component is decided by where the phone is: on the
 * floor or a bench, an arm's length off, with music playing and sweat on the
 * glass. So the name and the prescription are the largest things on it, the
 * side is a label rather than a suffix, and nothing anywhere routes through
 * `--text-dim`.
 *
 * It holds no state and reads no clock: given a step and an exercise it always
 * draws the same thing, which is what lets the runner be tested separately from
 * what the runner draws.
 */

/** The one line of a cue set that is always on screen, image or no image. */
function Mistakes({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--accent)]">Watch out for</h2>
      <ul className="flex flex-col gap-1">
        {items.map((line) => (
          <li key={line} className="text-base font-medium leading-snug text-[var(--text)]">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CueList({ title, items, big }: { title: string; items: string[]; big: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {/* Full strength, not dimmed. `--text-dim` is banned on this screen and
          opacity is the one route `.read-far` cannot reach, so the label is held
          back by size and case alone. */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text)]">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((line) => (
          <li
            key={line}
            className={`leading-snug text-[var(--text)] ${big ? 'text-2xl font-bold tracking-tight' : 'text-base font-medium'}`}
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExerciseCard({
  step,
  exercise,
}: {
  step: WorkStep;
  /**
   * Null where the step names an exercise this build does not have - a workout
   * stored before the exercise list changed under it. The card degrades to the
   * name, the bell and the count rather than blanking the screen he is standing
   * in front of.
   */
  exercise: Exercise | null;
}) {
  const cues = exercise?.cues;
  const image = exercise?.image ?? null;

  /**
   * Three exercises ship with no picture on purpose. Where there is none the
   * media slot COLLAPSES - no dashed box, no reserved space, no apology - and
   * the cues are promoted to heading size to fill the room the picture would
   * have taken. A placeholder would be a hole in the screen; a bigger cue is
   * the same information the picture was carrying.
   */
  const hasImage = image !== null;

  const prescription =
    step.reps !== undefined
      ? `${step.reps} reps`
      : step.seconds !== undefined
        ? `${step.seconds} seconds`
        : '';

  return (
    <Card className="flex flex-col gap-4">
      {/*
        Sized like a heading, not like a tag.

        At a metre this was the failure the whole card exists to prevent. At
        18px the pill was legible as a pill but the WORD was not: you could see
        that a side was named and not which one, and a misread here is a whole
        set on the wrong arm. It is now larger than the bell and the rep count
        beside it, which is the right order - he knows the move, he does not
        know which side without being told.
      */}
      {step.side && (
        <p
          className="self-start rounded-full border px-4 py-1.5 text-3xl font-bold uppercase tracking-wide"
          style={{
            backgroundColor: 'color-mix(in oklab, var(--accent) 16%, var(--surface-2))',
            borderColor: 'color-mix(in oklab, var(--accent) 55%, var(--border))',
            color: 'var(--text)',
          }}
        >
          {step.side === 'left' ? 'Left side' : 'Right side'}
        </p>
      )}

      {/* The accessible name has to be the move and nothing else, so the side
          label above sits outside the heading rather than inside it. */}
      <h1 className="text-4xl font-bold leading-tight tracking-tight text-[var(--text)]">{step.name}</h1>

      <div className="flex flex-wrap items-center gap-2">
        {/* 30px, not 24: this is the number he counts against mid-set. */}
        <span className="rounded-[var(--radius)] bg-[var(--surface-2)] px-4 py-2 text-3xl font-bold tabular-nums text-[var(--text)]">
          {step.bellKg === null ? 'Bodyweight' : `${step.bellKg} kg`}
        </span>
        {prescription && (
          <span className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-3xl font-bold tabular-nums text-[var(--fill-ink)]">
            {prescription}
          </span>
        )}
      </div>

      {hasImage && (
        // A plain <img>: these stills are already sized and flattened onto
        // --surface by the media pipeline, and their intrinsic dimensions vary
        // move by move, which is exactly the case next/image cannot size without
        // being told. The box is fixed so nothing shifts as it loads.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          // Named rather than empty. The heading already says which move it is,
          // but "illustration of X" is what tells someone who cannot see it
          // that a picture is what the sighted reader is getting here, rather
          // than leaving a silent gap in the middle of the card.
          alt={`Illustration of ${step.name}`}
          loading="eager"
          decoding="async"
          className="h-[32vh] w-full rounded-[var(--radius)] bg-[var(--surface)] object-contain"
        />
      )}

      <div className="flex flex-col gap-3">
        {hasImage ? (
          // With a picture on screen the how-to is reference material, so it
          // folds away and the picture keeps the space. Native <details>, so it
          // works before hydration and takes a keyboard for free.
          <details className="group">
            <summary className="tap-target flex cursor-pointer list-none items-center gap-2 text-base font-bold text-[var(--text)]">
              How to do it
              {/* The default marker is dropped for the tap target, so the
                  affordance has to be put back or this reads as a dead label. */}
              <span aria-hidden="true" className="text-sm transition-transform group-open:rotate-180">
                &#9662;
              </span>
            </summary>
            <div className="flex flex-col gap-3 pt-2">
              <CueList title="Setup" items={cues?.setup ?? []} big={false} />
              <CueList title="Execution" items={cues?.execution ?? []} big={false} />
            </div>
          </details>
        ) : (
          // With no picture the EXECUTION cues are what the picture was
          // carrying, so those are the ones promoted. Setting every cue to
          // heading size instead made the card two and a half screens tall,
          // which buries the mistakes line and the controls under a scroll -
          // a worse answer than the missing picture was.
          <>
            <CueList title="Execution" items={cues?.execution ?? []} big />
            <CueList title="Setup" items={cues?.setup ?? []} big={false} />
          </>
        )}

        <Mistakes items={cues?.mistakes ?? []} />
      </div>
    </Card>
  );
}
