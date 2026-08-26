import type { Metadata } from 'next';
import { DoneScreen } from '@/components/DoneScreen';

export const metadata: Metadata = {
  title: 'Done',
  description: 'What you just did, against what it was meant to take.',
};

/**
 * Where the runner pushes the moment a session ends. The screen is the client
 * component, because it reads the session back and writes the rating onto it.
 */
export default function WorkoutDonePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <DoneScreen />
    </main>
  );
}
