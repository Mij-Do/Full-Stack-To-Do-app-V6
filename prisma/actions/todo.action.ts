'use server'

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '../../generated/prisma';
import {
  validateTaskCreate,
  validateTaskDelete,
  validateTaskToggle,
  validateTaskUpdate,
} from '@/prisma/actions/validation';
import { dateOnlyToUtcDate } from '@/lib/utils';

const prisma = new PrismaClient();

const requireUserId = async (): Promise<string> => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  return userId;
};

export const createTodoListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskCreate(payload);
  const targetListId = validated.listId;

  const data = {
    title: validated.title,
    body: validated.body,
    completed: validated.completed,
    dueDate: validated.dueDate ? dateOnlyToUtcDate(validated.dueDate) : undefined,
    priority: validated.priority,
    listId: targetListId ?? null,
    user_id: userId,
  };

  if (!targetListId) {
    await prisma.todo.create({ data });
  } else {
    await prisma.$transaction(async (transaction) => {
      const { count } = await transaction.todoList.updateMany({
        where: {
          id: targetListId,
          user_id: userId,
          isArchived: false,
        },
        data: { updatedAt: new Date() },
      });

      if (count === 0) {
        throw new Error('List not found');
      }

      await transaction.todo.create({ data });
    });
  }

  revalidatePath('/');
};

export const deleteTodoListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { id } = validateTaskDelete(payload);

  const { count } = await prisma.todo.deleteMany({
    where: {
      id,
      user_id: userId,
    },
  });

  if (count === 0) {
    throw new Error('Todo not found');
  }

  revalidatePath('/');
};

export const updateTodoListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskUpdate(payload);

  const data = {
    title: validated.title,
    // '' means the description was explicitly cleared -> persist null.
    // undefined means the field was omitted -> Prisma leaves it unchanged.
    body: validated.body === '' ? null : validated.body,
    completed: validated.completed,
    ...(validated.dueDate !== undefined && {
      dueDate: validated.dueDate === '' ? null : dateOnlyToUtcDate(validated.dueDate),
    }),
    ...(validated.priority !== undefined && { priority: validated.priority }),
  };

  if (validated.listId === undefined) {
    const { count } = await prisma.todo.updateMany({
      where: { id: validated.id, user_id: userId },
      data,
    });
    if (count === 0) throw new Error('Todo not found');
  } else {
    await prisma.$transaction(async (transaction) => {
      const todo = await transaction.todo.findFirst({
        where: { id: validated.id, user_id: userId },
        select: { listId: true },
      });
      if (!todo) throw new Error('Todo not found');

      if (validated.listId !== null) {
        const list = await transaction.todoList.findFirst({
          where: { id: validated.listId, user_id: userId },
          select: { isArchived: true },
        });
        if (!list || (list.isArchived && todo.listId !== validated.listId)) {
          throw new Error('List not found');
        }

        if (todo.listId !== validated.listId) {
          const { count } = await transaction.todoList.updateMany({
            where: {
              id: validated.listId,
              user_id: userId,
              isArchived: false,
            },
            data: { updatedAt: new Date() },
          });
          if (count === 0) throw new Error('List not found');
        }
      }

      const { count } = await transaction.todo.updateMany({
        where: { id: validated.id, user_id: userId },
        data: { ...data, listId: validated.listId },
      });
      if (count === 0) throw new Error('Todo not found');
    });
  }

  revalidatePath('/');
};

export const toggleTodoListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const validated = validateTaskToggle(payload);

  const { count } = await prisma.todo.updateMany({
    where: {
      id: validated.id,
      user_id: userId,
    },
    data: {
      completed: validated.completed,
    },
  });

  if (count === 0) {
    throw new Error('Todo not found');
  }

  revalidatePath('/');
};
