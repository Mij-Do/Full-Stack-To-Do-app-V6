import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revalidateMock, todoMock, subtaskMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(), revalidateMock: vi.fn(),
  todoMock: { findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  subtaskMock: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidateMock }));
vi.mock('@/lib/prisma', () => ({ prisma: { ...prismaMock, todo: todoMock, todoSubtask: subtaskMock } }));

import { createSubtaskAction, deleteSubtaskAction, deleteTodoAction, toggleSubtaskAction, toggleTodoAction, updateSubtaskAction, updateTodoAction } from '@/prisma/actions/todo.action';

const parentId = '0123456789abcdef01234567';
const childId = '1123456789abcdef01234567';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'owner-A' });
  prismaMock.$transaction.mockImplementation((callback: (tx: object) => unknown) => callback({ todo: todoMock, todoSubtask: subtaskMock }));
  todoMock.findFirst.mockResolvedValue({ id: parentId, completed: false });
  todoMock.updateMany.mockResolvedValue({ count: 1 });
  subtaskMock.create.mockResolvedValue({ id: childId, todoId: parentId, title: 'step', completed: false, createdAt: new Date() });
  subtaskMock.updateMany.mockResolvedValue({ count: 1 });
  subtaskMock.deleteMany.mockResolvedValue({ count: 1 });
  subtaskMock.findMany.mockResolvedValue([{ completed: true }]);
});

