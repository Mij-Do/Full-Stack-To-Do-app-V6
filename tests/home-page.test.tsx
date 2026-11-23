import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Children, type ReactElement, type ReactNode } from 'react';

const { authMock, redirectMock, notFoundMock, getListsMock, getListByIdMock, getTodosMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
  getListsMock: vi.fn(),
  getListByIdMock: vi.fn(),
  getTodosMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }));
vi.mock('@/prisma/queries/todo.query', () => ({
  getUserLists: getListsMock,
  getUserListById: getListByIdMock,
  getUserTodoList: getTodosMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import Home from '@/app/page';

const listId = '0123456789abcdef01234567';
const lists = [{ id: listId, name: 'Work', isArchived: false, todoCount: 2 }];

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'owner_A' });
  getListsMock.mockResolvedValue(lists);
});

const getPageChildren = async (params: { view?: string; list?: string }) => {
  const page = await Home({ searchParams: Promise.resolve(params) });
  return Children.toArray((page as ReactElement<{ children: ReactNode }>).props.children);
};

describe('Dashboard selected List view', () => {
  it('uses the bookmarkable List query and defaults new Todos to the selected active List', async () => {
    getListByIdMock.mockResolvedValue(lists[0]);
    getTodosMock.mockResolvedValue([{ id: 'todo-1' }]);

    const children = await getPageChildren({ list: listId });
    const navigation = children[1] as ReactElement<{ selectedView: string; selectedListId: string }>;
    const table = children[2] as ReactElement<{ todos: { id: string }[] }>;
    const header = children[0] as ReactElement<{ children: ReactNode }>;
    const headerChildren = Children.toArray(header.props.children) as ReactElement<{
      selectedListId?: string | null;
    }>[];
    const addForm = headerChildren[1];

    expect(getTodosMock).toHaveBeenCalledWith('owner_A', { kind: 'list', listId });
    expect(navigation.props).toMatchObject({ selectedView: 'list', selectedListId: listId });
    expect(table.props.todos).toEqual([{ id: 'todo-1' }]);
    expect(addForm.props.selectedListId).toBe(listId);
  });

  it('keeps the archived directory bookmarkable and exposes archived Lists for selection', async () => {
    const archivedLists = [{ id: listId, name: 'Old', isArchived: true, todoCount: 1 }];
    getListsMock.mockResolvedValue(archivedLists);

    const children = await getPageChildren({ view: 'archived' });
    const navigation = children[1] as ReactElement<{ selectedView: string }>;
    const table = children[2] as ReactElement<{ todos: unknown[]; emptyMessage: string }>;

    expect(getTodosMock).not.toHaveBeenCalled();
    expect(navigation.props.selectedView).toBe('archived');
    expect(table.props.todos).toEqual([]);
    expect(table.props.emptyMessage).toContain('Choose an archived List');
  });

  it('returns not found rather than exposing a foreign selected List', async () => {
    getListByIdMock.mockResolvedValue(null);
    notFoundMock.mockImplementation(() => {
      throw new Error('not found');
    });

    await expect(getPageChildren({ list: listId })).rejects.toThrow('not found');
    expect(getTodosMock).not.toHaveBeenCalled();
  });
});
