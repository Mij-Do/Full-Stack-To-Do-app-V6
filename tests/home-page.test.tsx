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

describe('Dashboard and unified Todos page', () => {
  it('loads every authenticated user Todo into one view', async () => {
    getTodosMock.mockResolvedValue([{ id: 'todo-1', title: 'Owned Todo', completed: false, dueDate: null }]);
    const children = await getPageChildren();
    const dashboard = children[1] as ReactElement<{ metrics: { total: number; active: number; completionRate: number } }>;
    const listSection = children[2] as ReactElement<{ children: ReactNode }>;
    const listChildren = Children.toArray(listSection.props.children);
    const table = listChildren[1] as ReactElement<{ todos: { id: string }[] }>;

    expect(getTodosMock).toHaveBeenCalledWith('owner_A');
    expect(dashboard.props.metrics).toMatchObject({ total: 1, active: 1, completionRate: 0 });
    expect(table.props.todos).toEqual([{ id: 'todo-1', title: 'Owned Todo', completed: false, dueDate: null }]);
  });

  it('propagates a failed owner-scoped Todo load to the route error boundary', async () => {
    getTodosMock.mockRejectedValue(new Error('database unavailable'));
    await expect(getPageChildren()).rejects.toThrow('database unavailable');
    expect(getTodosMock).toHaveBeenCalledWith('owner_A');
  });

  it('redirects unauthenticated visitors before loading Todos', async () => {
    authMock.mockResolvedValue({ userId: null });
    redirectMock.mockImplementation(() => { throw new Error('redirect'); });

    await expect(getPageChildren()).rejects.toThrow('redirect');
    expect(getTodosMock).not.toHaveBeenCalled();
  });
});
