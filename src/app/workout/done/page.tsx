import type { Metadata } from 'next';
import { WorkoutDone } from '@/components/WorkoutDone';

export const metadata: Metadata = {
  title: 'Done',
  description: 'What you just did.',
};

/**
 * A stub, deliberately. It exists now rather than in Task 21 because the runner
 * pushes here the moment a session ends, and a route that 404s between two
 * commits would mean a finished workout landing on an error page.
 */
export default function WorkoutDonePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <WorkoutDone />
    </main>
  );
}
