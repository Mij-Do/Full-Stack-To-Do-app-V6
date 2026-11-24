'use server'

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import {
  validateTaskCreate,
  validateTaskDelete,
  validateTaskToggle,
  validateTaskUpdate,
} from '@/prisma/actions/validation';
import { dateOnlyToUtcDate } from '@/lib/utils';
import { MAX_RECURRENCE_INTERVAL, type RecurrenceChoice, type RecurrenceFrequency } from '@/lib/validations/task';
import { ActionDomainError, runWithPersistenceError } from '@/prisma/actions/action-errors';
import { assertTopLevelTodoId, createNextOccurrence, toggleTodoInTransaction, type RecurrenceSource } from '@/prisma/actions/todo-action-internals';

const configureTodoRecurrence = async (
  transaction: Prisma.TransactionClient,
  todo: RecurrenceSource,
  userId: string,
  frequency: RecurrenceChoice | undefined,
  interval: number | undefined,
  dueDate: Date | null,
) => {
  const existing = todo.recurrenceSeriesId
    ? await transaction.todoRecurrence.findFirst({ where: { id: todo.recurrenceSeriesId, user_id: userId } })
    : null;

  if (frequency === undefined) {
    if (existing?.active && !dueDate) throw new ActionDomainError('A due date is required for recurring Todos.');
    return existing;
  }

  if (frequency === 'none') {
    if (existing?.active) {
      await transaction.todoRecurrence.updateMany({
        where: { id: existing.id, user_id: userId, active: true },
        data: { active: false },
      });
    }
    return existing ? { ...existing, active: false } : null;
  }

  if (!dueDate) throw new ActionDomainError('A due date is required for recurring Todos.');
  const nextInterval = interval ?? existing?.interval ?? 1;
  if (!Number.isInteger(nextInterval) || nextInterval < 1 || nextInterval > MAX_RECURRENCE_INTERVAL) {
    throw new ActionDomainError(`Recurrence interval must be between 1 and ${MAX_RECURRENCE_INTERVAL}.`);
  }
  if (existing?.active) {
    if (existing.currentTodoId !== todo.id) {
      if (existing.frequency === frequency && existing.interval === nextInterval) return existing;
      throw new ActionDomainError('Edit recurrence from the current occurrence.');
    }
    const dueDateWasShifted = todo.dueDate?.getTime() !== dueDate.getTime();
    const anchorDay = frequency === 'monthly'
      ? dueDateWasShifted || existing.frequency !== 'monthly'
        ? dueDate.getUTCDate()
        : existing.anchorDay ?? dueDate.getUTCDate()
      : null;
    const updated = await transaction.todoRecurrence.updateMany({
      where: { id: existing.id, user_id: userId, active: true, currentTodoId: todo.id },
      data: {
        frequency,
        interval: nextInterval,
        anchorDay,
      },
    });
    if (updated.count !== 1) throw new ActionDomainError('Recurrence changed concurrently. Please retry.');
    return { ...existing, frequency, interval: nextInterval, anchorDay };
  }

  const created = await transaction.todoRecurrence.create({
    data: {
      user_id: userId,
      frequency,
      interval: nextInterval,
      active: true,
      currentTodoId: todo.id,
      anchorDay: frequency === 'monthly' ? dueDate.getUTCDate() : null,
    },
  });
  if (todo.recurrenceSeriesId !== created.id) {
    const linked = await transaction.todo.updateMany({
      where: { id: todo.id, user_id: userId, recurrenceSeriesId: todo.recurrenceSeriesId },
      data: { recurrenceSeriesId: created.id },
    });
    if (linked.count !== 1) throw new ActionDomainError('Todo not found');
  }
  return created;
};

export const createTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskCreate(payload);

  const data = {
    title: validated.title,
    body: validated.body,
    completed: false,
    dueDate: validated.dueDate ? dateOnlyToUtcDate(validated.dueDate) : undefined,
    priority: validated.priority,
    todoType: validated.todoType,
    user_id: userId,
  };

  if (validated.todoType === 'withSubtasks' || validated.recurrenceFrequency !== 'none') {
    await runWithPersistenceError(() => prisma.$transaction(async (transaction) => {
      const recurrence = validated.recurrenceFrequency === 'none' ? null : await transaction.todoRecurrence.create({
        data: {
          user_id: userId,
          frequency: validated.recurrenceFrequency,
          interval: validated.recurrenceInterval,
          active: true,
          currentTodoId: null,
          anchorDay: validated.recurrenceFrequency === 'monthly' && data.dueDate ? data.dueDate.getUTCDate() : null,
        },
      });
      const parent = await transaction.todo.create({ data: { ...data, recurrenceSeriesId: recurrence?.id ?? null } });
      if (recurrence) {
        await transaction.todoRecurrence.updateMany({
          where: { id: recurrence.id, user_id: userId, active: true, currentTodoId: null },
          data: { currentTodoId: parent.id },
        });
      }
      for (const title of validated.initialSubtasks) {
        await transaction.todoSubtask.create({
          data: { todoId: parent.id, user_id: userId, title, completed: false },
        });
      }
    }), 'Could not create this Todo. Please try again.');
  } else {
    await runWithPersistenceError(() => prisma.todo.create({ data }), 'Could not create this Todo. Please try again.');
  }

  revalidatePath('/');
};

