import type { Metadata } from 'next';
import { WorkoutRunner } from '@/components/WorkoutRunner';

export const metadata: Metadata = {
  title: 'Workout',
  description: 'One move at a time, read from a metre away.',
};

/**
 * The screen the phone is propped on the floor for. Everything on it is the
 * runner, which is a client component because it owns the clock, the audio and
 * the wake lock; this page stays a Server Component so nothing else ships.
 */
export default function WorkoutRunPage() {
  return <WorkoutRunner />;
}
