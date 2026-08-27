'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

/**
 * The type size and weight the primary button may not go below.
 *
 * White on --accent measures 3.32:1. That clears WCAG AA only as *large text*
 * (3:1, meaning >=18.66px bold); as normal text it needs 4.5:1 and fails. So
 * 20px/700 is not a style choice, it is the thing keeping this button
 * accessible, and `primitives.test.tsx` asserts the primary variant carries it.
 *
 * If a small label on --accent is ever needed, that is what --fill-ink is for:
 * near-black, 5.90:1, legal at any size. Use it there rather than shrinking
 * this, and see the note in globals.css for which ink goes where.
 */
export const ACCENT_SAFE_TYPE = 'text-xl font-bold';

const STYLES: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)]',
  ghost: 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]',
  danger: 'bg-transparent text-[var(--accent)] border border-[var(--border)]',
};

/**
 * The disabled look, as a token pair rather than `opacity`.
 *
 * `opacity` composited the whole button against the page: white on --accent at
 * 40% came out 2.11:1, an effectively invisible control on the workout screen,
 * and opacity is the one dimming route `.read-far` cannot reach. Routed through
 * --text-dim instead it measures 5.88:1, and inside `.read-far` the guard lifts
 * it to 15.09:1.
 */
const DISABLED =
  'disabled:bg-[var(--surface-2)] disabled:text-[var(--text-dim)] ' +
  'disabled:border disabled:border-[var(--border)] disabled:cursor-not-allowed';

/**
 * The look, on its own, so a real link can wear it.
 *
 * Home's "Start a workout" and "Resume workout" are navigation, not actions:
 * they want to be anchors, so they prefetch, open in a new tab and read as
 * links to a screen reader. Restyling an anchor to match by hand would fork the
 * one control the app is driven by - and the fork would quietly drop the 44px
 * floor or the large-text size that keeps white on --accent legal. Handing out
 * the class string keeps one definition of both.
 */
export function buttonClass(
  variant: Variant = 'primary',
  fullWidth = true,
  className = '',
): string {
  return `tap-target inline-flex items-center justify-center gap-2
    rounded-[var(--radius)] px-6 py-4 ${ACCENT_SAFE_TYPE} leading-none tracking-tight
    transition-opacity active:opacity-80 ${DISABLED}
    ${fullWidth ? 'w-full' : ''} ${STYLES[variant]} ${className}`;
}

/**
 * The one control the app is driven by, usually the only thing on screen the
 * user can reach mid-set.
 */
export function Button({
  variant = 'primary',
  fullWidth = true,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; fullWidth?: boolean }) {
  return <button {...rest} type={type} className={buttonClass(variant, fullWidth, className)} />;
}
