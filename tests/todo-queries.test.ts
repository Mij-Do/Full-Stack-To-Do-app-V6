import { beforeEach, describe, expect, it, vi } from 'vitest';

const { todoMock, todoSubtaskMock } = vi.hoisted(() => ({
  todoMock: { findMany: vi.fn() },
  todoSubtaskMock: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: { todo: todoMock, todoSubtask: todoSubtaskMock } }));

import { getUserTodoList } from '@/prisma/queries/todo.query';

const parentId = '0123456789abcdef01234567';

beforeEach(() => vi.clearAllMocks());

describe('unified Todo query', () => {
  it('loads all Todos for the authenticated owner and batches their subtasks', async () => {
    todoMock.findMany.mockResolvedValue([{ id: parentId, title: 'Parent', completed: false, todoType: 'standalone' }]);
    todoSubtaskMock.findMany.mockResolvedValue([
      { id: '1123456789abcdef01234567', todoId: parentId, title: 'Child', completed: false },
    ]);

    await expect(getUserTodoList('owner_A')).resolves.toMatchObject([
      { id: parentId, todoType: 'withSubtasks', subtasks: [{ title: 'Child' }] },
    ]);
    expect(todoMock.findMany).toHaveBeenCalledWith({
      where: { user_id: 'owner_A' },
      orderBy: { createdAt: 'desc' },
    });
    expect(todoSubtaskMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { todoId: { in: [parentId] }, user_id: 'owner_A' },
    }));
  });

  it('does not query for Todos or children without an authenticated user', async () => {
    await expect(getUserTodoList(null)).resolves.toEqual([]);
    expect(todoMock.findMany).not.toHaveBeenCalled();
    expect(todoSubtaskMock.findMany).not.toHaveBeenCalled();
  });
});
