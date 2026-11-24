import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionDomainError } from '@/prisma/actions/action-errors';
import { toggleTodoInTransaction } from '@/prisma/actions/todo-action-internals';

const { authMock, revalidatePathMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

import {
  createSubtaskAction,
  deleteTodoAction,
  stopTodoRecurrenceAction,
  toggleSubtaskAction,
  toggleTodoAction,
} from '@/prisma/actions/todo.action';

const CAS_MISS_CURSOR_ID = 'ffffffffffffffffffffffff';
const ACCEPTED_RETRY_MESSAGES = new Set([
  'Todo changed concurrently. Please retry.',
  'Recurrence changed concurrently. Please retry.',
  'Could not update completion. Please try again.',
  'Could not stop this recurrence. Please try again.',
  'Could not delete this Todo. Please try again.',
  'Todo not found',
]);
let ownerId = '';

const withSafeDatabaseError = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ActionDomainError) throw error;
    throw new Error('Integration database operation failed; database details are suppressed.');
  }
};

const removeTestOwnerData = async () => withSafeDatabaseError(async () => {
  if (!ownerId) return;
  await prisma.todoSubtask.deleteMany({ where: { user_id: ownerId } });
  await prisma.todo.deleteMany({ where: { user_id: ownerId } });
  await prisma.todoRecurrence.deleteMany({ where: { user_id: ownerId } });
});

const createRecurringTodo = async ({
  completed = false,
  withSubtask = false,
}: { completed?: boolean; withSubtask?: boolean } = {}) => withSafeDatabaseError(() => prisma.$transaction(async (transaction) => {
  const series = await transaction.todoRecurrence.create({
    data: {
      user_id: ownerId,
      frequency: 'daily',
      interval: 1,
      active: true,
      currentTodoId: null,
      anchorDay: null,
    },
  });
  const todo = await transaction.todo.create({
    data: {
      title: 'Integration task',
      body: 'A body for the integration test.',
      completed,
      user_id: ownerId,
      dueDate: new Date('2026-01-01T00:00:00.000Z'),
      priority: 'high',
      todoType: withSubtask ? 'withSubtasks' : 'standalone',
      recurrenceSeriesId: series.id,
    },
  });
  await transaction.todoRecurrence.updateMany({
    where: { id: series.id, user_id: ownerId, active: true, currentTodoId: null },
    data: { currentTodoId: todo.id },
  });
  if (withSubtask) {
    await transaction.todoSubtask.create({
      data: { todoId: todo.id, user_id: ownerId, title: 'Initial checklist step', completed, },
    });
  }
  return { todo, series };
}));

const withCursorCompareAndSetMiss = (transaction: Prisma.TransactionClient): Prisma.TransactionClient =>
  new Proxy(transaction, {
    get(target, property) {
      if (property !== 'todoRecurrence') return Reflect.get(target, property, target);

      const recurrence = Reflect.get(target, property, target) as Prisma.TransactionClient['todoRecurrence'];
      return new Proxy(recurrence, {
        get(delegate, method) {
          if (method === 'updateMany') {
            return (args: Prisma.TodoRecurrenceUpdateManyArgs) => delegate.updateMany({
              ...args,
              where: { ...args.where, currentTodoId: CAS_MISS_CURSOR_ID },
            });
          }
          const value = Reflect.get(delegate, method, delegate) as unknown;
          return typeof value === 'function' ? value.bind(delegate) : value;
        },
      });
    },
  });

const expectOnlyDocumentedRetryErrors = (results: PromiseSettledResult<unknown>[]) => {
  for (const result of results) {
    if (result.status === 'rejected') {
      const isDocumentedRetry = result.reason instanceof Error && ACCEPTED_RETRY_MESSAGES.has(result.reason.message);
      expect(isDocumentedRetry).toBe(true);
    }
  }
};

