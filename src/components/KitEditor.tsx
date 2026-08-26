'use client';

import { Card } from '@/components/Card';
import { FILLED_CONTROL, OPTION_SHELL, Option } from '@/components/Option';
import { isUnderSpecified } from '@/lib/kit';
import { isKitHydrated, publishKit, useKit } from '@/lib/kit-store';
import { CAPABILITIES, type Capability, type KitProfile } from '@/lib/types';

/**
 * The sizes bells actually come in. A row of these beats a number input: this is
 * the first control a new user touches, often with chalk or wet hands, and a
 * keyboard invites 2.4 or 240 where 24 was meant.
 */
const WEIGHTS = [8, 12, 16, 20, 24, 28, 32, 40] as const;

/**
 * Capability is phrased as ability, never as effort. "How hard today" is a
 * separate control on the Setup screen; this one decides which exercises exist
 * at all, and it changes over months rather than sessions.
 */
const CAPABILITY_COPY: Record<Capability, { label: string; hint: string }> = {
  beginner: { label: 'I’m starting out', hint: 'Swings, deadlifts, goblet squats' },
  intermediate: { label: 'I’m comfortable with the basics', hint: 'Cleans, presses, front squats' },
  advanced: { label: 'I can snatch and get up', hint: 'Snatches, get-ups, windmills' },
};

/** "an 8 kg bell", not "a 8 kg bell". Only the 8 takes it in this list. */
const article = (kg: number): string => (/^(8|11|18)/.test(String(kg)) ? 'an' : 'a');

const bellSummary = (kit: KitProfile): string => {
  const total = kit.bells.reduce((n, b) => n + b.count, 0);
  return total === 0 ? 'No bells yet' : `${total} ${total === 1 ? 'bell' : 'bells'}`;
};

/**
 * The filled look and the unfilled body both live in `Option`, so this screen
 * and the Setup screen cannot drift into two versions of the same control - or,
 * worse, two answers to which ink is legal on a filled background. See the note
 * there, and in globals.css, for why it is --fill-ink and never --accent-ink.
 */
const FILLED = FILLED_CONTROL;
const SHELL = OPTION_SHELL;

/**
 * The first screen with anything at stake: which bells exist decides every
 * prescription the engine can make.
 *
 * Two profiles, fixed. Not addable, deletable or renameable - an activeId naming
 * a profile that no longer existed used to crash the generator, and the fixed
 * pair deletes that whole class of invalid state rather than defending against
 * it. There is deliberately no add or delete control here to reintroduce it.
 */
