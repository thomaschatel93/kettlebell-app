import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabBar } from '@/components/TabBar';

const path = { current: '/' };
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

beforeEach(() => { path.current = '/'; });

describe('TabBar', () => {
  it('offers the four places the app goes', () => {
    render(<TabBar />);
    for (const name of ['Home', 'Workout', 'History', 'Kit']) {
      expect(screen.getByRole('link', { name })).toBeDefined();
    }
  });

  it('marks the current tab, and only that one', () => {
    path.current = '/history';
    render(<TabBar />);
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark Home current on every other screen, which "/" would match by prefix', () => {
    path.current = '/kit';
    render(<TabBar />);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Kit' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the Workout tab current through the rest of the flow', () => {
    path.current = '/workout/preview';
    render(<TabBar />);
    expect(screen.getByRole('link', { name: 'Workout' })).toHaveAttribute('aria-current', 'page');
  });

  /**
   * Nothing sits under the thumb mid-set. A tap bar one thumb-width from Next
   * is how a man in the middle of a swing set ends up on the Kit screen.
   */
  it('is gone entirely on the running workout', () => {
    path.current = '/workout/run';
    const { container } = render(<TabBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('carries its own safe-area inset, because a fixed bar ignores the body padding', () => {
    render(<TabBar />);
    const bar = screen.getByRole('navigation');
    expect(bar.className).toContain('safe-bottom');
    expect(bar.className).toContain('fixed');
  });

  it('gives every tab the 44px tap floor', () => {
    render(<TabBar />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('tap-target');
    }
  });
});
