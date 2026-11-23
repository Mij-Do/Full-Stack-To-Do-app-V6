import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaInstance, prismaClientConstructorMock } = vi.hoisted(() => {
  const prismaInstance = {};
  return {
    prismaInstance,
    prismaClientConstructorMock: vi.fn(() => prismaInstance),
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/generated/prisma', () => ({ PrismaClient: prismaClientConstructorMock }));

const clearGlobalPrisma = () => {
  Reflect.deleteProperty(globalThis, 'prisma');
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  clearGlobalPrisma();
});

afterEach(() => {
  clearGlobalPrisma();
  vi.resetModules();
});

describe('shared Prisma client', () => {
  it('reuses the same client across development module reloads without connecting', async () => {
    const firstImport = await import('@/lib/prisma');
    vi.resetModules();
    const reloadedImport = await import('@/lib/prisma');

    expect(prismaClientConstructorMock).toHaveBeenCalledTimes(1);
    expect(firstImport.prisma).toBe(prismaInstance);
    expect(reloadedImport.prisma).toBe(firstImport.prisma);
  });
});
