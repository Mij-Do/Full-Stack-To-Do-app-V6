'use server'

import { revalidatePath } from 'next/cache';
import { PrismaClient } from '../../generated/prisma';
import {
  validateTaskCreate,
  validateTaskDelete,
  validateTaskToggle,
  validateTaskUpdate,
} from '@/prisma/actions/validation';

const prisma = new PrismaClient();

export const getUserTodoListAction = async ({ userId }: { userId: string | null }) => {
  if (!userId) {
    return [];
  }

  return await prisma.todo.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
export const createTodoListAction = async (payload: unknown & { userId: string | null }) => {
  const validated = validateTaskCreate(payload);

  await prisma.todo.create({
    data: {
      title: validated.title,
      body: validated.body,
      completed: validated.completed,
      user_id: payload.userId as string,
    },
  });

  revalidatePath('/');
};
export const deleteTodoListAction = async (payload: unknown) => {
  const { id } = validateTaskDelete(payload);

  await prisma.todo.delete({
    where: {
      id,
    },
  });

  revalidatePath('/');
};

export const updateTodoListAction = async (payload: unknown) => {
  const validated = validateTaskUpdate(payload);

  await prisma.todo.update({
    where: {
      id: validated.id,
    },
    data: {
      title: validated.title,
      body: validated.body,
      completed: validated.completed,
    },
  });

  revalidatePath('/');
};

export const toggleTodoListAction = async (payload: unknown) => {
  const validated = validateTaskToggle(payload);

  await prisma.todo.update({
    where: {
      id: validated.id,
    },
    data: {
      completed: validated.completed,
    },
  });

  revalidatePath('/');
};