export function KitEditor() {
  const state = useKit();

  // Keeps the live region quiet until there is something true to say, rather
  // than announcing an empty kit on every page load and correcting itself.
  const hydrated = isKitHydrated(state);

  // Storage guarantees activeId names a profile that exists; the fallback is
  // only here because the type cannot know that.
  const active = state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0];

  const mapActive = (f: (p: KitProfile) => KitProfile) =>
    publishKit({ ...state, profiles: state.profiles.map((p) => (p.id === active.id ? f(p) : p)) });

  /** A weight already in the kit gains a count. Two rows of 16 kg is not a thing. */
  const addBell = (weightKg: number) =>
    mapActive((p) => ({
      ...p,
      bells: p.bells.some((b) => b.weightKg === weightKg)
        ? p.bells.map((b) => (b.weightKg === weightKg ? { ...b, count: b.count + 1 } : b))
        : [...p.bells, { weightKg, count: 1 }].sort((a, b) => a.weightKg - b.weightKg),
    }));

  /** Down to zero takes the row away; a bell you own none of is not a bell. */
  const removeBell = (weightKg: number) =>
    mapActive((p) => ({
      ...p,
      bells: p.bells
        .map((b) => (b.weightKg === weightKg ? { ...b, count: b.count - 1 } : b))
        .filter((b) => b.count > 0),
    }));

  // Said in plain words, because prescribe() quietly cuts the reps on everything
  // below the heavy band when this is true. The app must not sound confident
  // where its own model has broken down.
  const warning = !hydrated || !isUnderSpecified(active)
    ? ''
    : active.bells.length === 0
      ? 'No bells here yet. Add what you own, or this kit cannot build a workout at all.'
      : 'Fewer than three different weights, so light, moderate and heavy all land on one bell. '
        + 'Until you add another, the reps on pressing and grinding work are cut back rather than done at swing weight.';

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight">Where you train</h2>

        <div className="grid grid-cols-2 gap-3">
          {state.profiles.map((p) => (
            <Option
              key={p.id}
              selected={p.id === active.id}
              hint={bellSummary(p)}
              onClick={() => publishKit({ ...state, activeId: p.id })}
            >
              {p.name}
            </Option>
          ))}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={active.hasBench}
          onClick={() => mapActive((p) => ({ ...p, hasBench: !p.hasBench }))}
          className={`${SHELL} flex items-center justify-between gap-4 px-4 py-3`}
        >
          <span>
            <span className="block text-base font-bold leading-tight">Bench</span>
            <span className="block text-sm leading-tight text-[var(--text-dim)]">
              For the moves that need one
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors
              ${active.hasBench
                ? 'border-[var(--accent)] bg-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--surface)]'}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-[var(--text)] transition-[left]
                ${active.hasBench ? 'left-7' : 'left-1'}`}
            />
          </span>
        </button>
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Bells</h2>
          <p className="text-sm text-[var(--text-dim)]">
            Tap a weight to add one. Tap it again if you have a pair.
          </p>
        </div>

        {active.bells.length > 0 && (
          <ul className="flex flex-col gap-2">
            {active.bells.map((b) => (
              <li
                key={b.weightKg}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)]
                  border border-[var(--border)] bg-[var(--surface-2)] py-1 pl-4 pr-1"
              >
                <span className="text-base font-bold">{`${b.weightKg} kg × ${b.count}`}</span>
                <button
                  type="button"
                  aria-label={`Remove ${article(b.weightKg)} ${b.weightKg} kg bell`}
                  onClick={() => removeBell(b.weightKg)}
                  className="tap-target inline-flex items-center justify-center rounded-[var(--radius)]
                    text-2xl leading-none text-[var(--text)] transition-opacity active:opacity-80"
                >
                  <span aria-hidden="true">−</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-4 gap-2">
          {WEIGHTS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Add ${article(w)} ${w} kg bell`}
              onClick={() => addBell(w)}
              className={`${SHELL} flex flex-col items-center justify-center px-2 py-2 text-center`}
            >
              <span className="text-lg font-bold leading-none">{w}</span>
              <span className="text-xs leading-none text-[var(--text-dim)]">kg</span>
            </button>
          ))}
        </div>

        {/*
          Mounted whether or not it has anything to say: a live region added to
          the page at the same moment as its text is unreliably announced.
        */}
        <div role="status">
          {warning && (
            <p
              className="rounded-[var(--radius)] border p-3 text-sm text-[var(--text)]"
              style={{
                backgroundColor: 'color-mix(in oklab, var(--accent) 12%, var(--surface-2))',
                borderColor: 'color-mix(in oklab, var(--accent) 45%, var(--border))',
              }}
            >
              {warning}
            </p>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 id="capability-heading" className="text-lg font-bold tracking-tight">
            What you can do
          </h2>
          <p className="text-sm text-[var(--text-dim)]">
            This decides which exercises appear at all. It changes over months, not sessions.
          </p>
        </div>

        {/*
          A radiogroup of real radios, not a row of pressed buttons. These three
          are mutually exclusive - picking one unpicks the others - and that is
          what a screen reader should be told, along with "2 of 3". Native
          inputs come with the arrow-key behaviour a radiogroup is expected to
          have; the input is visually hidden and the label carries the look and
          the 44px target, so the focus ring is drawn from the label instead.
        */}
        <div role="radiogroup" aria-labelledby="capability-heading" className="flex flex-col gap-2">
          {CAPABILITIES.map((capability) => {
            const selected = capability === state.capability;
            const { label, hint } = CAPABILITY_COPY[capability];
            return (
              <label
                key={capability}
                style={selected ? FILLED : undefined}
                className={`${SHELL} flex cursor-pointer flex-col justify-center px-4 py-3
                  has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px]
                  has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]`}
              >
                <input
                  type="radio"
                  name="capability"
                  value={capability}
                  checked={selected}
                  onChange={() => publishKit({ ...state, capability })}
                  className="sr-only"
                />
                <span className="block text-base font-bold leading-tight">{label}</span>
                <span
                  className="block text-sm leading-tight"
                  style={{ color: selected ? 'var(--fill-ink)' : 'var(--text-dim)' }}
                >
                  {hint}
                </span>
              </label>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
