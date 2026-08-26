import { describe, it, expect } from 'vitest';
import { PATTERNS, CAPABILITIES, EFFORTS } from '@/lib/types';

describe('project wiring', () => {
  it('exports the six movement patterns', () => {
    expect(PATTERNS).toEqual(['hinge', 'squat', 'push', 'pull', 'carry', 'core']);
  });

  it('keeps capability and effort as separate vocabularies', () => {
    expect(CAPABILITIES).toEqual(['beginner', 'intermediate', 'advanced']);
    expect(EFFORTS).toEqual(['easy', 'normal', 'hard']);
  });
});
