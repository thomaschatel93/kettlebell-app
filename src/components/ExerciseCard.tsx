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
 * IT DOES NOT SCROLL. That is the shape of the whole file. The card is a flex
 * column that fills the runner's region exactly and the picture takes whatever
 * is left over, so the move, the bell, the count and the still are on screen
 * together at every phone size without anyone having to guess a `vh`. The two
 * cue sets are disclosures underneath: reference material he opens between
 * sets, not something that pushes the picture off the top of the card.
 *
 * It holds no state and reads no clock: given a step and an exercise it always
 * draws the same thing, which is what lets the runner be tested separately from
 * what the runner draws.
 */

/**
 * A cue set behind one tap.
 *
 * Native `<details>`, so it works before hydration, takes a keyboard for
 * nothing, and needs no state that could disagree with what is on screen. The
 * default marker is dropped for the 44px tap target, so the caret has to be put
 * back or the row reads as a dead label.
 */
function CueDisclosure({
  label,
  accent = false,
  children,
}: {
  label: string;
  /** The warning set, marked as one. */
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group shrink-0">
      <summary
        className={`tap-target flex cursor-pointer list-none items-center gap-2 text-base font-bold
          uppercase tracking-wide [&::-webkit-details-marker]:hidden
          ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
      >
        {label}
        <span aria-hidden="true" className="text-sm transition-transform group-open:rotate-180">
          &#9662;
        </span>
      </summary>
      <div className="flex flex-col gap-3 pb-1 pt-1">{children}</div>
    </details>
  );
}

/**
 * `title` is optional because a set that has a disclosure of its own is already
 * named by the summary above it, and heading it twice is the same words twice
 * on a screen that has no room for either.
 */
function CueList({ title, items, big }: { title?: string; items: string[]; big: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {/* Full strength, not dimmed. `--text-dim` is banned on this screen and
          opacity is the one route `.read-far` cannot reach, so the label is held
          back by size and case alone. */}
      {title && <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text)]">{title}</h2>}
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
   * Most of the ancillary moves, and three of the main ones, ship with no
   * picture. Where there is none the media slot COLLAPSES - no dashed box, no
   * reserved space, no apology - and the execution cues are promoted to heading
   * size to fill the room the picture would have taken. A placeholder would be a
   * hole in the screen; a bigger cue is the same information the picture was
   * carrying.
   */
  const hasImage = image !== null;

  const prescription =
    step.reps !== undefined
      ? `${step.reps} reps`
      : step.seconds !== undefined
        ? `${step.seconds} seconds`
        : '';

  return (
    // `min-h-0 flex-1` so the card is bounded by the runner's region rather than
    // growing past it. Everything inside is `shrink-0` except the picture, which
    // is what makes the picture the thing that gives.
    <Card className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {/*
        The side, the bell and the count on ONE row.

        The side pill kept its size and lost its line. At 18px it was legible as
        a pill from a metre and the WORD inside it was not: you could tell a
        side had been named and not which one, and a misread here is a whole set
        on the wrong arm. So it is still set at heading size - the space it used
        to cost came from putting it beside the bell and the reps rather than
        above them, and from shortening "Left side" to the one word that does
        the work. It is the largest thing in the row, which is the right order:
        he knows the move, he does not know which arm without being told.
      */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {step.side && (
          <p
            className="rounded-full border px-3 py-1 text-3xl font-bold uppercase leading-tight tracking-tight"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--accent) 16%, var(--surface-2))',
              borderColor: 'color-mix(in oklab, var(--accent) 55%, var(--border))',
              color: 'var(--text)',
            }}
          >
            {step.side === 'left' ? 'Left' : 'Right'}
          </p>
        )}
        <span className="rounded-[var(--radius)] bg-[var(--surface-2)] px-2.5 py-1.5 text-2xl font-bold tabular-nums leading-tight text-[var(--text)]">
          {step.bellKg === null ? 'Bodyweight' : `${step.bellKg} kg`}
        </span>
        {prescription && (
          <span className="rounded-[var(--radius)] bg-[var(--accent)] px-2.5 py-1.5 text-2xl font-bold tabular-nums leading-tight text-[var(--fill-ink)]">
            {prescription}
          </span>
        )}
      </div>

      {/* The accessible name has to be the move and nothing else, so the side
          label above sits outside the heading rather than inside it. */}
      <h1 className="shrink-0 text-3xl font-bold leading-tight tracking-tight text-[var(--text)]">
        {step.name}
      </h1>

      {hasImage && (
        // A plain <img>: these stills are already sized and flattened onto
        // --surface by the media pipeline, and their intrinsic dimensions vary
        // move by move, which is exactly the case next/image cannot size without
        // being told.
        //
        // `flex-1 min-h-0` rather than a fixed `vh`: the picture is the one
        // element that may give, so it takes whatever the row of chips, the
        // name and the two disclosure rows leave behind, on any phone, with a
        // one-line name or a two-line one. The floor stops it collapsing to a
        // sliver when both disclosures are open - past that the region scrolls,
        // which is the correct answer for a card he has deliberately expanded.
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
          className="min-h-36 w-full min-w-0 flex-1 rounded-[var(--radius)] bg-[var(--surface)] object-contain"
        />
      )}

      {hasImage ? (
        // With a picture on screen the how-to is reference material, so both
        // sets fold away and the picture keeps the space.
        <CueDisclosure label="How to do it">
          <CueList title="Setup" items={cues?.setup ?? []} big={false} />
          <CueList title="Execution" items={cues?.execution ?? []} big={false} />
        </CueDisclosure>
      ) : (
        <>
          {/*
            With no picture the EXECUTION cues are what the picture was
            carrying, so those are the ones promoted and those are the ones that
            stay on screen. Setting every cue to heading size instead made the
            card two and a half screens tall, which is the problem this whole
            layout exists to fix - so the setup lines fold away behind their own
            name rather than under "How to do it", which would be a lie about
            where the how-to actually is.
          */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CueList title="Execution" items={cues?.execution ?? []} big />
          </div>
          <CueDisclosure label="Setup">
            <CueList items={cues?.setup ?? []} big={false} />
          </CueDisclosure>
        </>
      )}

      {/*
        A toggle rather than a standing line. It used to sit open at the foot of
        every card, which is a third of the height of a phone spent on a warning
        he has read forty times - and it was the thing pushing the picture into
        a scroll. Behind one accent-coloured tap it is still one tap away on the
        set where he wants it.
      */}
      <CueDisclosure label="Watch out for" accent>
        <CueList items={cues?.mistakes ?? []} big={false} />
      </CueDisclosure>
    </Card>
  );
}
