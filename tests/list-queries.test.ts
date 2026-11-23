import { beforeEach, describe, expect, it, vi } from 'vitest';

const { todoMock, todoListMock } = vi.hoisted(() => ({
  todoMock: { findMany: vi.fn() },
  todoListMock: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock('@/generated/prisma', () => ({
  PrismaClient: vi.fn(() => ({ todo: todoMock, todoList: todoListMock })),
}));

import { getUserListById, getUserLists, getUserTodoList } from '@/prisma/queries/todo.query';

const listId = '0123456789abcdef01234567';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('List-scoped Todo queries', () => {
  it('includes both explicit null and missing listId documents in the Inbox', async () => {
    todoMock.findMany.mockResolvedValue([]);

    await getUserTodoList('owner_A', { kind: 'inbox' });

    expect(todoMock.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'owner_A',
        OR: [{ listId: null }, { listId: { isSet: false } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('scopes List todos and List reads to the authenticated owner', async () => {
    todoMock.findMany.mockResolvedValue([]);
    todoListMock.findFirst.mockResolvedValue(null);

    await getUserTodoList('owner_A', { kind: 'list', listId });
    await getUserListById('owner_A', listId);

    expect(todoMock.findMany).toHaveBeenCalledWith({
      where: { user_id: 'owner_A', listId },
      orderBy: { createdAt: 'desc' },
    });
    expect(todoListMock.findFirst).toHaveBeenCalledWith({
      where: { id: listId, user_id: 'owner_A' },
      select: { id: true, name: true, isArchived: true },
    });
  });

  it('returns only minimal owner-scoped List DTOs and todo counts', async () => {
    todoListMock.findMany.mockResolvedValue([
      {
        id: listId,
        name: 'Work',
        isArchived: false,
        _count: { todos: 3 },
      },
    ]);

    await expect(getUserLists('owner_A')).resolves.toEqual([
      { id: listId, name: 'Work', isArchived: false, todoCount: 3 },
    ]);
    expect(todoListMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'owner_A' } })
    );
  });
});
