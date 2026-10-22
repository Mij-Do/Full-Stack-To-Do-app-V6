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

const prisma = new PrismaClient();

const requireUserId = async (): Promise<string> => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  return userId;
};

export const createTodoListAction = async (payload: { title: string; body?: string; completed: boolean }) => {
  const userId = await requireUserId();
  const validated = validateTaskCreate(payload);

  await prisma.todo.create({
    data: {
      title: validated.title,
      body: validated.body,
      completed: validated.completed,
      user_id: userId,
    },
  });

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

  const { count } = await prisma.todo.updateMany({
    where: {
      id: validated.id,
      user_id: userId,
    },
    data: {
      title: validated.title,
      // '' means the description was explicitly cleared -> persist null.
      // undefined means the field was omitted -> Prisma leaves it unchanged.
      body: validated.body === '' ? null : validated.body,
      completed: validated.completed,
    },
  });

  if (count === 0) {
    throw new Error('Todo not found');
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
