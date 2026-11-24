'use server'

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ActionDomainError, runWithPersistenceError } from '@/prisma/actions/action-errors';
import { assertTopLevelTodoId, createNextOccurrence } from '@/prisma/actions/todo-action-internals';
import { subtaskCreateSchema, subtaskDeleteSchema, subtaskToggleSchema, subtaskUpdateSchema } from '@/lib/validations/subtask';

export const createSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskCreateSchema.parse(payload);
  const created: { id: string; todoId: string; title: string; completed: boolean; createdAt: Date } = await runWithPersistenceError(async () => {
    await assertTopLevelTodoId(input.todoId, userId);
    return prisma.$transaction(async (transaction) => {
      const parent = await transaction.todo.findFirst({ where: { id: input.todoId, user_id: userId }, select: { id: true, completed: true } });
      if (!parent) throw new ActionDomainError('Todo not found');
      const guard = await transaction.todo.updateMany({
        where: { id: input.todoId, user_id: userId, completed: parent.completed },
        data: { completed: !parent.completed },
      });
      if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
      const subtask = await transaction.todoSubtask.create({ data: { todoId: input.todoId, user_id: userId, title: input.title, completed: false } });
      await transaction.todo.updateMany({ where: { id: input.todoId, user_id: userId }, data: { completed: false } });
      return subtask;
    });
  }, 'Could not create this subtask. Please try again.');
  revalidatePath('/');
  return { id: created.id, todoId: created.todoId, title: created.title, completed: created.completed, createdAt: created.createdAt };
};

export const updateSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskUpdateSchema.parse(payload);
  await runWithPersistenceError(() => prisma.$transaction(async (transaction) => {
    const parent = await transaction.todo.findFirst({ where: { id: input.todoId, user_id: userId }, select: { id: true } });
    if (!parent) throw new ActionDomainError('Todo not found');
    const { count } = await transaction.todoSubtask.updateMany({ where: { id: input.id, todoId: input.todoId, user_id: userId }, data: { title: input.title } });
    if (!count) throw new ActionDomainError('Subtask not found');
  }), 'Could not edit this subtask. Please try again.');
  revalidatePath('/');
};

export const toggleSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskToggleSchema.parse(payload);
  const occurrenceNow = new Date();
  await runWithPersistenceError(() => prisma.$transaction(async (transaction) => {
    const parent = await transaction.todo.findFirst({ where: { id: input.todoId, user_id: userId }, select: { id: true, title: true, body: true, user_id: true, completed: true, dueDate: true, priority: true, todoType: true, recurrenceSeriesId: true } });
    if (!parent) throw new ActionDomainError('Todo not found');
    const guard = await transaction.todo.updateMany({
      where: { id: input.todoId, user_id: userId, completed: parent.completed },
      data: { completed: !parent.completed },
    });
    if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
    const { count } = await transaction.todoSubtask.updateMany({ where: { id: input.id, todoId: input.todoId, user_id: userId }, data: { completed: input.completed } });
    if (!count) throw new ActionDomainError('Subtask not found');
    const subtasks = await transaction.todoSubtask.findMany({ where: { todoId: input.todoId, user_id: userId }, select: { completed: true } });
    const completed = subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);
    await transaction.todo.updateMany({ where: { id: input.todoId, user_id: userId }, data: { completed } });
    if (!parent.completed && completed) {
      await createNextOccurrence(transaction, { ...parent, completed: true }, userId, occurrenceNow);
    }
  }), 'Could not update this subtask. Please try again.');
  revalidatePath('/');
};

export const deleteSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskDeleteSchema.parse(payload);
  await runWithPersistenceError(() => prisma.$transaction(async (transaction) => {
    const parent = await transaction.todo.findFirst({ where: { id: input.todoId, user_id: userId }, select: { id: true, completed: true } });
    if (!parent) throw new ActionDomainError('Todo not found');
    const guard = await transaction.todo.updateMany({
      where: { id: input.todoId, user_id: userId, completed: parent.completed },
      data: { completed: !parent.completed },
    });
    if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
    const { count } = await transaction.todoSubtask.deleteMany({ where: { id: input.id, todoId: input.todoId, user_id: userId } });
    if (!count) throw new ActionDomainError('Subtask not found');
    const remaining = await transaction.todoSubtask.findMany({ where: { todoId: input.todoId, user_id: userId }, select: { completed: true } });
    const completed = remaining.length === 0 ? parent.completed : remaining.every((subtask) => subtask.completed);
    await transaction.todo.updateMany({ where: { id: input.todoId, user_id: userId }, data: { completed } });
  }), 'Could not delete this subtask. Please try again.');
  revalidatePath('/');
};
