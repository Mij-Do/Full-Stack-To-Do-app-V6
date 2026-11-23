import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revalidatePathMock, todoMock, todoListMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  todoMock: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  todoListMock: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('@/generated/prisma', () => ({
  PrismaClient: vi.fn(() => ({ ...prismaMock, todo: todoMock, todoList: todoListMock })),
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
  prismaMock.$transaction.mockImplementation(async (
    callback: (transaction: { todo: typeof todoMock; todoList: typeof todoListMock }) => unknown
  ) =>
    callback({ todo: todoMock, todoList: todoListMock })
  );
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
        dueDate: undefined,
        priority: 'medium',
        listId: null,
        user_id: 'user_A',
      },
    });
  });

  it('stores due dates at UTC midnight and applies the supplied priority', async () => {
    signIn('user_A');

    await createTodoListAction({
      title: 'Due date task',
      completed: false,
      dueDate: '2026-03-08',
      priority: 'high',
    });

    expect(todoMock.create).toHaveBeenCalledWith({
      data: {
        title: 'Due date task',
        body: undefined,
        completed: false,
        dueDate: new Date('2026-03-08T00:00:00.000Z'),
        priority: 'high',
        listId: null,
        user_id: 'user_A',
      },
    });
  });

  it('creates a Todo in an owned active List', async () => {
    signIn('user_A');
    todoListMock.updateMany.mockResolvedValue({ count: 1 });

    await createTodoListAction({
      title: 'List task',
      completed: false,
      listId: '0123456789abcdef01234567',
    });

    expect(todoListMock.updateMany).toHaveBeenCalledWith({
      where: { id: '0123456789abcdef01234567', user_id: 'user_A', isArchived: false },
      data: { updatedAt: expect.any(Date) },
    });
    expect(todoMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ listId: '0123456789abcdef01234567', user_id: 'user_A' }),
    });
  });

  it('rejects assignment to unavailable Lists before creating a Todo', async () => {
    signIn('user_A');
    todoListMock.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createTodoListAction({
        title: 'List task',
        completed: false,
        listId: '0123456789abcdef01234567',
      })
    ).rejects.toThrow('List not found');
    expect(todoMock.create).not.toHaveBeenCalled();
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

  it('updates a due date at UTC midnight and applies a supplied priority', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      completed: false,
      dueDate: '2026-11-03',
      priority: 'low',
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: {
        title: 'Valid title',
        body: undefined,
        completed: false,
        dueDate: new Date('2026-11-03T00:00:00.000Z'),
        priority: 'low',
      },
    });
  });

  it('clears an explicitly empty due date without changing omitted priority', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      completed: false,
      dueDate: '',
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: {
        title: 'Valid title',
        body: undefined,
        completed: false,
        dueDate: null,
      },
    });
  });

  it('updates only priority when dueDate is omitted', async () => {
    signIn('user_A');
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      completed: false,
      priority: 'high',
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: {
        title: 'Valid title',
        body: undefined,
        completed: false,
        priority: 'high',
      },
    });
  });

  it('rejects invalid date-only values before updating the database', async () => {
    signIn('user_A');

    await expect(
      updateTodoListAction({
        id: 'todo_owned_by_A',
        title: 'Valid title',
        completed: false,
        dueDate: '2026-02-30',
      })
    ).rejects.toThrow();

    expect(todoMock.updateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('moves an owned Todo to an active List after verifying both owners', async () => {
    signIn('user_A');
    todoMock.findFirst.mockResolvedValue({ listId: null });
    todoListMock.findFirst.mockResolvedValue({ isArchived: false });
    todoListMock.updateMany.mockResolvedValue({ count: 1 });
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      completed: false,
      listId: '0123456789abcdef01234567',
    });

    expect(todoMock.findFirst).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      select: { listId: true },
    });
    expect(todoListMock.findFirst).toHaveBeenCalledWith({
      where: { id: '0123456789abcdef01234567', user_id: 'user_A' },
      select: { isArchived: true },
    });
    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: expect.objectContaining({ listId: '0123456789abcdef01234567' }),
    });
  });

  it('moves a Todo back to the Inbox by explicitly setting listId to null', async () => {
    signIn('user_A');
    todoMock.findFirst.mockResolvedValue({ listId: '0123456789abcdef01234567' });
    todoMock.updateMany.mockResolvedValue({ count: 1 });

    await updateTodoListAction({
      id: 'todo_owned_by_A',
      title: 'Valid title',
      completed: false,
      listId: null,
    });

    expect(todoMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'todo_owned_by_A', user_id: 'user_A' },
      data: expect.objectContaining({ listId: null }),
    });
  });

  it('rejects a foreign-owned or archived target List', async () => {
    signIn('user_A');
    todoMock.findFirst.mockResolvedValue({ listId: null });
    todoListMock.findFirst.mockResolvedValue(null);

    await expect(
      updateTodoListAction({
        id: 'todo_owned_by_A',
        title: 'Valid title',
        completed: false,
        listId: '0123456789abcdef01234567',
      })
    ).rejects.toThrow('List not found');
    expect(todoMock.updateMany).not.toHaveBeenCalled();
  });

  it('rejects moving an existing Todo into an archived List', async () => {
    signIn('user_A');
    todoMock.findFirst.mockResolvedValue({ listId: null });
    todoListMock.findFirst.mockResolvedValue({ isArchived: true });

    await expect(
      updateTodoListAction({
        id: 'todo_owned_by_A',
        title: 'Valid title',
        completed: false,
        listId: '0123456789abcdef01234567',
      })
    ).rejects.toThrow('List not found');
    expect(todoMock.updateMany).not.toHaveBeenCalled();
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
