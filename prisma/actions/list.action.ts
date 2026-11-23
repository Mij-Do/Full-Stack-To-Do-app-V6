'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { PrismaClient } from '../../generated/prisma';
import {
  validateListCreate,
  validateListIdAction,
  validateListRename,
} from '@/prisma/actions/validation';
import {
  ActionDomainError,
  LIST_NOT_EMPTY_MESSAGE,
  normalizeTransactionError,
} from '@/prisma/actions/action-errors';

const prisma = new PrismaClient();

const requireUserId = async (): Promise<string> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
};

export const createListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { name } = validateListCreate(payload);
  const list = await prisma.todoList.create({
    data: { name, user_id: userId },
    select: { id: true, name: true, isArchived: true },
  });

  revalidatePath('/');
  return list;
};

export const renameListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { id, name } = validateListRename(payload);
  const { count } = await prisma.todoList.updateMany({
    where: { id, user_id: userId },
    data: { name },
  });
  if (count === 0) throw new Error('List not found');

  revalidatePath('/');
};

export const archiveListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { id } = validateListIdAction(payload);
  const { count } = await prisma.todoList.updateMany({
    where: { id, user_id: userId },
    data: { isArchived: true },
  });
  if (count === 0) throw new Error('List not found');

  revalidatePath('/');
};

export const deleteEmptyListAction = async (payload: unknown) => {
  const userId = await requireUserId();
  const { id } = validateListIdAction(payload);

  try {
    await prisma.$transaction(async (transaction) => {
      const { count: lockedListCount } = await transaction.todoList.updateMany({
        where: { id, user_id: userId },
        data: { updatedAt: new Date() },
      });
      if (lockedListCount === 0) throw new ActionDomainError('List not found');

      const todoCount = await transaction.todo.count({
        where: { listId: id },
      });
      if (todoCount > 0) throw new ActionDomainError(LIST_NOT_EMPTY_MESSAGE);

      const { count } = await transaction.todoList.deleteMany({
        where: { id, user_id: userId },
      });
      if (count === 0) throw new ActionDomainError('List not found');
    });
  } catch (error) {
    throw normalizeTransactionError(error, 'Could not delete this List right now. Please try again.');
  }

  revalidatePath('/');
};
