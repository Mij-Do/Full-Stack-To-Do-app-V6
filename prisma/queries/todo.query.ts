import { prisma } from '@/lib/prisma';
import type { ITodoList } from '@/interfaces';

export type TodoSelection =
  | { kind: 'all' }
  | { kind: 'inbox' }
  | { kind: 'list'; listId: string };

export const getUserTodoList = async (
  userId: string | null,
  selection: TodoSelection = { kind: 'all' }
) => {
  if (!userId) {
    return [];
  }

  const viewWhere =
    selection.kind === 'inbox'
      ? {
          OR: [{ listId: null }, { listId: { isSet: false } }],
        }
      : selection.kind === 'list'
        ? { listId: selection.listId }
        : {};

  return await prisma.todo.findMany({
    where: {
      user_id: userId,
      ...viewWhere,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

export const getUserLists = async (userId: string | null): Promise<ITodoList[]> => {
  if (!userId) return [];

  const lists = await prisma.todoList.findMany({
    where: { user_id: userId },
    orderBy: [{ isArchived: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      isArchived: true,
      _count: { select: { todos: true } },
    },
  });

  return lists.map(({ _count, ...list }) => ({ ...list, todoCount: _count.todos }));
};

export const getUserListById = async (userId: string | null, id: string) => {
  if (!userId) return null;

  return prisma.todoList.findFirst({
    where: { id, user_id: userId },
    select: { id: true, name: true, isArchived: true },
  });
};
