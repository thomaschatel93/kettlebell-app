import type { Metadata } from 'next';
import { SetupForm } from '@/components/SetupForm';

export const metadata: Metadata = {
  title: 'New workout',
  description: 'Pick what you are training and how long you have.',
};

/**
 * Two questions and a button. The form itself is the client component, because
 * it reads the kit and writes the workout; this page stays a Server Component
 * so only the interactive part ships to the browser.
 */
export default function WorkoutSetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">New workout</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          What you are training today, and how long you have for it.
        </p>
      </header>

      <SetupForm />
    </main>
  );
}