describe('subtask actions', () => {
  it('rejects unauthenticated access before database writes', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(createSubtaskAction({ todoId: parentId, title: 'step' })).rejects.toThrow('Unauthorized');
    expect(subtaskMock.create).not.toHaveBeenCalled();
  });

  it('scopes creation to the authenticated owner and reopens a completed parent', async () => {
    todoMock.findFirst.mockResolvedValue({ id: parentId, completed: true });
    await createSubtaskAction({ todoId: parentId, title: ' step ', user_id: 'owner-B' });
    expect(todoMock.findFirst).toHaveBeenCalledWith({ where: { id: parentId, user_id: 'owner-A' }, select: { id: true, completed: true } });
    expect(subtaskMock.create).toHaveBeenCalledWith({ data: { todoId: parentId, user_id: 'owner-A', title: 'step', completed: false } });
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { completed: false } });
  });

  it('rejects a foreign-owned parent', async () => {
    todoMock.findFirst.mockResolvedValue(null);
    await expect(createSubtaskAction({ todoId: parentId, title: 'step' })).rejects.toThrow('Todo not found');
    expect(subtaskMock.create).not.toHaveBeenCalled();
  });

  it('rejects child mutations when the parent is missing or foreign-owned', async () => {
    todoMock.findFirst.mockResolvedValue(null);
    await expect(updateSubtaskAction({ todoId: parentId, id: childId, title: 'edit' })).rejects.toThrow('Todo not found');
    await expect(toggleSubtaskAction({ todoId: parentId, id: childId, completed: true })).rejects.toThrow('Todo not found');
    await expect(deleteSubtaskAction({ todoId: parentId, id: childId })).rejects.toThrow('Todo not found');
    expect(subtaskMock.updateMany).not.toHaveBeenCalled();
    expect(subtaskMock.deleteMany).not.toHaveBeenCalled();
  });

  it('scopes edit and delete by subtask, parent, and owner', async () => {
    await updateSubtaskAction({ todoId: parentId, id: childId, title: ' edited ' });
    await deleteSubtaskAction({ todoId: parentId, id: childId });
    expect(subtaskMock.updateMany).toHaveBeenCalledWith({ where: { id: childId, todoId: parentId, user_id: 'owner-A' }, data: { title: 'edited' } });
    expect(subtaskMock.deleteMany).toHaveBeenCalledWith({ where: { id: childId, todoId: parentId, user_id: 'owner-A' } });
  });

  it('preserves parent state when deleting its last subtask', async () => {
    subtaskMock.findMany.mockResolvedValue([]);
    todoMock.findFirst.mockResolvedValue({ id: parentId, completed: true });
    await deleteSubtaskAction({ todoId: parentId, id: childId });
    expect(todoMock.updateMany).toHaveBeenLastCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { completed: true } });
  });

  it('preserves an incomplete parent when deleting its final child', async () => {
    subtaskMock.findMany.mockResolvedValue([]);
    todoMock.findFirst.mockResolvedValue({ id: parentId, completed: false });
    await deleteSubtaskAction({ todoId: parentId, id: childId });
    expect(todoMock.updateMany).toHaveBeenLastCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { completed: false } });
  });

  it('completes the parent when the final subtask completes and reopens it when one is reopened', async () => {
    await toggleSubtaskAction({ todoId: parentId, id: childId, completed: true });
    expect(subtaskMock.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: childId, todoId: parentId, user_id: 'owner-A' },
      data: { completed: true },
    });
    expect(todoMock.updateMany).toHaveBeenLastCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { completed: true } });
    subtaskMock.findMany.mockResolvedValue([{ completed: false }, { completed: true }]);
    await toggleSubtaskAction({ todoId: parentId, id: childId, completed: false });
    expect(subtaskMock.updateMany).toHaveBeenLastCalledWith({
      where: { id: childId, todoId: parentId, user_id: 'owner-A' },
      data: { completed: false },
    });
    expect(todoMock.updateMany).toHaveBeenLastCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { completed: false } });
  });

  it('synchronizes all children when the parent is toggled', async () => {
    await toggleTodoAction({ id: parentId, completed: true });
    expect(subtaskMock.updateMany).toHaveBeenCalledWith({ where: { todoId: parentId, user_id: 'owner-A' }, data: { completed: true } });
  });

  it('does not overwrite mixed child progress during title or description edits', async () => {
    subtaskMock.findMany.mockResolvedValue([{ completed: true }, { completed: false }]);
    await updateTodoAction({ id: parentId, title: 'New title', completed: false });
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { title: 'New title', body: undefined } });
    expect(subtaskMock.updateMany).not.toHaveBeenCalled();
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'owner-A' });
    prismaMock.$transaction.mockImplementation((callback: (tx: object) => unknown) => callback({ todo: todoMock, todoSubtask: subtaskMock }));
    todoMock.updateMany.mockResolvedValue({ count: 1 });
    await updateTodoAction({ id: parentId, title: 'Same title', body: 'Updated description text.', completed: false });
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { title: 'Same title', body: 'Updated description text.' } });
    expect(subtaskMock.updateMany).not.toHaveBeenCalled();
  });

  it('synchronizes children only when parent completion actually changes', async () => {
    await updateTodoAction({ id: parentId, title: 'Parent', completed: true, completionIntent: 'set' });
    expect(todoMock.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: parentId, user_id: 'owner-A', completed: false },
      data: { completed: true },
    });
    expect(subtaskMock.updateMany).toHaveBeenCalledWith({ where: { todoId: parentId, user_id: 'owner-A' }, data: { completed: true } });
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'owner-A' });
    prismaMock.$transaction.mockImplementation((callback: (tx: object) => unknown) => callback({ todo: todoMock, todoSubtask: subtaskMock }));
    todoMock.updateMany.mockResolvedValue({ count: 1 });
    await updateTodoAction({ id: parentId, title: 'Parent', completed: false, completionIntent: 'set' });
    expect(subtaskMock.updateMany).toHaveBeenCalledWith({ where: { todoId: parentId, user_id: 'owner-A' }, data: { completed: false } });
    expect(todoMock.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: parentId, user_id: 'owner-A', completed: true },
      data: { completed: false },
    });
  });

  it('preserves newer parent and child completion state when an older edit submits stale completion data', async () => {
    await updateTodoAction({ id: parentId, title: 'Edited from stale form', completed: false, completionIntent: 'preserve' });
    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: parentId, user_id: 'owner-A' },
      data: { title: 'Edited from stale form', body: undefined },
    });
    expect(subtaskMock.updateMany).not.toHaveBeenCalled();
  });

  it('recalculates the parent after deletion when children remain', async () => {
    subtaskMock.findMany.mockResolvedValue([{ completed: true }]);
    await deleteSubtaskAction({ todoId: parentId, id: childId });
    expect(todoMock.updateMany).toHaveBeenLastCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { completed: true } });
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'owner-A' });
    prismaMock.$transaction.mockImplementation((callback: (tx: object) => unknown) => callback({ todo: todoMock, todoSubtask: subtaskMock }));
    todoMock.findFirst.mockResolvedValue({ id: parentId, completed: true });
    todoMock.updateMany.mockResolvedValue({ count: 1 });
    subtaskMock.deleteMany.mockResolvedValue({ count: 1 });
    subtaskMock.findMany.mockResolvedValue([{ completed: false }]);
    await deleteSubtaskAction({ todoId: parentId, id: childId });
    expect(todoMock.updateMany).toHaveBeenLastCalledWith({ where: { id: parentId, user_id: 'owner-A' }, data: { completed: false } });
  });

  it('rejects unauthenticated child edits, toggles, and deletes and malformed toggle/delete IDs', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(updateSubtaskAction({ todoId: parentId, id: childId, title: 'edit' })).rejects.toThrow('Unauthorized');
    await expect(toggleSubtaskAction({ todoId: parentId, id: childId, completed: true })).rejects.toThrow('Unauthorized');
    await expect(deleteSubtaskAction({ todoId: parentId, id: childId })).rejects.toThrow('Unauthorized');
    authMock.mockResolvedValue({ userId: 'owner-A' });
    await expect(toggleSubtaskAction({ todoId: parentId, id: 'bad', completed: true })).rejects.toThrow();
    await expect(deleteSubtaskAction({ todoId: parentId, id: 'bad' })).rejects.toThrow();
  });

  it('rejects mismatched child IDs for toggle and delete without changing parent state', async () => {
    subtaskMock.updateMany.mockResolvedValue({ count: 0 });
    subtaskMock.deleteMany.mockResolvedValue({ count: 0 });
    await expect(updateSubtaskAction({ todoId: parentId, id: childId, title: 'edit' })).rejects.toThrow('Subtask not found');
    await expect(toggleSubtaskAction({ todoId: parentId, id: childId, completed: true })).rejects.toThrow('Subtask not found');
    await expect(deleteSubtaskAction({ todoId: parentId, id: childId })).rejects.toThrow('Subtask not found');
    expect(todoMock.updateMany).toHaveBeenCalledTimes(2); // failed transactions roll their guards back
  });

  it('deletes children and parent within one transaction callback', async () => {
    todoMock.deleteMany.mockResolvedValue({ count: 1 });
    const calls: string[] = [];
    subtaskMock.deleteMany.mockImplementation(async () => { calls.push('children'); return { count: 2 }; });
    todoMock.deleteMany.mockImplementation(async () => { calls.push('parent'); return { count: 1 }; });
    await deleteTodoAction({ id: parentId });
    expect(calls).toEqual(['children', 'parent']);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('uses the same owned parent write guard for each invariant-changing action', async () => {
    const expectedGuard = {
      where: { id: parentId, user_id: 'owner-A', completed: false },
      data: { completed: true },
    };
    await createSubtaskAction({ todoId: parentId, title: 'step' });
    expect(todoMock.updateMany).toHaveBeenNthCalledWith(1, expectedGuard);
    vi.clearAllMocks();
    await toggleSubtaskAction({ todoId: parentId, id: childId, completed: true });
    expect(todoMock.updateMany).toHaveBeenNthCalledWith(1, expectedGuard);
    vi.clearAllMocks();
    await toggleTodoAction({ id: parentId, completed: true });
    expect(todoMock.updateMany).toHaveBeenNthCalledWith(1, expectedGuard);
    vi.clearAllMocks();
    await deleteSubtaskAction({ todoId: parentId, id: childId });
    expect(todoMock.updateMany).toHaveBeenNthCalledWith(1, expectedGuard);
    vi.clearAllMocks();
    todoMock.deleteMany.mockResolvedValue({ count: 1 });
    await deleteTodoAction({ id: parentId });
    expect(todoMock.updateMany).toHaveBeenNthCalledWith(1, expectedGuard);
  });
});
