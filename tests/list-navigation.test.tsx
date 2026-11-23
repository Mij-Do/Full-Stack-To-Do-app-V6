import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ListNavigation from '@/components/ListNavigation';

const { pushMock, refreshMock, createMock, renameMock, archiveMock, deleteMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  createMock: vi.fn(),
  renameMock: vi.fn(),
  archiveMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('@/prisma/actions/list.action', () => ({
  createListAction: createMock,
  renameListAction: renameMock,
  archiveListAction: archiveMock,
  deleteEmptyListAction: deleteMock,
}));

const lists = [
  { id: '0123456789abcdef01234567', name: 'Work', isArchived: false, todoCount: 2 },
  { id: '1123456789abcdef01234567', name: 'Old', isArchived: true, todoCount: 1 },
  { id: '2123456789abcdef01234567', name: 'Empty', isArchived: true, todoCount: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ListNavigation', () => {
  it('renders bookmarkable Inbox, active List, and archived List navigation', () => {
    render(<ListNavigation lists={lists} selectedView="inbox" selectedListId={null} />);

    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute('href', '/?view=inbox');
    expect(screen.getByRole('link', { name: /Work/ })).toHaveAttribute(
      'href',
      '/?list=0123456789abcdef01234567'
    );
    expect(screen.getByRole('link', { name: 'Archived Lists' })).toHaveAttribute(
      'href',
      '/?view=archived'
    );
    expect(screen.getByRole('link', { name: /Old/ })).toHaveAttribute(
      'href',
      '/?list=1123456789abcdef01234567'
    );
  });

  it('creates a List and navigates to its selected view', async () => {
    createMock.mockResolvedValue({ id: lists[0].id });
    render(<ListNavigation lists={[]} selectedView="inbox" selectedListId={null} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'New List name' }), {
      target: { value: 'Personal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledWith({ name: 'Personal' }));
    expect(pushMock).toHaveBeenCalledWith(`/?list=${lists[0].id}`);
  });

  it('prevents UI deletion of a populated List and allows archive actions', async () => {
    render(<ListNavigation lists={lists} selectedView="list" selectedListId={lists[0].id} />);

    expect(screen.getByRole('button', { name: 'Delete empty List' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith({ id: lists[0].id }));
    expect(pushMock).toHaveBeenCalledWith('/?view=archived');
  });
});
