'use client';

import type { ReactNode } from 'react';

/**
 * A control filled with the accent.
 *
 * The ink is --fill-ink, the token globals.css defines for text on a filled
 * control, and NOT --accent-ink. That distinction is the accessibility of these
 * screens: --accent-ink is white, 3.32:1 on the accent, which clears AA only as
 * large text (>=18.66px bold - what ACCENT_SAFE_TYPE pins on Button). These
 * controls carry small labels and subtitles, so they need the ink that passes at
 * any size. `tokens.test.ts` pins the token pair and the screen tests pin each
 * use of it.
 */
export const FILLED_CONTROL = {
  backgroundColor: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: 'var(--fill-ink)',
} as const;

/** The unfilled body every selectable control on Kit and Setup shares. */
export const OPTION_SHELL =
  'tap-target w-full rounded-[var(--radius)] border border-[var(--border)] ' +
  'bg-[var(--surface-2)] text-left transition-opacity active:opacity-80';

/**
 * One option out of a set: a place to train, an effort, a length, a format.
 *
 * Button and Chip are deliberately not reused for these. Button has no selected
 * state and no subtitle slot, and forces a single 20px bold label; Chip's `tone`
 * is typed as a movement Pattern on purpose, so a weight or a length of session
 * has no legal tone, and colouring a 45-minute chip --hinge would misuse hues
 * that carry movement identity and nothing else.
 *
 * `hint` is optional and changes the accessible name when present, so a control
 * whose name has to read exactly ("Easy", "45 min") simply leaves it off.
 */
export function Option({
  children,
  hint,
  selected = false,
  onClick,
  className = '',
}: {
  children: ReactNode;
  hint?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={selected ? FILLED_CONTROL : undefined}
      className={`${OPTION_SHELL} flex flex-col justify-center px-4 py-3 ${className}`}
    >
      <span className="block text-base font-bold leading-tight">{children}</span>
      {hint && (
        // Routed through --text-dim, never opacity, so .read-far can lift it.
        <span
          className="block text-sm leading-tight"
          style={{ color: selected ? 'var(--fill-ink)' : 'var(--text-dim)' }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}
