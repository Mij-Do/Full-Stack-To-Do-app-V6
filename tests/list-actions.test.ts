import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revalidatePathMock, todoListMock, todoMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  todoListMock: {
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  todoMock: { count: vi.fn() },
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/generated/prisma', () => ({
  PrismaClient: vi.fn(() => ({
    ...prismaMock,
    todoList: todoListMock,
    todo: todoMock,
  })),
}));

import {
  archiveListAction,
  createListAction,
  deleteEmptyListAction,
  renameListAction,
} from '@/prisma/actions/list.action';
import { LIST_NOT_EMPTY_MESSAGE } from '@/prisma/actions/action-errors';

const validId = '0123456789abcdef01234567';
const transaction = { todoList: todoListMock, todo: todoMock };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'owner_A' });
  prismaMock.$transaction.mockImplementation(async (
    callback: (tx: typeof transaction) => unknown
  ) => callback(transaction));
});

describe('List actions', () => {
  it('creates a List for the Clerk user after trimming its name', async () => {
    todoListMock.create.mockResolvedValue({
      id: validId,
      name: 'Work',
      isArchived: false,
    });

    await expect(createListAction({ name: '  Work  ', user_id: 'owner_B' })).resolves.toEqual({
      id: validId,
      name: 'Work',
      isArchived: false,
    });
    expect(todoListMock.create).toHaveBeenCalledWith({
      data: { name: 'Work', user_id: 'owner_A' },
      select: { id: true, name: true, isArchived: true },
    });
  });

  it('rejects unauthenticated callers before database access', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(createListAction({ name: 'Work' })).rejects.toThrow('Unauthorized');
    expect(todoListMock.create).not.toHaveBeenCalled();
  });

  it('renames and archives only a List owned by the authenticated user', async () => {
    todoListMock.updateMany.mockResolvedValue({ count: 1 });
    await renameListAction({ id: validId, name: '  Renamed  ' });
    expect(todoListMock.updateMany).toHaveBeenCalledWith({
      where: { id: validId, user_id: 'owner_A' },
      data: { name: 'Renamed' },
    });

    await archiveListAction({ id: validId });
    expect(todoListMock.updateMany).toHaveBeenLastCalledWith({
      where: { id: validId, user_id: 'owner_A' },
      data: { isArchived: true },
    });
  });

  it('does not rename or archive a foreign-owned List', async () => {
    todoListMock.updateMany.mockResolvedValue({ count: 0 });

    await expect(renameListAction({ id: validId, name: 'Renamed' })).rejects.toThrow('List not found');
    await expect(archiveListAction({ id: validId })).rejects.toThrow('List not found');
    expect(todoListMock.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: validId, user_id: 'owner_A' },
      data: { name: 'Renamed' },
    });
    expect(todoListMock.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: validId, user_id: 'owner_A' },
      data: { isArchived: true },
    });
  });

  it('rejects deletion if the List contains any Todo', async () => {
    todoListMock.updateMany.mockResolvedValue({ count: 1 });
    todoMock.count.mockResolvedValue(1);

    await expect(deleteEmptyListAction({ id: validId })).rejects.toThrow(LIST_NOT_EMPTY_MESSAGE);
    expect(todoMock.count).toHaveBeenCalledWith({ where: { listId: validId } });
    expect(todoListMock.deleteMany).not.toHaveBeenCalled();
  });

  it('permanently deletes only an owned empty List', async () => {
    todoListMock.updateMany.mockResolvedValue({ count: 1 });
    todoMock.count.mockResolvedValue(0);
    todoListMock.deleteMany.mockResolvedValue({ count: 1 });

    await deleteEmptyListAction({ id: validId });

    expect(todoListMock.updateMany).toHaveBeenCalledWith({
      where: { id: validId, user_id: 'owner_A' },
      data: { updatedAt: expect.any(Date) },
    });
    expect(todoListMock.deleteMany).toHaveBeenCalledWith({
      where: { id: validId, user_id: 'owner_A' },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });

  it('returns a distinct safe error when the deletion transaction fails', async () => {
    prismaMock.$transaction.mockRejectedValue(new Error('MongoServerError: private connection details'));

    const failure = await deleteEmptyListAction({ id: validId }).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      message: 'Could not delete this List right now. Please try again.',
    });
    expect(failure).toBeInstanceOf(Error);
    if (failure instanceof Error) {
      expect(failure.message).not.toContain('private connection details');
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
