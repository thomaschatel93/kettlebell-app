import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, ACCENT_SAFE_TYPE } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, CHIP_TINT_PCT } from '@/components/Chip';
import { ProgressBar } from '@/components/ProgressBar';
import { Ring } from '@/components/Ring';

describe('Button', () => {
  it('renders its label as a real button', () => {
    render(<Button>Start</Button>);
    screen.getByRole('button', { name: 'Start' });
  });

  it('marks itself disabled when asked', () => {
    render(<Button disabled>Start</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not submit a surrounding form unless it is asked to', () => {
    render(<Button>Start</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('keeps the primary label at large-text size, because white on --accent is 3.32:1 and clears AA at no smaller', () => {
    render(<Button>Start</Button>);
    const cls = screen.getByRole('button').className;
    for (const token of ACCENT_SAFE_TYPE.split(' ')) expect(cls).toContain(token);
  });

  it('pins that safe type at 20px/700, the point where 3.32:1 becomes large text', () => {
    expect(ACCENT_SAFE_TYPE).toBe('text-xl font-bold');
  });

  it('carries the 44px tap floor rather than trusting the caller to add it', () => {
    render(<Button>Start</Button>);
    expect(screen.getByRole('button').className).toContain('tap-target');
  });

  it('dims when disabled through a token pair, not opacity, which .read-far cannot reach', () => {
    render(<Button disabled>Start</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('disabled:text-[var(--text-dim)]');
    expect(cls).toContain('disabled:bg-[var(--surface-2)]');
    // opacity composited the whole button to 2.11:1, an invisible control.
    expect(cls).not.toMatch(/disabled:opacity/);
  });
});

describe('Card', () => {
  it('renders what it is given', () => {
    render(<Card><p>Turkish get-up</p></Card>);
    screen.getByText('Turkish get-up');
  });
});

describe('Chip', () => {
  it('reports its selected state to assistive technology', () => {
    render(<Chip tone="hinge" selected onClick={() => {}}>Hinge</Chip>);
    expect(screen.getByRole('button', { name: /Hinge/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports an unselected chip as unpressed rather than saying nothing', () => {
    render(<Chip tone="hinge" onClick={() => {}}>Hinge</Chip>);
    expect(screen.getByRole('button', { name: /Hinge/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the body parts under the pattern name', () => {
    render(<Chip tone="push" subtitle="shoulders, chest, triceps" onClick={() => {}}>Push</Chip>);
    screen.getByText('shoulders, chest, triceps');
  });

  it('takes its colour from the pattern token, never a literal', () => {
    render(<Chip tone="squat" selected onClick={() => {}}>Squat</Chip>);
    expect(screen.getByRole('button').getAttribute('style')).toContain('var(--squat)');
  });

  it('dims the subtitle through --text-dim, so the read-far guard can lift it', () => {
    render(<Chip tone="pull" subtitle="back, biceps" onClick={() => {}}>Pull</Chip>);
    expect(screen.getByText('back, biceps').getAttribute('style')).toContain('var(--text-dim)');
  });

  it('keeps the tint at 8%, above which the subtitle fails AA on the bright patterns', () => {
    // 16% put --text-dim at 4.46:1 on --hinge. 8% measures 5.19:1.
    expect(CHIP_TINT_PCT).toBeLessThanOrEqual(8);
    render(<Chip tone="hinge" subtitle="glutes, hamstrings, back" onClick={() => {}}>Hinge</Chip>);
    expect(screen.getByRole('button').getAttribute('style')).toContain(`${CHIP_TINT_PCT}%`);
  });

  it('carries the 44px tap floor rather than trusting the caller to add it', () => {
    render(<Chip tone="core" onClick={() => {}}>Core</Chip>);
    expect(screen.getByRole('button').className).toContain('tap-target');
  });
});

describe('ProgressBar', () => {
  it('exposes its position', () => {
    render(<ProgressBar value={3} max={10} label="Workout progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Workout progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
  });

  it('never reports a position past the end', () => {
    render(<ProgressBar value={15} max={10} label="Workout progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
  });

  it('survives a zero maximum without dividing by it', () => {
    render(<ProgressBar value={0} max={0} label="Workout progress" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.innerHTML).not.toContain('NaN');
  });
});

describe('Ring', () => {
  it('reads its value out for assistive technology', () => {
    render(<Ring value={2} max={5} label="Workouts this week" caption="this week" />);
    screen.getByRole('img', { name: 'Workouts this week: 2 of 5' });
  });

  it('survives a zero maximum without dividing by it', () => {
    render(<Ring value={0} max={0} label="Workouts this week" />);
    const ring = screen.getByRole('img', { name: 'Workouts this week: 0 of 0' });
    expect(ring.innerHTML).not.toContain('NaN');
  });

  it('announces the number it actually draws, never a count past the maximum', () => {
    render(<Ring value={9} max={5} label="Workouts this week" />);
    const ring = screen.getByRole('img', { name: 'Workouts this week: 5 of 5' });
    expect(ring.textContent).toContain('5');
    expect(ring.textContent).not.toContain('9');
  });
});
