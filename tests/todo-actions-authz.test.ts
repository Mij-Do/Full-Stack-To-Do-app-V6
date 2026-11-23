import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revalidatePathMock, todoMock, todoSubtaskMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  todoMock: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  todoSubtaskMock: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/lib/prisma', () => ({ prisma: { ...prismaMock, todo: todoMock, todoSubtask: todoSubtaskMock } }));

import { createTodoAction, deleteTodoAction, toggleTodoAction, updateTodoAction } from '@/prisma/actions/todo.action';
import { getUserTodoList } from '@/prisma/queries/todo.query';

const todoId = '0123456789abcdef01234567';
const childId = '1123456789abcdef01234567';
const tx = { todo: todoMock, todoSubtask: todoSubtaskMock };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'owner_A' });
  prismaMock.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
  todoMock.findFirst.mockResolvedValue({ id: todoId, completed: false });
  todoMock.updateMany.mockResolvedValue({ count: 1 });
  todoMock.create.mockResolvedValue({ id: todoId });
  todoMock.deleteMany.mockResolvedValue({ count: 1 });
  todoSubtaskMock.create.mockResolvedValue({ id: childId });
});

describe('Todo creation', () => {
  it('requires authentication and ignores client-supplied ownership', async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    await expect(createTodoAction({ title: 'Valid title', completed: false })).rejects.toThrow('Unauthorized');
    expect(todoMock.create).not.toHaveBeenCalled();

    await createTodoAction({ title: 'Valid title', completed: false, user_id: 'owner_B' });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ user_id: 'owner_A', todoType: 'standalone' }) });
  });

  it('preserves completed standalone Todo creation', async () => {
    await createTodoAction({ title: 'Completed title', completed: true, todoType: 'standalone' });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ completed: true, todoType: 'standalone' }) });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('preserves incomplete standalone Todo creation', async () => {
    await createTodoAction({ title: 'Active title', completed: false });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ completed: false, todoType: 'standalone' }) });
  });

  it('atomically creates a checklist Todo and its initial pending subtasks', async () => {
    await createTodoAction({ title: 'Parent title', completed: true, todoType: 'withSubtasks', initialSubtasks: ['Review draft', 'Send notes'] });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ completed: false, todoType: 'withSubtasks', user_id: 'owner_A' }) });
    expect(todoSubtaskMock.create).toHaveBeenNthCalledWith(1, { data: { todoId, user_id: 'owner_A', title: 'Review draft', completed: false } });
    expect(todoSubtaskMock.create).toHaveBeenNthCalledWith(2, { data: { todoId, user_id: 'owner_A', title: 'Send notes', completed: false } });
  });
});

describe('Todo updates and completion', () => {
  it('keeps a stale ordinary edit from overwriting completion or child progress', async () => {
    todoMock.findFirst.mockResolvedValueOnce({ completed: true });
    await updateTodoAction({ id: todoId, title: 'Edited title', completed: false, completionIntent: 'preserve' });
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: todoId, user_id: 'owner_A' }, data: { title: 'Edited title', body: undefined } });
    expect(todoSubtaskMock.updateMany).not.toHaveBeenCalled();
  });

  it('scopes explicit completion transitions and synchronizes owned children', async () => {
    await updateTodoAction({ id: todoId, title: 'Parent title', completed: true, completionIntent: 'set' });
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: todoId, user_id: 'owner_A', completed: false }, data: { completed: true } });
    expect(todoSubtaskMock.updateMany).toHaveBeenCalledWith({ where: { todoId, user_id: 'owner_A' }, data: { completed: true } });
  });

  it('toggles only an owned parent and its owned children', async () => {
    await toggleTodoAction({ id: todoId, completed: true });
    expect(todoSubtaskMock.updateMany).toHaveBeenCalledWith({ where: { todoId, user_id: 'owner_A' }, data: { completed: true } });
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: todoId, user_id: 'owner_A', completed: false }, data: { completed: true } });
  });
});

describe('Todo deletion', () => {
  it('validates input, requires Clerk identity, and preserves not-found domain errors', async () => {
    await expect(deleteTodoAction({ id: 'bad' })).rejects.toThrow();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    authMock.mockResolvedValueOnce({ userId: null });
    await expect(deleteTodoAction({ id: todoId })).rejects.toThrow('Unauthorized');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    todoMock.findFirst.mockResolvedValueOnce(null);
    await expect(deleteTodoAction({ id: todoId })).rejects.toThrow('Todo not found');
    expect(todoSubtaskMock.deleteMany).not.toHaveBeenCalled();
    expect(todoMock.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes child rows and the parent inside the same guarded transaction', async () => {
    await deleteTodoAction({ id: todoId });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: todoId, user_id: 'owner_A', completed: false }, data: { completed: true } });
    expect(todoSubtaskMock.deleteMany).toHaveBeenCalledWith({ where: { todoId, user_id: 'owner_A' } });
    expect(todoMock.deleteMany).toHaveBeenCalledWith({ where: { id: todoId, user_id: 'owner_A' } });
  });

  it('logs allowlisted Prisma diagnostics while keeping unexpected failures generic', async () => {
    class PrismaClientKnownRequestError extends Error {
      code = 'P2031';
      constructor() { super('mongodb://secret-user:secret-pass@private-host/private-db'); this.name = 'PrismaClientKnownRequestError'; }
    }
    prismaMock.$transaction.mockRejectedValueOnce(new PrismaClientKnownRequestError());
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(deleteTodoAction({ id: todoId })).rejects.toThrow('Could not delete this Todo. Please try again.');
    expect(diagnostic).toHaveBeenCalledWith('[server-action] Transaction failed', {
      operation: 'deleteTodoAction', errorClass: 'PrismaClientKnownRequestError', errorName: 'PrismaClientKnownRequestError', errorCode: 'P2031',
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('secret-pass');

    diagnostic.mockImplementation(() => { throw new Error('logger failure'); });
    prismaMock.$transaction.mockRejectedValueOnce(Object.assign(new Error('private task title'), { name: 'PrivateTaskTitle', code: 'private-data' }));
    await expect(deleteTodoAction({ id: todoId })).rejects.toThrow('Could not delete this Todo. Please try again.');
    expect(JSON.stringify(diagnostic.mock.calls[1])).not.toContain('PrivateTaskTitle');
    diagnostic.mockRestore();
  });
});

describe('Todo reads', () => {
  it('returns no records without an owner and scopes reads to authenticated owner IDs', async () => {
    await expect(getUserTodoList(null)).resolves.toEqual([]);
    todoMock.findMany.mockResolvedValue([]);
    await getUserTodoList('owner_A');
    expect(todoMock.findMany).toHaveBeenCalledWith({ where: { user_id: 'owner_A' }, orderBy: { createdAt: 'desc' } });
  });
});
