import type { Metadata } from 'next';
import { HomeScreen } from '@/components/HomeScreen';

export const metadata: Metadata = {
  title: 'Kettlebell',
  description: 'What your week looks like, and one way into the next session.',
};

/**
 * The screen the app opens on. Everything on it is stored state, so the screen
 * itself is the client component; this page stays a Server Component.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <HomeScreen />
    </main>
  );
}
