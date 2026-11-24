import { beforeEach, describe, expect, it, vi } from 'vitest';

const { todoMock, todoSubtaskMock, todoRecurrenceMock } = vi.hoisted(() => ({
  todoMock: { findMany: vi.fn() },
  todoSubtaskMock: { findMany: vi.fn() },
  todoRecurrenceMock: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: { todo: todoMock, todoSubtask: todoSubtaskMock, todoRecurrence: todoRecurrenceMock } }));

import { getUserTodos } from '@/prisma/queries/todo.query';

const parentId = '0123456789abcdef01234567';

beforeEach(() => {
  vi.clearAllMocks();
  todoRecurrenceMock.findMany.mockResolvedValue([]);
});

describe('unified Todo query', () => {
  it('loads all Todos for the authenticated owner and batches their subtasks', async () => {
    todoMock.findMany.mockResolvedValue([{ id: parentId, title: 'Parent', completed: false, todoType: 'standalone' }]);
    todoSubtaskMock.findMany.mockResolvedValue([
      { id: '1123456789abcdef01234567', todoId: parentId, title: 'Child', completed: false },
    ]);

    await expect(getUserTodos('owner_A')).resolves.toMatchObject([
      { id: parentId, todoType: 'withSubtasks', subtasks: [{ title: 'Child' }] },
    ]);
    expect(todoMock.findMany).toHaveBeenCalledWith({
      where: { user_id: 'owner_A' },
      orderBy: { createdAt: 'desc' },
    });
    expect(todoSubtaskMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { todoId: { in: [parentId] }, user_id: 'owner_A' },
    }));
    expect(todoRecurrenceMock.findMany).toHaveBeenCalledWith({ where: { id: { in: [] }, user_id: 'owner_A' } });
  });

  it('does not query for Todos or children without an authenticated user', async () => {
    await expect(getUserTodos(null)).resolves.toEqual([]);
    expect(todoMock.findMany).not.toHaveBeenCalled();
    expect(todoSubtaskMock.findMany).not.toHaveBeenCalled();
    expect(todoRecurrenceMock.findMany).not.toHaveBeenCalled();
  });

  it('returns owner-scoped recurrence status for each occurrence', async () => {
    const seriesId = '2123456789abcdef01234567';
    todoMock.findMany.mockResolvedValue([{ id: parentId, recurrenceSeriesId: seriesId, title: 'Recurring', completed: false }]);
    todoSubtaskMock.findMany.mockResolvedValue([]);
    todoRecurrenceMock.findMany.mockResolvedValue([{ id: seriesId, frequency: 'weekly', interval: 2, active: true, currentTodoId: parentId, user_id: 'owner_A' }]);
    await expect(getUserTodos('owner_A')).resolves.toMatchObject([
      { id: parentId, recurrence: { id: seriesId, frequency: 'weekly', interval: 2, active: true, isCurrent: true } },
    ]);
    expect(todoRecurrenceMock.findMany).toHaveBeenCalledWith({ where: { id: { in: [seriesId] }, user_id: 'owner_A' } });
  });
});
