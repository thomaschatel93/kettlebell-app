'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { Pattern } from '@/lib/types';

/**
 * A movement-pattern pill. `tone` is a Pattern rather than a string, so a typo
 * cannot silently resolve to var(--hing) and render an uncoloured chip.
 *
 * Unselected, the chip still carries a wash of its own colour, so the pattern
 * is identifiable before it is chosen. Selected, it fills solid and the ink
 * flips to --bg: dark ink on all six pattern colours clears AA (4.97:1 on the
 * worst of them, --pull).
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
        color: 'var(--bg)',
      }
    : {
        backgroundColor: `color-mix(in oklab, var(--${tone}) 16%, var(--surface-2))`,
        borderColor: `color-mix(in oklab, var(--${tone}) 45%, var(--border))`,
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
          style={{ color: selected ? 'var(--bg)' : 'var(--text-dim)' }}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}
