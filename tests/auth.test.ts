import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));

import { requireUserId } from '@/lib/auth';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireUserId', () => {
  it('returns the authenticated Clerk user ID', async () => {
    authMock.mockResolvedValue({ userId: 'owner_A' });

    await expect(requireUserId()).resolves.toBe('owner_A');
  });

  it('preserves the Unauthorized error for unauthenticated callers', async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(requireUserId()).rejects.toThrow('Unauthorized');
  });
});
