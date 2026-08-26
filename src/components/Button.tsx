'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const STYLES: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)]',
  ghost: 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]',
  danger: 'bg-transparent text-[var(--accent)] border border-[var(--border)]',
};

/**
 * The one control the app is driven by, usually the only thing on screen the
 * user can reach mid-set.
 *
 * The label is fixed at 20px/700. That is not decoration: white on --accent
 * measures 3.3:1, which clears WCAG AA only at large-text size (>=18.66px
 * bold). Shrink the type and the primary button stops passing. It is also the
 * size a person reads from a metre away with a bell in the other hand.
 */
export function Button({
  variant = 'primary',
  fullWidth = true,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; fullWidth?: boolean }) {
  return (
    <button
      {...rest}
      type={type}
      className={`tap-target inline-flex items-center justify-center gap-2
        rounded-[var(--radius)] px-6 py-4 text-xl font-bold leading-none tracking-tight
        transition-opacity active:opacity-80 disabled:opacity-40
        ${fullWidth ? 'w-full' : ''} ${STYLES[variant]} ${className}`}
    />
  );
}
