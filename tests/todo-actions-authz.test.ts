import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

const { authMock, revalidatePathMock, todoMock, todoSubtaskMock, todoRecurrenceMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  todoMock: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  todoSubtaskMock: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  todoRecurrenceMock: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/lib/prisma', () => ({ prisma: { ...prismaMock, todo: todoMock, todoSubtask: todoSubtaskMock, todoRecurrence: todoRecurrenceMock } }));

import { createTodoAction, deleteTodoAction, stopTodoRecurrenceAction, toggleTodoAction, updateTodoAction } from '@/prisma/actions/todo.action';
import { getUserTodos } from '@/prisma/queries/todo.query';

const todoId = '0123456789abcdef01234567';
const childId = '1123456789abcdef01234567';
const tx = { todo: todoMock, todoSubtask: todoSubtaskMock, todoRecurrence: todoRecurrenceMock };
const recurrenceId = '2123456789abcdef01234567';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'owner_A' });
  prismaMock.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
  todoMock.findFirst.mockResolvedValue({ id: todoId, completed: false });
  todoMock.updateMany.mockResolvedValue({ count: 1 });
  todoMock.create.mockResolvedValue({ id: todoId });
  todoMock.deleteMany.mockResolvedValue({ count: 1 });
  todoSubtaskMock.create.mockResolvedValue({ id: childId });
  todoSubtaskMock.findMany.mockResolvedValue([]);
  todoRecurrenceMock.create.mockResolvedValue({ id: recurrenceId });
  todoRecurrenceMock.findFirst.mockResolvedValue(null);
  todoRecurrenceMock.findMany.mockResolvedValue([]);
  todoRecurrenceMock.updateMany.mockResolvedValue({ count: 1 });
});

