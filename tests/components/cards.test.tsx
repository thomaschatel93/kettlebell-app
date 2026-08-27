import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { RestCard } from '@/components/RestCard';
import { AncillaryChecklist } from '@/components/AncillaryChecklist';
import { ex } from '../fixtures';
import type { Exercise, Step, WorkStep } from '@/lib/types';

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
   */
  it('sets the side at heading size, not tag size', () => {
    render(<ExerciseCard step={step({ side: 'right' })} exercise={ex('a')} />);
    const pill = screen.getByText(/right/i);
    expect(pill.className).toMatch(/\btext-(3xl|4xl|5xl|6xl)\b/);
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

  it('always shows the mistakes line, image or not', () => {
    render(<ExerciseCard step={step()} exercise={ex('a', { image: '/exercises/a.webp' })} />);
    screen.getByText('mistake');
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

const warm = (name: string, over: Partial<WorkStep> = {}): Step => ({
  kind: 'work', exerciseId: name, name, bellKg: null, seconds: 30,
  block: 'Warm-up', round: 1, totalRounds: 1, indexInRound: 1, itemsInRound: 2, estSeconds: 30,
  ...over,
} as WorkStep);

const lookup = (list: Exercise[]): ReadonlyMap<string, Exercise> =>
  new Map(list.map((e) => [e.id, e]));

describe('AncillaryChecklist', () => {
  /**
   * One card for the whole block, not one screen per move. The warm-up runs
   * first in every session, so a card per move meant every session opening with
   * a run of near-empty placeholders.
   */
  it('lists the whole block on one card, with its duration and a cue', () => {
    render(
      <AncillaryChecklist
        steps={[warm('halo'), warm('bridge')]}
        exercises={lookup([ex('halo'), ex('bridge')])}
        onDone={() => {}}
      />,
    );
    screen.getByRole('heading', { name: 'Warm-up' });
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getAllByText('30 seconds')).toHaveLength(2);
    expect(screen.getAllByText('execute')).toHaveLength(2);
  });

  it('ticks a move off without leaving the card', () => {
    render(
      <AncillaryChecklist steps={[warm('halo')]} exercises={lookup([ex('halo')])} onDone={() => {}} />,
    );
    const box = screen.getByRole('checkbox');
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
    screen.getByText('1 of 1');
  });

  it('hands the block back when he says he is done', () => {
    let done = 0;
    render(
      <AncillaryChecklist steps={[warm('halo')]} exercises={lookup([ex('halo')])} onDone={() => { done += 1; }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(done).toBe(1);
  });

  it('names a move it has no cues for rather than dropping it', () => {
    render(<AncillaryChecklist steps={[warm('halo')]} exercises={lookup([])} onDone={() => {}} />);
    screen.getByText('halo');
  });
});