describe('MongoDB replica-set transaction integration', () => {
  beforeAll(async () => {
    try {
      await prisma.$connect();
    } catch {
      throw new Error('Could not connect to the configured integration replica set. Database details are suppressed.');
    }
  });

  beforeEach(() => {
    ownerId = `integration_${randomUUID()}`;
    authMock.mockResolvedValue({ userId: ownerId });
    revalidatePathMock.mockReset();
  });

  afterEach(async () => {
    await removeTestOwnerData();
    ownerId = '';
  });

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      throw new Error('Could not disconnect from the integration replica set. Database details are suppressed.');
    }
  });

  it('rolls back parent, candidate Todo, and copied Subtasks when the action transaction gets a real cursor CAS miss', async () => {
    const { todo, series } = await createRecurringTodo({ withSubtask: true });

    // This is the exact transaction body called by toggleTodoAction. Only the
    // cursor predicate is altered; all other reads and writes are real.
    await expect(withSafeDatabaseError(() => prisma.$transaction((transaction) =>
      toggleTodoInTransaction(withCursorCompareAndSetMiss(transaction), todo.id, true, ownerId, new Date('2026-01-01T12:00:00.000Z')),
    ))).rejects.toThrow('Recurrence changed concurrently. Please retry.');

    const [todos, subtasks, cursor] = await withSafeDatabaseError(() => Promise.all([
      prisma.todo.findMany({ where: { user_id: ownerId } }),
      prisma.todoSubtask.findMany({ where: { user_id: ownerId } }),
      prisma.todoRecurrence.findFirst({ where: { id: series.id, user_id: ownerId } }),
    ]));
    expect(todos.map(({ id }) => id)).toEqual([todo.id]);
    expect(todos[0]?.completed).toBe(false);
    expect(subtasks).toHaveLength(1);
    expect(subtasks[0]?.completed).toBe(false);
    expect(cursor?.currentTodoId).toBe(todo.id);
  });

  it('creates exactly one next occurrence under competing completion requests', async () => {
    const { todo, series } = await createRecurringTodo();

    const results = await Promise.allSettled([
      toggleTodoAction({ id: todo.id, completed: true }),
      toggleTodoAction({ id: todo.id, completed: true }),
    ]);
    expectOnlyDocumentedRetryErrors(results);

    const [todos, cursor] = await withSafeDatabaseError(() => Promise.all([
      prisma.todo.findMany({ where: { user_id: ownerId, recurrenceSeriesId: series.id } }),
      prisma.todoRecurrence.findFirst({ where: { id: series.id, user_id: ownerId } }),
    ]));
    expect(todos).toHaveLength(2);
    expect(todos.filter((item) => item.id !== todo.id && !item.completed)).toHaveLength(1);
    expect(todos.find((item) => item.id === todo.id)?.completed).toBe(true);
    expect(cursor?.currentTodoId).toBe(todos.find((item) => item.id !== todo.id)?.id);
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
    // A competing transaction may be rejected for retry; persisted state must still be singular.
  });

  it('reopens a completed parent when adding a child and completes it when the final child is checked', async () => {
    const { todo, series } = await createRecurringTodo({ completed: true, withSubtask: true });

    const added = await createSubtaskAction({ todoId: todo.id, title: 'Second checklist step' });
    expect(await withSafeDatabaseError(() => prisma.todo.findFirst({ where: { id: todo.id, user_id: ownerId } }))).toMatchObject({ completed: false });

    await toggleSubtaskAction({ todoId: todo.id, id: added.id, completed: true });

    const [parent, children, todos, cursor] = await withSafeDatabaseError(() => Promise.all([
      prisma.todo.findFirst({ where: { id: todo.id, user_id: ownerId } }),
      prisma.todoSubtask.findMany({ where: { todoId: todo.id, user_id: ownerId } }),
      prisma.todo.findMany({ where: { user_id: ownerId, recurrenceSeriesId: series.id } }),
      prisma.todoRecurrence.findFirst({ where: { id: series.id, user_id: ownerId } }),
    ]));
    expect(parent?.completed).toBe(true);
    expect(children).toHaveLength(2);
    expect(children.every((child) => child.completed)).toBe(true);
    expect(todos).toHaveLength(2);
    expect(cursor?.currentTodoId).toBe(todos.find((item) => item.id !== todo.id)?.id);

    const nextTodo = todos.find((item) => item.id !== todo.id);
    expect(nextTodo).toBeDefined();
    const nextChildren = await withSafeDatabaseError(() => prisma.todoSubtask.findMany({
      where: { todoId: nextTodo!.id, user_id: ownerId },
    }));
    const previousChildIds = new Set(children.map(({ id }) => id));
    const copiedChildIds = nextChildren.map(({ id }) => id);
    expect(nextChildren).toHaveLength(children.length);
    expect(copiedChildIds.filter((id) => previousChildIds.has(id))).toEqual([]);
    expect(new Set(copiedChildIds).size).toBe(copiedChildIds.length);
    expect(nextChildren.every((child) => child.todoId === nextTodo!.id && child.user_id === ownerId)).toBe(true);
    expect(nextChildren.every((child) => child.completed === false)).toBe(true);
  });

  it('leaves a stopped series inactive during a competing completion', async () => {
    const { todo, series } = await createRecurringTodo();

    const results = await Promise.allSettled([
      toggleTodoAction({ id: todo.id, completed: true }),
      stopTodoRecurrenceAction({ id: todo.id }),
    ]);
    expectOnlyDocumentedRetryErrors(results);

    const [todos, cursor] = await withSafeDatabaseError(() => Promise.all([
      prisma.todo.findMany({ where: { user_id: ownerId, recurrenceSeriesId: series.id } }),
      prisma.todoRecurrence.findFirst({ where: { id: series.id, user_id: ownerId } }),
    ]));
    expect(cursor?.active).toBe(false);
    expect([1, 2]).toContain(todos.length);
    expect(new Set(todos.map((item) => item.id)).size).toBe(todos.length);
    expect(todos.some((item) => item.id === todo.id)).toBe(true);
    expect(todos.some((item) => item.id === cursor?.currentTodoId)).toBe(true);
  });

  it('deletes the current occurrence and children, deactivates the series, and preserves prior history', async () => {
    const { todo: prior, series } = await createRecurringTodo({ withSubtask: true });
    await toggleTodoAction({ id: prior.id, completed: true });
    const current = await withSafeDatabaseError(() => prisma.todo.findFirst({
      where: { user_id: ownerId, recurrenceSeriesId: series.id, id: { not: prior.id } },
    }));
    expect(current).not.toBeNull();
    await withSafeDatabaseError(() => prisma.todoSubtask.create({
      data: { todoId: current!.id, user_id: ownerId, title: 'Current occurrence child', completed: false },
    }));

    await deleteTodoAction({ id: current!.id });

    const [history, deletedTodo, historyChildren, deletedChildren, cursor] = await withSafeDatabaseError(() => Promise.all([
      prisma.todo.findFirst({ where: { id: prior.id, user_id: ownerId } }),
      prisma.todo.findFirst({ where: { id: current!.id, user_id: ownerId } }),
      prisma.todoSubtask.findMany({ where: { todoId: prior.id, user_id: ownerId } }),
      prisma.todoSubtask.findMany({ where: { todoId: current!.id, user_id: ownerId } }),
      prisma.todoRecurrence.findFirst({ where: { id: series.id, user_id: ownerId } }),
    ]));
    expect(history?.completed).toBe(true);
    expect(deletedTodo).toBeNull();
    expect(historyChildren).toHaveLength(1);
    expect(deletedChildren).toHaveLength(0);
    expect(cursor?.active).toBe(false);
  });

  it('preserves valid series state and history when current-occurrence deletion races completion', async () => {
    const { todo: prior, series } = await createRecurringTodo({ withSubtask: true });
    await toggleTodoAction({ id: prior.id, completed: true });
    const current = await withSafeDatabaseError(() => prisma.todo.findFirst({
      where: { user_id: ownerId, recurrenceSeriesId: series.id, id: { not: prior.id } },
    }));
    expect(current).not.toBeNull();

    // These are real concurrent Server Action invocations, but the test has no
    // hook to force both transactions across the boundary at the same instant.
    // The persisted-state checks therefore accept either transaction ordering.
    const results = await Promise.allSettled([
      toggleTodoAction({ id: current!.id, completed: true }),
      deleteTodoAction({ id: current!.id }),
    ]);
    expectOnlyDocumentedRetryErrors(results);
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);

    const [persistedTodos, ownerTodos, ownerSubtasks, persistedSeries, priorSubtasks, racedTodo, racedSubtasks] = await withSafeDatabaseError(() => Promise.all([
      prisma.todo.findMany({ where: { user_id: ownerId, recurrenceSeriesId: series.id } }),
      prisma.todo.findMany({ where: { user_id: ownerId } }),
      prisma.todoSubtask.findMany({ where: { user_id: ownerId } }),
      prisma.todoRecurrence.findFirst({ where: { id: series.id, user_id: ownerId } }),
      prisma.todoSubtask.findMany({ where: { todoId: prior.id, user_id: ownerId } }),
      prisma.todo.findFirst({ where: { id: current!.id, user_id: ownerId } }),
      prisma.todoSubtask.findMany({ where: { todoId: current!.id, user_id: ownerId } }),
    ]));

    expect(persistedTodos.some((item) => item.id === prior.id)).toBe(true);
    expect(persistedTodos.find((item) => item.id === prior.id)?.completed).toBe(true);
    expect(priorSubtasks).toHaveLength(1);
    expect(priorSubtasks[0]?.completed).toBe(true);
    expect(new Set(persistedTodos.map(({ id }) => id)).size).toBe(persistedTodos.length);
    const ownerTodoIds = new Set(ownerTodos.map(({ id }) => id));
    expect(ownerSubtasks.every((child) => child.user_id === ownerId && ownerTodoIds.has(child.todoId))).toBe(true);
    const subtasksAttachedToOwnerTodos = await withSafeDatabaseError(() => prisma.todoSubtask.findMany({
      where: { todoId: { in: [...ownerTodoIds] } },
    }));
    expect(subtasksAttachedToOwnerTodos.every((child) => child.user_id === ownerId)).toBe(true);

    if (persistedSeries?.active) {
      const currentSeriesTodo = persistedTodos.find((item) => item.id === persistedSeries.currentTodoId);
      expect(currentSeriesTodo).toBeDefined();
      expect(persistedSeries.currentTodoId).not.toBe(current!.id);
      expect(currentSeriesTodo?.completed).toBe(false);
      expect(persistedTodos.map(({ id }) => id).sort()).toEqual([
        prior.id,
        currentSeriesTodo!.id,
        ...(racedTodo ? [current!.id] : []),
      ].sort());

      if (racedTodo) {
        expect(racedTodo.completed).toBe(true);
        expect(racedSubtasks).toHaveLength(1);
        expect(racedSubtasks.every((child) => child.completed)).toBe(true);
      } else {
        expect(racedSubtasks).toHaveLength(0);
      }

      const nextSubtasks = await withSafeDatabaseError(() => prisma.todoSubtask.findMany({
        where: { todoId: persistedSeries.currentTodoId!, user_id: ownerId },
      }));
      expect(nextSubtasks).toHaveLength(1);
      expect(nextSubtasks[0]?.completed).toBe(false);
      expect(nextSubtasks.map(({ id }) => id)).not.toContain(priorSubtasks[0]?.id);
      expect(nextSubtasks.map(({ id }) => id)).not.toContain(racedSubtasks[0]?.id);
    } else {
      expect(persistedSeries?.active).toBe(false);
      expect(racedTodo).toBeNull();
      expect(racedSubtasks).toHaveLength(0);
      expect(persistedTodos.map(({ id }) => id)).toEqual([prior.id]);
      // Deletion-first leaves the inactive series' cursor on the deleted ID.
      expect(persistedSeries?.currentTodoId).toBe(current!.id);
    }
  });
});
