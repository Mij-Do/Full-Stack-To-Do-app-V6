import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Children, type ReactElement, type ReactNode } from 'react';

const { authMock, redirectMock, getTodosMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
  getTodosMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/prisma/queries/todo.query', () => ({ getUserTodoList: getTodosMock }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import Home from '@/app/page';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'owner_A' });
});

const getPageChildren = async () => {
  const page = await Home();
  return Children.toArray((page as ReactElement<{ children: ReactNode }>).props.children);
};

describe('unified Todos page', () => {
  it('loads every authenticated user Todo into one view', async () => {
    getTodosMock.mockResolvedValue([{ id: 'todo-1' }]);
    const children = await getPageChildren();
    const table = children[1] as ReactElement<{ todos: { id: string }[] }>;

    expect(getTodosMock).toHaveBeenCalledWith('owner_A');
    expect(table.props.todos).toEqual([{ id: 'todo-1' }]);
  });

  it('redirects unauthenticated visitors before loading Todos', async () => {
    authMock.mockResolvedValue({ userId: null });
    redirectMock.mockImplementation(() => { throw new Error('redirect'); });

    await expect(getPageChildren()).rejects.toThrow('redirect');
    expect(getTodosMock).not.toHaveBeenCalled();
  });
});
