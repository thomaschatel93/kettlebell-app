import type { Metadata } from 'next';
import { WorkoutPreview } from '@/components/WorkoutPreview';

export const metadata: Metadata = {
  title: 'Preview',
  description: 'The bells to fetch, the time it will take, and every block before you start.',
};

/**
 * The last screen before the phone goes on the floor. It exists so he can see
 * what he is about to do, and so he never has to walk back indoors for a bell.
 */
export default function WorkoutPreviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Your workout</h1>
      </header>

      <WorkoutPreview />
    </main>
  );
}
