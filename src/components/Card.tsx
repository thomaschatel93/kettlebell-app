import type { ReactNode } from 'react';

/**
 * The dark panel everything sits on. Its background is --surface, the exact
 * colour the exercise stills were flattened onto, so an image dropped straight
 * into a Card has no visible edge.
 */
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}>
    {children}
  </div>
);
