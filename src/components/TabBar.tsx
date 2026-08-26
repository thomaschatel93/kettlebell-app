'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
   Four tabs, and one screen they must not appear on.

   `/workout/run` is the phone on the floor with a bell in his hands, and the
   whole screen is one enormous Next button because that is the only thing he
   can reliably hit mid-set. A tab bar under it is four more targets a thumb
   can land on by accident, and landing on one means the workout screen is gone
   and the timer is out of sight. So the bar is not dimmed or disabled there, it
   is not rendered at all.
--------------------------------------------------------------------------- */
const HIDDEN_ON = '/workout/run';

/** The height reserved below the page, so the bar never covers the last row. */
const BAR_HEIGHT = 60;

type Tab = { href: string; label: string; icon: ReactNode; current: (path: string) => boolean };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const Icon = ({ children }: { children: ReactNode }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" {...stroke}>
    {children}
  </svg>
);

const TABS: Tab[] = [
  {
    href: '/',
    label: 'Home',
    // Exact, not a prefix: "/" is a prefix of every path in the app, so a
    // startsWith test would mark Home current on all four tabs at once.
    current: (path) => path === '/',
    icon: <Icon><path d="M4 11.2 12 4l8 7.2" /><path d="M6 10.5V20h12v-9.5" /></Icon>,
  },
  {
    href: '/workout',
    label: 'Workout',
    // Setup, preview and done are all one errand, so the tab stays lit through it.
    current: (path) => path.startsWith('/workout'),
    icon: <Icon><path d="M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10" /></Icon>,
  },
  {
    href: '/history',
    label: 'History',
    current: (path) => path.startsWith('/history'),
    icon: <Icon><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></Icon>,
  },
  {
    href: '/kit',
    label: 'Kit',
    current: (path) => path.startsWith('/kit'),
    icon: <Icon><path d="M5 8h4v8H5zM15 8h4v8h-4zM9 12h6M3 10.5v3M21 10.5v3" /></Icon>,
  },
];

/**
 * The bottom bar, and the space it stands in.
 *
 * `safe-bottom` is not decoration. The bar is `fixed`, which takes it out of
 * normal flow, so the `env(safe-area-inset-bottom)` padding `.app-shell` puts
 * on the body does not reach it - without its own inset the labels sit under
 * the iPhone home indicator and the bottom row of taps is swallowed by the
 * system gesture area.
 */
export function TabBar() {
  const pathname = usePathname();
  if (pathname === HIDDEN_ON) return null;

  return (
    <>
      {/* Holds the page clear of a fixed bar that would otherwise cover its last row. */}
      <div aria-hidden="true" style={{ height: BAR_HEIGHT }} />

      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-[var(--border)]
          bg-[var(--surface)]"
      >
        <ul className="mx-auto flex w-full max-w-md">
          {TABS.map((tab) => {
            const current = tab.current(pathname);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={current ? 'page' : undefined}
                  className={`tap-target flex flex-col items-center justify-center gap-1 py-2
                    text-xs font-bold transition-opacity active:opacity-80
                    ${current ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