export const deleteTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { id } = validateTaskDelete(payload);

  await runWithPersistenceError(() => assertTopLevelTodoId(id, userId), 'Could not delete this Todo. Please try again.');
  await runWithPersistenceError(() => prisma.$transaction(async (transaction) => {
    const parent = await transaction.todo.findFirst({ where: { id, user_id: userId }, select: { id: true, completed: true, recurrenceSeriesId: true } });
    if (!parent) throw new ActionDomainError('Todo not found');
    if (parent.recurrenceSeriesId) {
      await transaction.todoRecurrence.updateMany({
        where: { id: parent.recurrenceSeriesId, user_id: userId, active: true, currentTodoId: id },
        data: { active: false },
      });
    }
    const guard = await transaction.todo.updateMany({
      where: { id, user_id: userId, completed: parent.completed },
      data: { completed: !parent.completed },
    });
    if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
    await transaction.todoSubtask.deleteMany({ where: { todoId: id, user_id: userId } });
    const { count } = await transaction.todo.deleteMany({ where: { id, user_id: userId } });
    if (count === 0) throw new ActionDomainError('Todo not found');
  }), 'Could not delete this Todo. Please try again.', 'deleteTodoAction');

  revalidatePath('/');
};

export const stopTodoRecurrenceAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { id } = validateTaskDelete(payload);

  await runWithPersistenceError(async () => {
    await assertTopLevelTodoId(id, userId);
    const todo = await prisma.todo.findFirst({ where: { id, user_id: userId }, select: { recurrenceSeriesId: true } });
    if (!todo) throw new ActionDomainError('Todo not found');
    if (todo.recurrenceSeriesId) {
      await prisma.todoRecurrence.updateMany({
        where: { id: todo.recurrenceSeriesId, user_id: userId, active: true },
        data: { active: false },
      });
    }
  }, 'Could not stop this recurrence. Please try again.');

  revalidatePath('/');
};

export const updateTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskUpdate(payload);

  const data = {
    title: validated.title,
    // '' means the description was explicitly cleared -> persist null.
    // undefined means the field was omitted -> Prisma leaves it unchanged.
    body: validated.body === '' ? null : validated.body,
    ...(validated.dueDate !== undefined && {
      dueDate: validated.dueDate === '' ? null : dateOnlyToUtcDate(validated.dueDate),
    }),
    ...(validated.priority !== undefined && { priority: validated.priority }),
  };
  const occurrenceNow = new Date();

  await runWithPersistenceError(async () => {
    await assertTopLevelTodoId(validated.id, userId);
    await prisma.$transaction(async (transaction) => {
      const todo = await transaction.todo.findFirst({
        where: { id: validated.id, user_id: userId },
        select: { id: true, title: true, body: true, completed: true, user_id: true, dueDate: true, priority: true, todoType: true, recurrenceSeriesId: true },
      });
      if (!todo) throw new ActionDomainError('Todo not found');

      const existingSeries = todo.recurrenceSeriesId
        ? await transaction.todoRecurrence.findFirst({ where: { id: todo.recurrenceSeriesId, user_id: userId } })
        : null;
      const effectiveDueDate = validated.dueDate === undefined
        ? todo.dueDate
        : validated.dueDate === '' ? null : dateOnlyToUtcDate(validated.dueDate);
      const desiredFrequency = validated.recurrenceFrequency;
      if (desiredFrequency === undefined && existingSeries?.active && !effectiveDueDate) {
        throw new ActionDomainError('A due date is required for recurring Todos.');
      }

      const completionChanged = validated.completionIntent === 'set' && todo.completed !== validated.completed;
      if (completionChanged) {
        const guard = await transaction.todo.updateMany({
          where: { id: validated.id, user_id: userId, completed: todo.completed },
          data: { completed: !todo.completed },
        });
        if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
      }

      const { count } = await transaction.todo.updateMany({
        where: { id: validated.id, user_id: userId },
        data: {
          ...data,
          ...(completionChanged && { completed: validated.completed }),
        },
      });
      if (count === 0) throw new ActionDomainError('Todo not found');
      if (completionChanged) {
        await transaction.todoSubtask.updateMany({
          where: { todoId: validated.id, user_id: userId },
          data: { completed: validated.completed },
        });
      }

      const recurrence = await configureTodoRecurrence(
        transaction,
        { ...todo, recurrenceSeriesId: todo.recurrenceSeriesId },
        userId,
        desiredFrequency,
        validated.recurrenceInterval,
        effectiveDueDate,
      );
      const effectiveCompleted = completionChanged ? validated.completed : todo.completed;
      if (completionChanged && validated.completed) {
        await createNextOccurrence(transaction, {
          ...todo,
          title: validated.title,
          body: validated.body === undefined ? todo.body : validated.body === '' ? null : validated.body,
          completed: effectiveCompleted,
          dueDate: effectiveDueDate,
          priority: validated.priority === undefined ? todo.priority : validated.priority,
          recurrenceSeriesId: recurrence?.id ?? null,
        }, userId, occurrenceNow);
      }
    });
  }, 'Could not save your changes. Please try again.');

  revalidatePath('/');
};

export const toggleTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskToggle(payload);
  const occurrenceNow = new Date();

  await runWithPersistenceError(async () => {
    await assertTopLevelTodoId(validated.id, userId);
    await prisma.$transaction((transaction) =>
      toggleTodoInTransaction(transaction, validated.id, validated.completed, userId, occurrenceNow),
    );
  }, 'Could not update completion. Please try again.');

  revalidatePath('/');
};
