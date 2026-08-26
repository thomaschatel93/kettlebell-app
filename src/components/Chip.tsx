'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { Pattern } from '@/lib/types';

/**
 * How much of the pattern's own colour is washed into an unselected chip.
 *
 * This is a contrast budget, not a taste setting. The subtitle sits on this
 * tint in --text-dim, and the brighter the wash the closer that gets to
 * failing AA. Measured across all six patterns:
 *
 *   tint  worst --text-dim contrast
 *   16%   4.46  (--hinge)   FAILS AA
 *   12%   4.83  (--hinge)   passes, thin
 *   10%   4.99  (--hinge)
 *    8%   5.19  (--hinge)   <- chosen, real margin
 *
 * Raise this and the subtitle stops passing on the bright patterns first
 * (hinge, squat, carry). `primitives.test.tsx` pins the number.
 */
export const CHIP_TINT_PCT = 8;

/** How much of the pattern colour edges the chip. Border, so no text sits on it. */
const CHIP_EDGE_PCT = 45;

/**
 * A movement-pattern pill. `tone` is a Pattern rather than a string, so a typo
 * cannot silently resolve to var(--hing) and render an uncoloured chip.
 *
 * Unselected, the chip carries a wash of its own colour so the pattern is
 * identifiable before it is chosen. Selected, it fills solid and the ink flips
 * to --fill-ink, the token for text on a filled control: dark ink on all six
 * pattern colours clears AA, worst being --pull at 4.97:1. The subtitle is why
 * it cannot be --accent-ink - see the note in globals.css.
 */
export function Chip({
  children,
  tone,
  subtitle,
  selected = false,
  onClick,
}: {
  children: ReactNode;
  tone: Pattern;
  subtitle?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const shell: CSSProperties = selected
    ? {
        backgroundColor: `var(--${tone})`,
        borderColor: `var(--${tone})`,
        color: 'var(--fill-ink)',
      }
    : {
        backgroundColor: `color-mix(in oklab, var(--${tone}) ${CHIP_TINT_PCT}%, var(--surface-2))`,
        borderColor: `color-mix(in oklab, var(--${tone}) ${CHIP_EDGE_PCT}%, var(--border))`,
        color: 'var(--text)',
      };

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={shell}
      className="tap-target inline-flex flex-col justify-center gap-0.5 rounded-[var(--radius)]
        border px-4 py-2.5 text-left transition-opacity active:opacity-80"
    >
      <span className="text-base font-bold leading-tight">{children}</span>
      {subtitle && (
        // Routed through --text-dim, never opacity, so .read-far can lift it.
        <span
          className="text-xs font-medium leading-tight"
          style={{ color: selected ? 'var(--fill-ink)' : 'var(--text-dim)' }}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}

/**
 * The same pill, read-only: what a finished session trained.
 *
 * Not a `Chip` with `onClick` left off. A Chip is a control - it carries
 * `aria-pressed`, so a screen reader announces "Hinge, not pressed, button" for
 * a label that was never selectable and cannot be pressed. This is a label, so
 * it is a span, and it shares the tint constants above rather than restating
 * them, which is what keeps the measured contrast budget in one place.
 */
export function PatternTag({ tone, children }: { tone: Pattern; children: ReactNode }) {
  return (
    <span
      style={{
        backgroundColor: `color-mix(in oklab, var(--${tone}) ${CHIP_TINT_PCT}%, var(--surface-2))`,
        borderColor: `color-mix(in oklab, var(--${tone}) ${CHIP_EDGE_PCT}%, var(--border))`,
        color: 'var(--text)',
      }}
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold leading-none"
    >
      {children}
    </span>
  );
}
