import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ListNavigation from '@/components/ListNavigation';

const { pushMock, replaceMock, refreshMock, createMock, renameMock, archiveMock, deleteMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  createMock: vi.fn(),
  renameMock: vi.fn(),
  archiveMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, refresh: refreshMock }),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

  it('renames a List and closes the editor after success', async () => {
    renameMock.mockResolvedValue(undefined);
    render(<ListNavigation lists={lists} selectedView="list" selectedListId={lists[0].id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename List' }), {
      target: { value: 'Projects' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(renameMock).toHaveBeenCalledWith({ id: lists[0].id, name: 'Projects' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument());
    expect(screen.queryByRole('textbox', { name: 'Rename List' })).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate rename submissions while pending and closes after success', async () => {
    const request = deferred<void>();
    renameMock.mockReturnValueOnce(request.promise);
    render(<ListNavigation lists={lists} selectedView="list" selectedListId={lists[0].id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename List' });
    fireEvent.change(input, { target: { value: 'Projects' } });
    const form = input.closest('form')!;

    fireEvent.submit(form);
    const pendingButton = await screen.findByRole('button', { name: 'Saving...' });
    expect(pendingButton).toBeDisabled();
    expect(input).toBeDisabled();
    fireEvent.submit(form);
    expect(renameMock).toHaveBeenCalledTimes(1);

    request.resolve();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument());
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the editor open and allows retry after a failed rename', async () => {
    renameMock.mockRejectedValueOnce(new Error('request failed'));
    render(<ListNavigation lists={lists} selectedView="list" selectedListId={lists[0].id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename List' });
    fireEvent.change(input, { target: { value: 'Projects' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not rename the List. Check its name and try again.'
    );
    expect(screen.getByRole('textbox', { name: 'Rename List' })).toHaveValue('Projects');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(renameMock).toHaveBeenCalledWith({ id: lists[0].id, name: 'Projects' });
  });

  it('does not let a cancelled rename request change the later editing state', async () => {
    const request = deferred<void>();
    renameMock.mockReturnValueOnce(request.promise);
    render(<ListNavigation lists={lists} selectedView="list" selectedListId={lists[0].id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename List' });
    fireEvent.change(input, { target: { value: 'Projects' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByRole('button', { name: 'Saving...' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Rename List' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();

    request.resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled());
    expect(screen.queryByRole('textbox', { name: 'Rename List' })).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate Create List submissions while pending and restores the control after failure', async () => {
    const request = deferred<{ id: string }>();
    createMock.mockReturnValueOnce(request.promise).mockResolvedValueOnce({ id: lists[0].id });
    render(<ListNavigation lists={[]} selectedView="inbox" selectedListId={null} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'New List name' }), {
      target: { value: 'Personal' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    const pendingButton = await screen.findByRole('button', { name: 'Creating...' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(createMock).toHaveBeenCalledTimes(1);

    request.reject(new Error('request failed'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not create the List. Check its name and try again.'
    );
    const retryButton = screen.getByRole('button', { name: 'Create' });
    expect(retryButton).toBeEnabled();

    fireEvent.click(retryButton);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
  });

  it('prevents UI deletion of a populated List and allows archive actions', async () => {
    render(<ListNavigation lists={lists} selectedView="list" selectedListId={lists[0].id} />);

    expect(screen.getByRole('button', { name: 'Delete empty List' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith({ id: lists[0].id }));
    expect(pushMock).toHaveBeenCalledWith('/?view=archived');
  });

  it('prevents duplicate archive requests while the action is pending', async () => {
    const request = deferred<void>();
    archiveMock.mockReturnValueOnce(request.promise);
    render(<ListNavigation lists={lists} selectedView="list" selectedListId={lists[0].id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    const pendingButton = await screen.findByRole('button', { name: 'Archiving...' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(archiveMock).toHaveBeenCalledTimes(1);

    request.resolve();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/?view=archived'));
  });

  it('replaces the deleted List URL so browser Back cannot revisit it', async () => {
    const emptyList = { id: lists[2].id, name: 'Empty', isArchived: true, todoCount: 0 };
    deleteMock.mockResolvedValueOnce(undefined);
    render(<ListNavigation lists={[emptyList]} selectedView="list" selectedListId={emptyList.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete empty List' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/?view=archived'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('prevents duplicate empty-List deletion requests while pending', async () => {
    const request = deferred<void>();
    const emptyActiveList = { ...lists[2], isArchived: false };
    deleteMock.mockReturnValueOnce(request.promise);
    render(
      <ListNavigation
        lists={[emptyActiveList]}
        selectedView="list"
        selectedListId={emptyActiveList.id}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete empty List' }));
    const pendingButton = await screen.findByRole('button', { name: 'Deleting...' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(deleteMock).toHaveBeenCalledTimes(1);

    request.resolve();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/?view=inbox'));
  });

  it('shows distinct safe deletion messages for non-empty and failed transactions', async () => {
    const emptyList = { id: lists[2].id, name: 'Empty', isArchived: true, todoCount: 0 };
    const userFacingNonEmptyMessage =
      'This List still contains Todos. Move or delete them before deleting the List.';
    const { rerender } = render(
      <ListNavigation lists={[emptyList]} selectedView="list" selectedListId={emptyList.id} />
    );

    deleteMock.mockRejectedValueOnce(new Error('This List contains Todos and cannot be deleted.'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete empty List' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(userFacingNonEmptyMessage));
    expect(screen.getByRole('alert')).not.toHaveTextContent('database');

    rerender(<ListNavigation lists={[emptyList]} selectedView="list" selectedListId={emptyList.id} />);
    deleteMock.mockRejectedValueOnce(new Error('MongoServerError: private connection details'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete empty List' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not delete this List right now. Please try again.'
      )
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('private connection details');
  });
});
