import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revalidatePathMock, todoMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  todoMock: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('@/generated/prisma', () => ({
  PrismaClient: vi.fn(() => ({ todo: todoMock })),
}));

import {
  createTodoListAction,
  deleteTodoListAction,
  toggleTodoListAction,
  updateTodoListAction,
} from '@/prisma/actions/todo.action';
import { getUserTodoList } from '@/prisma/queries/todo.query';

const signIn = (userId: string | null) => {
  authMock.mockResolvedValue({ userId });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTodoListAction', () => {
  it('rejects unauthenticated callers without touching the database', async () => {
    signIn(null);

    await expect(
      createTodoListAction({ title: 'Valid title', completed: false })
    ).rejects.toThrow('Unauthorized');

    expect(todoMock.create).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('assigns the authenticated user id, ignoring any client-supplied userId', async () => {
    signIn('user_A');

    await createTodoListAction({
      title: 'Valid title',
      completed: false,
      userId: 'user_B',
    } as Parameters<typeof createTodoListAction>[0]);

    expect(todoMock.create).toHaveBeenCalledWith({
      data: {
        title: 'Valid title',
        body: undefined,
        completed: false,
        user_id: 'user_A',
      },
    });
  });
});

describe('updateTodoListAction', () => {
  it('rejects unauthenticated callers without touching the database', async () => {
    signIn(null);

    await expect(
      updateTodoListAction({
        id: 'todo_owned_by_B',
        title: 'Valid title',
        completed: false,
      })
    ).rejects.toThrow('Unauthorized');

    expect(todoMock.updateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('scopes the update to id + authenticated owner so another user\'s todo is untouched', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateTodoListAction({
        id: 'todo_owned_by_B',
        title: 'Valid title',
        completed: false,
      })
    ).rejects.toThrow('Todo not found');

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_B', user_id: 'user_A' },
      data: { title: 'Valid title', body: undefined, completed: false },
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('updates when the authenticated user owns the todo', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      completed: true,
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: { title: 'Valid title', body: undefined, completed: true },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });

  it('persists an explicitly cleared description as null', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      body: '',
      completed: false,
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: { title: 'Valid title', body: null, completed: false },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });

  it('persists a changed description value', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      body: 'A brand new description value.',
      completed: false,
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: { title: 'Valid title', body: 'A brand new description value.', completed: false },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });

  it('persists a legacy short description value unchanged', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      body: 'short',
      completed: false,
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: { title: 'Valid title', body: 'short', completed: false },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });
});

describe('toggleTodoListAction', () => {
  it('rejects unauthenticated callers without touching the database', async () => {
    signIn(null);

    await expect(
      toggleTodoListAction({ id: 'todo_owned_by_B', completed: true })
    ).rejects.toThrow('Unauthorized');

    expect(todoMock.updateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('scopes the toggle to id + authenticated owner so another user\'s todo is untouched', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      toggleTodoListAction({ id: 'todo_owned_by_B', completed: true })
    ).rejects.toThrow('Todo not found');

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_B', user_id: 'user_A' },
      data: { completed: true },
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('toggles when the authenticated user owns the todo', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await toggleTodoListAction({ id: 'todo_owned_by_A', completed: false });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: { completed: false },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });
});

describe('deleteTodoListAction', () => {
  it('rejects unauthenticated callers without touching the database', async () => {
    signIn(null);

    await expect(deleteTodoListAction({ id: 'todo_owned_by_B' })).rejects.toThrow(
      'Unauthorized'
    );

    expect(todoMock.deleteMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('scopes the delete to id + authenticated owner so another user\'s todo is untouched', async () => {
    signIn('user_A');
    todoMock.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteTodoListAction({ id: 'todo_owned_by_B' })).rejects.toThrow(
      'Todo not found'
    );

    expect(todoMock.deleteMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_B', user_id: 'user_A' },
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('deletes when the authenticated user owns the todo', async () => {
    signIn('user_A');
    todoMock.deleteMany.mockResolvedValue({ count: 1 });

    await deleteTodoListAction({ id: 'todo_owned_by_A' });

    expect(todoMock.deleteMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });
});

describe('getUserTodoList (server-only query, no longer a Server Action)', () => {
  it('returns an empty list instead of querying when no user id is provided', async () => {
    await expect(getUserTodoList(null)).resolves.toEqual([]);
    expect(todoMock.findMany).not.toHaveBeenCalled();
  });

  it('scopes the read to the given owner', async () => {
    todoMock.findMany.mockResolvedValue([]);

    await getUserTodoList('user_A');

    expect(todoMock.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user_A' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
