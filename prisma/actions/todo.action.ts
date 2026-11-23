'use server'

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  validateTaskCreate,
  validateTaskDelete,
  validateTaskToggle,
  validateTaskUpdate,
} from '@/prisma/actions/validation';
import { dateOnlyToUtcDate } from '@/lib/utils';
import { ActionDomainError, normalizeTransactionError } from '@/prisma/actions/action-errors';
import { subtaskCreateSchema, subtaskDeleteSchema, subtaskToggleSchema, subtaskUpdateSchema } from '@/lib/validations/subtask';

const assertTopLevelTodoId = async (id: string, userId: string) => {
  const subtask = await prisma.todoSubtask.findFirst({ where: { id, user_id: userId }, select: { id: true } });
  if (subtask) throw new Error('Todo not found');
};

export const createTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskCreate(payload);

  const data = {
    title: validated.title,
    body: validated.body,
    completed: validated.todoType === 'withSubtasks' && validated.initialSubtasks.length > 0 ? false : validated.completed,
    dueDate: validated.dueDate ? dateOnlyToUtcDate(validated.dueDate) : undefined,
    priority: validated.priority,
    todoType: validated.todoType,
    user_id: userId,
  };

  if (validated.todoType === 'withSubtasks') {
    await prisma.$transaction(async (transaction) => {
      const parent = await transaction.todo.create({ data });
      for (const title of validated.initialSubtasks) {
        await transaction.todoSubtask.create({
          data: { todoId: parent.id, user_id: userId, title, completed: false },
        });
      }
    });
  } else {
    await prisma.todo.create({ data });
  }

  revalidatePath('/');
};

export const deleteTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { id } = validateTaskDelete(payload);
  await assertTopLevelTodoId(id, userId);

  try {
    await prisma.$transaction(async (transaction) => {
      const parent = await transaction.todo.findFirst({ where: { id, user_id: userId }, select: { id: true, completed: true } });
      if (!parent) throw new ActionDomainError('Todo not found');
      const guard = await transaction.todo.updateMany({
        where: { id, user_id: userId, completed: parent.completed },
        data: { completed: !parent.completed },
      });
      if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
      await transaction.todoSubtask.deleteMany({ where: { todoId: id, user_id: userId } });
      const { count } = await transaction.todo.deleteMany({ where: { id, user_id: userId } });
      if (count === 0) throw new ActionDomainError('Todo not found');
    });
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not delete this Todo. Please try again.', 'deleteTodoAction');
  }

  revalidatePath('/');
};

export const updateTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskUpdate(payload);
  await assertTopLevelTodoId(validated.id, userId);

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

  try {
    await prisma.$transaction(async (transaction) => {
      const todo = await transaction.todo.findFirst({
        where: { id: validated.id, user_id: userId },
        select: { completed: true },
      });
      if (!todo) throw new ActionDomainError('Todo not found');

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
    });
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not save your changes. Please try again.');
  }

  revalidatePath('/');
};

export const toggleTodoAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskToggle(payload);
  await assertTopLevelTodoId(validated.id, userId);

  try {
    await prisma.$transaction(async (transaction) => {
      const parent = await transaction.todo.findFirst({ where: { id: validated.id, user_id: userId }, select: { id: true, completed: true } });
      if (!parent) throw new ActionDomainError('Todo not found');
      if (parent.completed !== validated.completed) {
        const guard = await transaction.todo.updateMany({
          where: { id: validated.id, user_id: userId, completed: parent.completed },
          data: { completed: !parent.completed },
        });
        if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
        await transaction.todoSubtask.updateMany({ where: { todoId: validated.id, user_id: userId }, data: { completed: validated.completed } });
        await transaction.todo.updateMany({ where: { id: validated.id, user_id: userId }, data: { completed: validated.completed } });
      }
    });
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not update completion. Please try again.');
  }

  revalidatePath('/');
};

export const createSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskCreateSchema.parse(payload);
  await assertTopLevelTodoId(input.todoId, userId);
  let created: { id: string; todoId: string; title: string; completed: boolean; createdAt: Date };
  try {
    created = await prisma.$transaction(async (transaction) => {
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
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not create this subtask. Please try again.');
  }
  revalidatePath('/');
  return { id: created.id, todoId: created.todoId, title: created.title, completed: created.completed, createdAt: created.createdAt };
};

export const updateSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskUpdateSchema.parse(payload);
  try {
    await prisma.$transaction(async (transaction) => {
      const parent = await transaction.todo.findFirst({ where: { id: input.todoId, user_id: userId }, select: { id: true } });
      if (!parent) throw new ActionDomainError('Todo not found');
      const { count } = await transaction.todoSubtask.updateMany({ where: { id: input.id, todoId: input.todoId, user_id: userId }, data: { title: input.title } });
      if (!count) throw new ActionDomainError('Subtask not found');
    });
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not edit this subtask. Please try again.');
  }
  revalidatePath('/');
};

export const toggleSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskToggleSchema.parse(payload);
  try {
    await prisma.$transaction(async (transaction) => {
      const parent = await transaction.todo.findFirst({ where: { id: input.todoId, user_id: userId }, select: { id: true, completed: true } });
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
    });
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not update this subtask. Please try again.');
  }
  revalidatePath('/');
};

export const deleteSubtaskAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const input = subtaskDeleteSchema.parse(payload);
  try {
    await prisma.$transaction(async (transaction) => {
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
    });
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not delete this subtask. Please try again.');
  }
  revalidatePath('/');
};
