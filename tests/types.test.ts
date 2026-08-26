import { describe, it, expect } from 'vitest';
import { capabilityRank, CAPABILITIES } from '@/lib/types';

describe('capabilityRank', () => {
  it('orders the three capabilities', () => {
    expect(CAPABILITIES.map(capabilityRank)).toEqual([0, 1, 2]);
  });
});