describe('Todo creation', () => {
  it('requires authentication and ignores client-supplied ownership', async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    await expect(createTodoAction({ title: 'Valid title', completed: false })).rejects.toThrow('Unauthorized');
    expect(todoMock.create).not.toHaveBeenCalled();

    await createTodoAction({ title: 'Valid title', completed: false, user_id: 'owner_B' });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ user_id: 'owner_A', todoType: 'standalone' }) });
  });

  it('always creates a Todo incomplete even if a caller submits completed=true', async () => {
    await createTodoAction({ title: 'Completed title', completed: true, todoType: 'standalone' });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ completed: false, todoType: 'standalone' }) });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('preserves incomplete standalone Todo creation', async () => {
    await createTodoAction({ title: 'Active title', completed: false });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ completed: false, todoType: 'standalone' }) });
  });

  it('normalizes standalone Prisma failures but preserves unexpected programming errors', async () => {
    const databaseError = new Prisma.PrismaClientKnownRequestError('private database details', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    todoMock.create.mockRejectedValueOnce(databaseError);
    await expect(createTodoAction({ title: 'Database failure', completed: false }))
      .rejects.toThrow('Could not create this Todo. Please try again.');

    const programmingError = new TypeError('Unexpected application bug');
    todoMock.create.mockRejectedValueOnce(programmingError);
    await expect(createTodoAction({ title: 'Programming failure', completed: false }))
      .rejects.toBe(programmingError);
  });

  it('normalizes Prisma failures during transactional Todo creation, updates, and recurrence stopping', async () => {
    const prismaError = () => new Prisma.PrismaClientKnownRequestError('private database details', {
      code: 'P2034',
      clientVersion: '6.19.3',
    });

    todoMock.create.mockRejectedValueOnce(prismaError());
    await expect(createTodoAction({
      title: 'Checklist parent',
      completed: false,
      todoType: 'withSubtasks',
      initialSubtasks: ['Review draft'],
    })).rejects.toThrow('Could not create this Todo. Please try again.');

    todoMock.updateMany.mockRejectedValueOnce(prismaError());
    await expect(updateTodoAction({ id: todoId, title: 'Updated task', completed: false }))
      .rejects.toThrow('Could not save your changes. Please try again.');

    todoMock.findFirst.mockResolvedValueOnce({ recurrenceSeriesId: recurrenceId });
    todoRecurrenceMock.updateMany.mockRejectedValueOnce(prismaError());
    await expect(stopTodoRecurrenceAction({ id: todoId }))
      .rejects.toThrow('Could not stop this recurrence. Please try again.');
  });

  it('normalizes Prisma failures during recurrence configuration and generation', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('private database details', {
      code: 'P2034',
      clientVersion: '6.19.3',
    });
    todoMock.findFirst.mockResolvedValueOnce({
      id: todoId,
      title: 'Recurring task',
      body: null,
      user_id: 'owner_A',
      completed: false,
      dueDate: new Date('2026-01-01T00:00:00.000Z'),
      priority: 'medium',
      todoType: 'standalone',
      recurrenceSeriesId: recurrenceId,
    });
    todoRecurrenceMock.findFirst.mockRejectedValueOnce(prismaError);
    await expect(updateTodoAction({
      id: todoId,
      title: 'Recurring task',
      completed: false,
      dueDate: '2026-01-01',
      recurrenceFrequency: 'daily',
      recurrenceInterval: 1,
    })).rejects.toThrow('Could not save your changes. Please try again.');

    todoMock.findFirst.mockResolvedValueOnce({
      id: todoId,
      title: 'Recurring task',
      body: null,
      user_id: 'owner_A',
      completed: false,
      dueDate: new Date('2026-01-01T00:00:00.000Z'),
      priority: 'medium',
      todoType: 'standalone',
      recurrenceSeriesId: recurrenceId,
    });
    todoRecurrenceMock.findFirst.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('private database details', {
      code: 'P2034',
      clientVersion: '6.19.3',
    }));
    await expect(toggleTodoAction({ id: todoId, completed: true }))
      .rejects.toThrow('Could not update completion. Please try again.');
  });

  it('normalizes Prisma failures in the preflight top-level ownership check', async () => {
    const databaseError = new Prisma.PrismaClientKnownRequestError('private database details', {
      code: 'P2024',
      clientVersion: '6.19.3',
    });
    todoSubtaskMock.findFirst.mockRejectedValueOnce(databaseError);

    await expect(toggleTodoAction({ id: todoId, completed: true }))
      .rejects.toThrow('Could not update completion. Please try again.');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects creating a completed recurring Todo before any database write', async () => {
    await expect(createTodoAction({
      title: 'Completed recurring task',
      completed: true,
      dueDate: '2026-01-01',
      recurrenceFrequency: 'daily',
    })).rejects.toThrow('A recurring Todo must start incomplete.');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(todoMock.create).not.toHaveBeenCalled();
    expect(todoRecurrenceMock.create).not.toHaveBeenCalled();
  });

  it('rejects recurrence intervals above 365 on server actions before database access', async () => {
    await expect(createTodoAction({
      title: 'Too frequent',
      completed: false,
      dueDate: '2026-01-01',
      recurrenceFrequency: 'daily',
      recurrenceInterval: 366,
    })).rejects.toThrow();
    await expect(updateTodoAction({
      id: todoId,
      title: 'Too frequent',
      completed: false,
      dueDate: '2026-01-01',
      recurrenceFrequency: 'daily',
      recurrenceInterval: 366,
    })).rejects.toThrow();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(todoMock.create).not.toHaveBeenCalled();
  });

  it('atomically creates a checklist Todo and its initial pending subtasks', async () => {
    await createTodoAction({ title: 'Parent title', completed: true, todoType: 'withSubtasks', initialSubtasks: ['Review draft', 'Send notes'] });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ completed: false, todoType: 'withSubtasks', user_id: 'owner_A' }) });
    expect(todoSubtaskMock.create).toHaveBeenNthCalledWith(1, { data: { todoId, user_id: 'owner_A', title: 'Review draft', completed: false } });
    expect(todoSubtaskMock.create).toHaveBeenNthCalledWith(2, { data: { todoId, user_id: 'owner_A', title: 'Send notes', completed: false } });
  });

  it('creates a dated recurring occurrence and its series atomically', async () => {
    await createTodoAction({ title: 'Recurring task', completed: false, dueDate: '2026-05-31', recurrenceFrequency: 'monthly', recurrenceInterval: 2 });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(todoRecurrenceMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ user_id: 'owner_A', frequency: 'monthly', interval: 2, currentTodoId: null, anchorDay: 31 }) });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ recurrenceSeriesId: recurrenceId, dueDate: new Date('2026-05-31T00:00:00.000Z'), completed: false }) });
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

  it('generates the next occurrence when an explicit edit completes the current Todo', async () => {
    const occurrence = { id: todoId, title: 'Before edit', body: null, user_id: 'owner_A', completed: false, dueDate: new Date('2026-01-01T00:00:00.000Z'), priority: 'medium', todoType: 'standalone', recurrenceSeriesId: recurrenceId };
    todoMock.findFirst.mockResolvedValue(occurrence);
    todoRecurrenceMock.findFirst.mockResolvedValue({ id: recurrenceId, user_id: 'owner_A', active: true, currentTodoId: todoId, frequency: 'daily', interval: 1, anchorDay: null });
    todoMock.create.mockResolvedValue({ id: childId });
    await updateTodoAction({ id: todoId, title: 'Updated task', completed: true, completionIntent: 'set', dueDate: '2026-01-01', recurrenceFrequency: 'daily', recurrenceInterval: 1 });
    expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ title: 'Updated task', completed: false, recurrenceSeriesId: recurrenceId }) });
  });

  it('waits for a completed Todo to be reopened and completed again after enabling recurrence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const completedTodo = {
      id: todoId,
      title: 'Existing completed task',
      body: null,
      user_id: 'owner_A',
      completed: true,
      dueDate: new Date('2026-01-01T00:00:00.000Z'),
      priority: 'medium',
      todoType: 'standalone',
      recurrenceSeriesId: null,
    };
    const activeTodo = { ...completedTodo, recurrenceSeriesId: recurrenceId };
    todoMock.findFirst
      .mockResolvedValueOnce(completedTodo)
      .mockResolvedValueOnce(activeTodo)
      .mockResolvedValueOnce({ ...activeTodo, completed: false });
    todoRecurrenceMock.findFirst.mockResolvedValue({
      id: recurrenceId,
      user_id: 'owner_A',
      active: true,
      currentTodoId: todoId,
      frequency: 'daily',
      interval: 1,
      anchorDay: null,
    });
    todoMock.create.mockResolvedValue({ id: childId });

    try {
      await updateTodoAction({
        id: todoId,
        title: completedTodo.title,
        completed: true,
        completionIntent: 'preserve',
        recurrenceFrequency: 'daily',
        recurrenceInterval: 1,
      });
      expect(todoMock.create).not.toHaveBeenCalled();

      await toggleTodoAction({ id: todoId, completed: false });
      expect(todoMock.create).not.toHaveBeenCalled();

      await toggleTodoAction({ id: todoId, completed: true });
      expect(todoMock.create).toHaveBeenCalledTimes(1);
      expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({
        completed: false,
        dueDate: new Date('2026-01-02T00:00:00.000Z'),
        recurrenceSeriesId: recurrenceId,
      }) });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shifts the monthly anchor when the current occurrence due date is edited', async () => {
    const occurrence = {
      id: todoId,
      title: 'Monthly task',
      body: null,
      user_id: 'owner_A',
      completed: false,
      dueDate: new Date('2025-01-31T00:00:00.000Z'),
      priority: 'medium',
      todoType: 'standalone',
      recurrenceSeriesId: recurrenceId,
    };
    todoMock.findFirst.mockResolvedValue(occurrence);
    todoRecurrenceMock.findFirst.mockResolvedValue({
      id: recurrenceId,
      user_id: 'owner_A',
      active: true,
      currentTodoId: todoId,
      frequency: 'monthly',
      interval: 1,
      anchorDay: 31,
    });

    await updateTodoAction({
      id: todoId,
      title: 'Monthly task',
      completed: false,
      completionIntent: 'preserve',
      dueDate: '2025-01-15',
      recurrenceFrequency: 'monthly',
      recurrenceInterval: 1,
    });

    expect(todoRecurrenceMock.updateMany).toHaveBeenCalledWith({
      where: { id: recurrenceId, user_id: 'owner_A', active: true, currentTodoId: todoId },
      data: { frequency: 'monthly', interval: 1, anchorDay: 15 },
    });
  });

  it('does not allow an active recurring Todo to lose its due date', async () => {
    todoMock.findFirst.mockResolvedValue({ id: todoId, title: 'Recurring task', body: null, completed: false, user_id: 'owner_A', dueDate: new Date('2026-01-01T00:00:00.000Z'), priority: 'medium', todoType: 'standalone', recurrenceSeriesId: recurrenceId });
    todoRecurrenceMock.findFirst.mockResolvedValue({ id: recurrenceId, user_id: 'owner_A', active: true, currentTodoId: todoId, frequency: 'daily', interval: 1, anchorDay: null });
    await expect(updateTodoAction({ id: todoId, title: 'Recurring task', completed: false, dueDate: '' })).rejects.toThrow('A due date is required for recurring Todos.');
    expect(todoMock.updateMany).not.toHaveBeenCalled();
  });

  it('toggles only an owned parent and its owned children', async () => {
    await toggleTodoAction({ id: todoId, completed: true });
    expect(todoSubtaskMock.updateMany).toHaveBeenCalledWith({ where: { todoId, user_id: 'owner_A' }, data: { completed: true } });
    expect(todoMock.updateMany).toHaveBeenCalledWith({ where: { id: todoId, user_id: 'owner_A', completed: false }, data: { completed: true } });
  });

  it('generates one next occurrence on parent completion and treats a repeated request as idempotent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-03T15:00:00.000Z'));
    const occurrence = { id: todoId, title: 'Daily task', body: 'Description text', user_id: 'owner_A', completed: false, dueDate: new Date('2026-01-01T00:00:00.000Z'), priority: 'high', todoType: 'standalone', recurrenceSeriesId: recurrenceId };
    todoMock.findFirst.mockResolvedValueOnce(occurrence).mockResolvedValueOnce({ ...occurrence, completed: true });
    todoRecurrenceMock.findFirst.mockResolvedValue({ id: recurrenceId, user_id: 'owner_A', active: true, currentTodoId: todoId, frequency: 'daily', interval: 1, anchorDay: null });
    todoMock.create.mockResolvedValue({ id: childId });
    try {
      await toggleTodoAction({ id: todoId, completed: true });
      await toggleTodoAction({ id: todoId, completed: true });
      expect(todoMock.create).toHaveBeenCalledTimes(1);
      expect(todoMock.create).toHaveBeenCalledWith({ data: expect.objectContaining({ title: 'Daily task', body: 'Description text', priority: 'high', completed: false, dueDate: new Date('2026-01-04T00:00:00.000Z'), recurrenceSeriesId: recurrenceId }) });
      expect(todoRecurrenceMock.updateMany).toHaveBeenCalledWith({ where: { id: recurrenceId, user_id: 'owner_A', active: true, currentTodoId: todoId }, data: { currentTodoId: childId } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a recurrence cursor compare-and-set miss', async () => {
    const occurrence = { id: todoId, title: 'Weekly task', body: null, user_id: 'owner_A', completed: false, dueDate: new Date('2026-01-01T00:00:00.000Z'), priority: 'medium', todoType: 'standalone', recurrenceSeriesId: recurrenceId };
    todoMock.findFirst.mockResolvedValue(occurrence);
    todoRecurrenceMock.findFirst.mockResolvedValue({ id: recurrenceId, user_id: 'owner_A', active: true, currentTodoId: todoId, frequency: 'weekly', interval: 1, anchorDay: null });
    todoRecurrenceMock.updateMany.mockResolvedValueOnce({ count: 0 });
    todoMock.create.mockResolvedValue({ id: childId });
    await expect(toggleTodoAction({ id: todoId, completed: true })).rejects.toThrow('Recurrence changed concurrently. Please retry.');
    expect(todoRecurrenceMock.updateMany).toHaveBeenCalledWith({ where: { id: recurrenceId, user_id: 'owner_A', active: true, currentTodoId: todoId }, data: { currentTodoId: childId } });
  });

  it('stops an owner-scoped recurrence without deleting its Todos', async () => {
    todoMock.findFirst.mockResolvedValue({ recurrenceSeriesId: recurrenceId });
    await stopTodoRecurrenceAction({ id: todoId });
    expect(todoMock.findFirst).toHaveBeenCalledWith({ where: { id: todoId, user_id: 'owner_A' }, select: { recurrenceSeriesId: true } });
    expect(todoRecurrenceMock.updateMany).toHaveBeenCalledWith({ where: { id: recurrenceId, user_id: 'owner_A', active: true }, data: { active: false } });
    expect(todoMock.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects recurrence stop requests without Clerk identity', async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    await expect(stopTodoRecurrenceAction({ id: todoId })).rejects.toThrow('Unauthorized');
    expect(todoRecurrenceMock.updateMany).not.toHaveBeenCalled();
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

  it('logs allowlisted Prisma diagnostics while keeping client errors generic and programming errors intact', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('mongodb://secret-user:secret-pass@private-host/private-db', {
      code: 'P2031',
      clientVersion: '6.19.3',
    });
    prismaMock.$transaction.mockRejectedValueOnce(prismaError);
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(deleteTodoAction({ id: todoId })).rejects.toThrow('Could not delete this Todo. Please try again.');
    expect(diagnostic).toHaveBeenCalledWith('[server-action] Transaction failed', {
      operation: 'deleteTodoAction', errorClass: 'PrismaClientKnownRequestError', errorName: 'PrismaClientKnownRequestError', errorCode: 'P2031',
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('secret-pass');

    diagnostic.mockImplementation(() => { throw new Error('logger failure'); });
    prismaMock.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('private task title', {
      code: 'P2031',
      clientVersion: '6.19.3',
    }));
    await expect(deleteTodoAction({ id: todoId })).rejects.toThrow('Could not delete this Todo. Please try again.');
    expect(JSON.stringify(diagnostic.mock.calls[1])).not.toContain('private task title');

    const programmingError = Object.assign(new Error('private task title'), { name: 'PrivateTaskTitle', code: 'private-data' });
    prismaMock.$transaction.mockRejectedValueOnce(programmingError);
    await expect(deleteTodoAction({ id: todoId })).rejects.toBe(programmingError);
    expect(diagnostic).toHaveBeenCalledTimes(2);
    diagnostic.mockRestore();
  });

  it('omits unexpected Prisma diagnostic identifiers', async () => {
    class UnexpectedPrismaError extends Prisma.PrismaClientKnownRequestError {}
    const unexpectedError = new UnexpectedPrismaError('private connection and record details', {
      code: 'P2031',
      clientVersion: '6.19.3',
    });
    unexpectedError.name = 'PrivateUserAndTaskContent';
    (unexpectedError as { code: string }).code = 'private-record-value';
    prismaMock.$transaction.mockRejectedValueOnce(unexpectedError);
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(deleteTodoAction({ id: todoId })).rejects.toThrow('Could not delete this Todo. Please try again.');

    expect(diagnostic).toHaveBeenCalledWith('[server-action] Transaction failed', {
      operation: 'deleteTodoAction',
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('PrivateUserAndTaskContent');
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private-record-value');
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private connection and record details');
    diagnostic.mockRestore();
  });
});

describe('Todo reads', () => {
  it('returns no records without an owner and scopes reads to authenticated owner IDs', async () => {
    await expect(getUserTodos(null)).resolves.toEqual([]);
    todoMock.findMany.mockResolvedValue([]);
    await getUserTodos('owner_A');
    expect(todoMock.findMany).toHaveBeenCalledWith({ where: { user_id: 'owner_A' }, orderBy: { createdAt: 'desc' } });
  });
});
