import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { RestCard } from '@/components/RestCard';
import { ex } from '../fixtures';
import type { WorkStep } from '@/lib/types';

const step = (over: Partial<WorkStep> = {}): WorkStep => ({
  kind: 'work', exerciseId: 'a', name: 'Two-Hand Swing', bellKg: 24, reps: 15,
  block: 'Main', round: 1, totalRounds: 3, indexInRound: 2, itemsInRound: 5, estSeconds: 30,
  ...over,
} as WorkStep);

describe('ExerciseCard', () => {
  it('shows the name, the bell and the prescription', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    screen.getByRole('heading', { name: 'Two-Hand Swing' });
    screen.getByText('24 kg');
    screen.getByText('15 reps');
  });

  it('names the side for unilateral work', () => {
    render(<ExerciseCard step={step({ side: 'left' })} exercise={ex('a')} />);
    screen.getByText(/left/i);
  });

  /**
   * Sized so it can be READ across the room, not merely seen.
   *
   * At 18px the pill was legible as a pill from a metre and the word inside it
   * was not: you could tell a side had been named and not which one. That is
   * the one misreading on this screen that costs a whole set on the wrong arm,
   * so the size is pinned rather than left to whoever next tidies the classes.
   *
   * The card was later rebuilt to stop it scrolling, and every other piece of
   * type on it came down. This one did not: 30px is ~12.4 arcmin of cap height
   * at a metre on a 375pt phone, against the ~7.4 that failed. It paid for its
   * space by moving onto the row with the bell and the reps and by dropping the
   * word "side", not by shrinking.
   */
  it('sets the side at heading size, not tag size', () => {
    render(<ExerciseCard step={step({ side: 'right' })} exercise={ex('a')} />);
    const pill = screen.getByText(/right/i);
    expect(pill.className).toMatch(/\btext-(3xl|4xl|5xl|6xl)\b/);
  });

  /**
   * The side, the bell and the count are ONE row. That row is what bought the
   * picture its space back, so a future tidy-up that stacks them again should
   * fail here rather than quietly reintroduce the scroll.
   */
  it('keeps the side on the same row as the bell and the count', () => {
    render(<ExerciseCard step={step({ side: 'left' })} exercise={ex('a')} />);
    const row = screen.getByText(/left/i).parentElement;
    expect(row?.textContent).toContain('24 kg');
    expect(row?.textContent).toContain('15 reps');
  });

  /**
   * The card does not scroll. It is a bounded flex column and the picture is
   * the one element allowed to give, which is what makes that true on any
   * phone rather than at one guessed viewport height.
   */
  it('lets the picture take the leftover room rather than a fixed height', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    const img = screen.getByRole('img');
    expect(img.className).toContain('flex-1');
    expect(img.className).toMatch(/min-h-/);
    expect(img.className).not.toMatch(/\[\d+vh\]/);
  });

  it('shows seconds for a carry', () => {
    render(<ExerciseCard step={step({ reps: undefined, seconds: 40 })} exercise={ex('a')} />);
    screen.getByText('40 seconds');
  });

  it('says bodyweight when there is no bell', () => {
    render(<ExerciseCard step={step({ bellKg: null })} exercise={ex('a', { bells: 0 })} />);
    screen.getByText(/bodyweight/i);
  });

  it('renders the image when there is one', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('a.webp'));
  });

  it('collapses the media slot and promotes the cues when there is no image', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: null })} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/no image/i)).toBeNull();   // no dashed placeholder
    screen.getByText('execute');                           // the cue is visible, not hidden
  });

  /**
   * The warning used to stand open at the foot of every card, which is a third
   * of a phone spent on a line he has read forty times - and it was one of the
   * two things pushing the picture into a scroll. It is still here and still
   * one tap away; it is no longer in the way.
   */
  it('keeps the mistakes behind one tap rather than standing open', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    const summary = screen.getByText(/watch out for/i);
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details')?.open).toBe(false);
    screen.getByText('mistake');
  });

  it('folds the how-to away too, so the picture keeps the space', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    const summary = screen.getByText(/how to do it/i);
    expect(summary.closest('details')?.open).toBe(false);
  });

  /**
   * A workout stored before the exercise list changed under it still names a
   * move this build does not have. The card he is standing in front of must
   * degrade to the name and the count rather than going blank.
   */
  it('still shows the name and the numbers when the exercise is unknown', () => {
    render(<ExerciseCard step={step()} exercise={null} />);
    screen.getByRole('heading', { name: 'Two-Hand Swing' });
    screen.getByText('24 kg');
    screen.getByText('15 reps');
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('RestCard', () => {
  it('shows the countdown and what comes next', () => {
    render(<RestCard remainingSeconds={42} nextName="Goblet Squat" onSkip={() => {}} onAddTime={() => {}} />);
    screen.getByRole('heading', { name: 'Rest' });
    screen.getByText('0:42');
    screen.getByText('Next: Goblet Squat');
  });

  it('counts up past zero rather than vanishing', () => {
    render(<RestCard remainingSeconds={-24} nextName="Goblet Squat" onSkip={() => {}} onAddTime={() => {}} />);
    screen.getByText(/over by 0:24/i);
  });

  it('offers more rest as well as less', () => {
    render(<RestCard remainingSeconds={42} nextName="X" onSkip={() => {}} onAddTime={() => {}} />);
    screen.getByRole('button', { name: 'Skip rest' });
    screen.getByRole('button', { name: '+30s' });
  });

  it('carries minutes as well as seconds', () => {
    render(<RestCard remainingSeconds={95} nextName="X" onSkip={() => {}} onAddTime={() => {}} />);
    screen.getByText('1:35');
  });
});
